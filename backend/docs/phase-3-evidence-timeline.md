# Phase 3 — 증거 판독 오케스트레이션 · 타임라인

> 목표: 프론트가 보낸 이미지를 AI-server로 흘려보내고, 돌아온 카드를 세션에 담고, 사용자 확인을 받고, 타임라인으로 조립한다.
>
> 근거: `../../docs/00-context/spec.md` F3-02·F3-04·F4-05·F4-06·F5-01~04, `../../docs/02-architecture/api-contract.md`, `../../docs/02-architecture/internal-api-contract.md`

> ### ✅ 2026-08-25 구현 완료 — 계약에 없던 부분은 이번에 채우고 `api-contract.md` v1.8에 반영했다
> - **`imageIndex`**: 1장씩 병렬 호출 시 응답 도착 순서가 blob 배열 순서와 달라질 수 있어, 프론트가 파일마다 원래 인덱스를 명시적으로 보내는 것으로 계약을 보완했다
> - **`gaps` 스키마**: `type`/`label`/`suggestions`로 신설. `no_delivery_evidence`/`no_service_evidence`(F5-04 표의 "용역 증빙 없음"에 대응 — F5-03 3규칙엔 없었지만 F5-04 매핑표에 있어 규칙을 하나 보완했다)/`no_life_activity`/`no_chat_evidence` 4종
> - **`confirmed: false` = 카드 삭제**로 구현했다. F4-06 처리 ④ "카드 삭제 가능"에 대응하는 필드가 계약에 따로 없었다
> - **병합 승인**: 카드를 합치지 않는다. `occurred_at`이 가장 이른 카드만 `events`에 남기고 나머지는 세션에는 그대로 두되 타임라인 표시에서만 뺀다(출처 보존)
> - **AI-server 미배포로 실제 연동은 검증하지 못했다.** `AiClient`는 `MockRestServiceServer`로 요청 구성·재시도·오류 매핑만 검증했다 — URL·헤더·본문이 계약과 일치하는지는 확인했지만, AI-server가 실제로 이 형식을 받는지는 별도 통합 테스트가 필요하다
> - 단위 테스트 45개(파일 검증·게이팅·금액 교차 대조·타임라인 정렬·병합 후보·공백 탐지) 전부 통과

## 이 Phase의 경계

**백엔드는 이미지를 판독하지 않는다.** 판독은 AI-server의 몫이고, 백엔드는 오케스트레이션(수신·검증·전달·보관·확인·조립)만 한다 — `../../docs/02-architecture/system-architecture.md` 컴포넌트 책임표.

## 3-1. AiClient (내부 API 클라이언트)

`../../docs/02-architecture/internal-api-contract.md`

- [ ] `ai/` 패키지에 `AiClient` 인터페이스 + `AiClientImpl`
- [ ] 모든 `/internal/*` 호출에 헤더 `X-Internal-Token` 부착 (값은 환경변수 `INTERNAL_TOKEN`)
- [ ] 타임아웃: `/internal/extract` **20초**, `/internal/draft` **15초**
- [ ] 재시도: **1회, 동일 요청 재전송.** 실패 시 오류 응답을 그대로 프론트에 전달
- [ ] AI-server 오류 응답의 `fallback: "text_input"`을 공개 응답에서는 `"/api/evidence/text"`로 치환 (내부 경로 비노출)

### ✅ 이미지 전달 방식 확정 (2026-08-25) — 블로커 해제

회신: `../../docs/response/backend/image-transfer-and-internal-auth.md`. **A 계열(바이트 그대로) 확정, 단 멀티파트 봉투 없이 raw body.**

```java
// 이미지 경로 — 1장당 1요청
restClient.post()
    .uri(aiServerUrl + "/internal/extract?image_index={n}", n)
    .contentType(MediaType.IMAGE_PNG)      // 받은 파일의 실제 타입 그대로
    .header("X-Internal-Token", internalToken)
    .body(bytes)
```

- [ ] **`MultipartBodyBuilder`를 쓰지 않는다.** AI-server 쪽 멀티파트 파서가 큰 파트를 **디스크에 스풀링**해 "이미지를 디스크에 쓰지 않는다" 원칙이 깨질 수 있다는 것이 봉투를 뺀 이유다 — 우리가 편하려고 되돌리면 그 원칙이 다시 깨진다
- [ ] `Content-Type`은 **받은 파일의 실제 타입**을 그대로 쓴다 (`image/png` / `image/jpeg`). 매직바이트 검증에서 이미 판별한 값을 재사용한다
- [ ] 텍스트 경로(F3-04)는 **같은 엔드포인트에 `application/json`** — `{ "rawText": "..." }`. AI-server가 Content-Type으로 두 경로를 구분한다
- [ ] `image_index`는 **프론트 blob 배열 인덱스와 일치**해야 한다. 응답 카드의 `source_image_index`로 그대로 반사되고, 프론트는 이 값으로 자기 blob을 찾는다 (F7-05)

> raw body 전송에 Spring 쪽 문제가 생기면 AI 담당이 **하루 안에 멀티파트로 전환 가능**하다고 회신했다 (인메모리 파싱으로 스풀링 우회). 막히면 붙들고 있지 말고 알린다.

### 오류 코드 — `QUOTA_EXCEEDED`를 따로 다룬다 (2026-08-25 확정)

| AI-server가 주는 코드 | HTTP | 백엔드 처리 |
| --- | --- | --- |
| `EXTRACTION_FAILED` | 502 | `fallback`을 `/api/evidence/text`로 치환해 전달 |
| `TIMEOUT` | 504 | 같음 + 부분 결과 반환 |
| **`QUOTA_EXCEEDED`** | **429** | **데모 모드 폴백(F4-05)** — 일반 실패와 섞지 않는다 |
| `DRAFT_FAILED` | 502 | 그대로 전달 |
| (인증 실패) | 401 | `INTERNAL_TOKEN` 불일치 — 설정 오류다. 프론트에 500으로 내리고 로그에 남긴다 |

> **F3-07(사유별 업로드 안내)은 프론트 담당이다.** 다만 안내 목록은 `reason-type-rules.md` §2를 F7-03과 공유하므로, **백엔드가 Phase 4에서 만드는 체크리스트 데이터와 같은 소스**여야 한다. 프론트가 목록을 따로 하드코딩하면 두 곳이 어긋난다 — 회신에서 전달 방식(계약 필드 vs 프론트 상수)을 정한다(`../../docs/request/frontend/evidence-structure-revision.md` §7).

## 3-2. `POST /api/evidence`

- [ ] multipart 수신 — 최대 10장, JPG/PNG. **`max-file-size` 10MB 설정 확인**(Phase 1-4b — 기본 1MB면 정상 이미지가 400)
- [ ] **프론트엔드는 1장씩 병렬로 호출한다** (2026-08-23 확정, `api-contract.md`). 호출이 나뉘어도 **세션당 누적 10장 제한을 서버가 유지**한다. 11장째는 400. F3-03(파일별 진행 표시)을 SSE·폴링 없이 만족시키기 위한 방식이다
- [ ] **프론트 동시 요청 상한은 4**다 (2026-08-24 확정). 거부선이 아니라 발신 상한이므로 **초과 도착분도 거부하지 않고 큐잉**한다. 서버가 4를 넘겨 AI로 흘려보내지 않도록 주의 — Render 512MB에서 이미지가 메모리로만 통과하므로 동시 개수가 곧 메모리 점유다
- [ ] **파일 검증 (F3-02)**
  - [ ] 확장자 화이트리스트 (jpg, jpeg, png)
  - [ ] **실제 매직바이트 확인** — 확장자를 위조한 파일 거부 (F3-02 수용 기준)
  - [ ] 파일당 10MB
  - [ ] 세션당 누적 10장
  - [ ] 위반 시 `400` + 사유. **나머지 파일은 정상 처리한다** (F3-02 예외)
- [ ] AI-server 호출 → 응답의 `cards`, `signals`, **`qualityFlags`** 를 세션에 저장 (`data-model.md`의 `Session` 레코드에 세 항목이 모두 있다)
- [ ] 응답: `{ cards, signals, qualityFlags }` (`api-contract.md`)
- [ ] **이미지 바이트를 디스크에 쓰지 않는다.** AI-server 응답 수신 후 **메모리에서 즉시 참조를 해제**한다 — `../../docs/03-infra-ops/privacy-and-safety.md` 백엔드 책임

### 협박 신호는 버퍼링하지 않는다

`signals.threat_detected == true`는 **받는 즉시** 프론트 응답에 담는다. 다음 단계까지 지연시키지 않는다 — `internal-api-contract.md` 명시. 프론트가 즉시 협박 대응 배너(F10-02)를 띄워야 하기 때문이다.

### 판독 실패 처리 (F4-05)

| 상황 | 백엔드 처리 |
| --- | --- |
| 일부 이미지 실패 | 해당 파일만 스킵, 나머지 카드 반환 |
| 전체 실패 | `EXTRACTION_FAILED` + `fallback: "/api/evidence/text"` |
| 타임아웃(20초 초과) | `TIMEOUT` + **부분 결과 반환** |
| 쿼터 초과 | `QUOTA_EXCEEDED` → 데모 모드 폴백 (Phase 6) |

### 자료 간 금액 교차 대조 (F4-07 — 서버 몫)

F4-07의 담당은 `B`(AI)지만, **처리 절차가 "LLM이 quality_flags 산출 → 서버에서 자료 간 금액 교차 대조 → 문제 유형별 안내 문구 매핑"** 으로 되어 있다. 가운데 단계가 백엔드 몫이다.

- [ ] 세션에 쌓인 카드들의 `amount`를 서로 대조해 **자료마다 금액이 다르면 `amount_mismatch`를 세운다** (F4-07 검사 항목 ⑥)
- [ ] 이 값이 Phase 4의 `hasConflicts` 입력이 되고, 결국 `BANK_CHECK_REQUIRED` 분기를 만든다 — **이 연결이 끊기면 자료 충돌 케이스가 영원히 산출되지 않는다**
- [ ] 문제 유형별 안내 문구를 고정 템플릿으로 매핑한다 (예: "화면 상단의 날짜가 보이도록 다시 캡처해 주세요")
- [ ] P1이다. 컷될 경우 **LLM이 준 `quality_flags` 전달까지만 유지하고 안내 문구는 고정 1종으로 대체**한다 (F4-07 우선순위)

> LLM이 이미지 1장 안에서 판단하는 `blurry` / `missing_date`와 달리, `amount_mismatch`는 **여러 자료를 함께 봐야** 알 수 있다. AI-server는 이미지를 1장씩 보므로 구조적으로 이 판단을 할 수 없고, 그래서 서버 몫으로 남아 있다.

## 3-3. `POST /api/evidence/confirm` (F4-06 / FR-028)

요청 `{ cardId, confirmed, corrections }` → 응답 `{ ok, confirmedCount, unconfirmedCount }`

- [ ] `confirmed: true` → 카드 `confirmation_status = user_confirmed`
- [ ] `corrections`가 있으면 값 반영 + `user_corrected` 표시 ("사용자 수정" 배지용)
- [ ] 카드 삭제 지원 (F4-06 처리 ④)
- [ ] **확인 불가한 값을 임의로 채우지 않는다.** 미상으로 유지 (F4-06 미상처리)

### 게이팅 (Phase 4 진입 조건)

`../../docs/00-context/prd.md` FR-028 / spec F4-06 게이팅 항목 — 두 단계로 다르다.

| 상태 | 처리 |
| --- | --- |
| **날짜 또는 금액이 `low` 신뢰도인 카드가 미확인** (금액은 값이 `null`이 아닌 경우에 한함, 날짜는 `null` 포함 — 2026-08-26 정정) | 프론트 차단 + **백엔드도 `/api/readiness`·`/api/draft`를 `409` + `UNCONFIRMED_FIELDS`로 거부** |
| 그 외 미확인 카드 | 진행 허용 + "확인하지 않은 자료 n건은 문서에 포함되지 않습니다" 경고 |

- [x] 위 두 케이스를 구분해 구현한다 (전부 차단하면 안 된다)
- [x] 서버 측 거부는 2026-08-23 확정 사항이며 `api-contract.md`에 명시했다. 프론트 차단은 사용자 경험, 서버 거부는 데이터 무결성 목적이다
- [x] ~~**`amount`/`occurred_at`이 `null`인 카드의 `field_confidence`는 게이팅 판단에서 읽지 않는다**~~ **2026-08-26 정정 — `occurred_at`은 제외.** `amount == null`(금액 못 읽음)은 그대로 게이팅 근거에서 뺀다 — 대화 캡처에 금액이 없는 것은 정상이라 그 카드에 채워지는 `low`는 의미 없는 값이다. 반면 `occurred_at == null`(연도 없는 은행 캡처 등)은 정보 누락으로 보고 `low`와 동급으로 차단한다(`docs/request/backend/repeated-events-and-irrelevant-cards.md` §7) — 상세: `../../docs/02-architecture/internal-api-contract.md` "신뢰도의 `null`" 절
- [ ] **`confirmed`가 아닌 카드는 `/api/draft` 입력에서 제외한다** (F4-06 소명서 반영, 수용 기준: 미확인 카드의 날짜·금액이 소명서 본문에 나타나지 않음 — TC-11)

### 이름 두 개를 세션에 담는다 (2026-08-25 신설)

카드에 `counterparty_name`(대화 상대 표시명) / `payer_name`(입금자 표기)가 추가됐다. **구매자–송금인 일치 대조의 재료**다 (`../../docs/01-product/reason-type-rules.md` §2-1).

- [ ] 두 필드를 세션 카드에 **그대로 보관**한다 (`field_confidence`의 같은 키도 함께)
- [ ] **값이 `null`인 경우가 흔하다** — 상단바 잘린 캡처, F3-06으로 사용자가 가린 경우. `null`을 오류로 다루지 않는다
- [ ] `/api/evidence/confirm`의 `corrections`로 **사용자가 이 두 값을 수정할 수 있어야 한다** (F4-06). 잘못 읽은 이름이 그대로 대조에 들어가는 것을 막는 유일한 장치다
- [ ] **대조 자체는 Phase 4다.** 여기서는 담기만 한다
- [ ] 로그에 남기지 않는다 (NFR-08). 개인정보 경계는 `../../docs/03-infra-ops/privacy-and-safety.md` "추출 범위 예외 — 거래 당사자 표시명"이 단일 출처다

## 3-4. `POST /api/evidence/text` (F3-04)

- [ ] 요청 `{ rawText }` (최대 2000자) → AI-server `/internal/extract`의 텍스트 경로로 전달
- [ ] 응답 `{ cards }`
- [ ] 텍스트 경로로 만들어진 카드는 **`occurred_at` 신뢰도를 전부 `low`로 유지**한다 (F3-04 처리). 백엔드가 이를 `high`로 승격시키지 않는다

> 정규식 자동 마스킹(주민번호·전화번호·계좌번호)은 프론트 담당이다(F3-06 텍스트 경로). 백엔드는 받은 텍스트를 **로그에 남기지 않는다**(NFR-08).

## 3-5. 타임라인 조립 — `GET /api/timeline`

응답 `{ events, gaps }`. 아래 규칙은 전부 결정적이며 **LLM을 호출하지 않는다.**

### F5-01 시간순 정렬

- [ ] `occurred_at` 오름차순
- [ ] 동시각은 `source_type` 우선순위 (`chat → bank → shipping`, **`unknown`은 최하위**)
- [ ] 사용자가 입력한 **지급정지일만** 이벤트로 삽입하고 "사용자 진술 / 낮은 신뢰도"로 표시
- [ ] **금지: 문진 응답에서 날짜를 역산해 이벤트를 생성하지 않는다** (F5-01 금지 — 없는 사실을 만드는 행위)

### ✅ `source_type` 확정 (2026-08-25) — 블로커 해제

회신: `../../docs/response/backend/card-source-type.md`. **이벤트(카드) 단위**로 확정됐다 — 한 이미지에 유형이 섞이는 경우가 흔해 이미지 단위 역매핑은 기각됐다.

- [ ] tie-break 우선순위 (2026-08-25 ② AI가 근거와 함께 6종 전부 확정):

| 순위 | 값 | 근거 |
| --- | --- | --- |
| 0~2 | `chat` → `bank` → `shipping` | 거래의 인과 순서 (약속 → 입금 → 발송) |
| 3 | `threat` | **지급정지 이후에 오는 사건.** 거래 서사가 끝난 뒤의 일 |
| 4 | `autopay` | 생활 흔적(`life_activity`)이지 거래의 일부가 아님 |
| 5 | `unknown` | 최하위 |

> 이 순서는 **화면 표시 순서일 뿐 준비도·의미 판정이 아니다.** 동시각 충돌 자체가 드물어(캡처마다 분 단위가 다름) 실무 영향은 크지 않지만, 비워 두면 구현자마다 달라지므로 못 박았다.
- [ ] **`unknown`은 정상 값이다** (AI가 추측하지 않고 내린 값) — 오류로 처리하지 않는다
- [ ] F5-03 ③ 대화 유무 판정은 **`source_type == "chat"` 카드의 존재 여부**로 구현한다

### `event_id` 중복은 백엔드가 처리한다 (2026-08-25 확정)

AI-server는 **무상태**라 세션을 모른다. 채번은 `evt_{image_index}_{n}` / `evt_txt_{n}`이므로 **같은 `image_index`로 재추출하면 ID가 충돌한다** (사용자가 카드를 지우고 같은 자리에 다시 올리는 경우).

- [ ] 세션에 카드를 담을 때 **같은 `event_id`가 이미 있으면 기존 카드를 대체**한다 (추가하지 않는다)
- [ ] `event_id`를 **파싱해 의미를 꺼내 쓰지 않는다** — 불투명 문자열로 취급한다. 인덱스가 필요하면 `source_image_index` 필드를 쓴다

### F5-02 중복 이벤트 병합

- [ ] 병합 후보 판단: **시각 차 5분 이내 + 금액 일치 + `actor` 동일**
- [ ] **자동 확정하지 않는다.** 후보로 제시하고 사용자 승인 후에만 병합
- [ ] 병합해도 출처는 둘 다 기록
- [ ] `GET /api/timeline` 응답에 **`mergeCandidates: [{ groupId, eventIds, reason }]`** 를 담는다. 후보가 없으면 빈 배열
- [ ] `reason`은 **사용자에게 그대로 보여줄 수 있는 문장**으로 만든다 (예: "시각 차 2분 · 금액 700,000원 일치 · actor 동일"). 설명 없이 승인받지 않는다
- [ ] **`POST /api/timeline/merge`** — `{ mergeGroupIds, approved }`. `mergeGroupIds`는 `groupId` 배열이다(`eventId` 아님)
- [ ] `approved: false`면 거절로 기록해 이후 `mergeCandidates`에서 제외한다. 이벤트는 그대로 둔다
- [ ] 응답은 갱신된 타임라인 전체 (`GET /api/timeline`과 같은 형태)

> **2026-08-24 확정** — 승인 엔드포인트가 계약에 반영됐다(`api-contract.md` §`/api/timeline/merge`). 근거: `../../docs/response/backend/pdf-ownership-and-open-contracts.md` §2.
>
> **컷하면** `mergeCandidates`를 항상 빈 배열로 내리고 승인 엔드포인트를 만들지 않는다. 프론트는 빈 배열이면 후보 UI를 렌더하지 않으므로 양쪽이 서로를 기다리지 않는다. **컷 결정 시 `../../docs/response/frontend/`에 회신한다.**
>
> F5-02는 스코프 컷 순서 4번이다 — 일정이 밀리면 가장 먼저 버릴 수 있다(`spec.md` 부록).

### F5-03 증거 공백 탐지

탐지 규칙 3종 (F5-03):

| # | 조건 | 공백 |
| --- | --- | --- |
| ① | `delivery_evidence == false` + 사유가 재화 거래 **+ `deliveryMethod != "in_person"`** | 발송 증빙 없음 |
| ② | `life_activity == false` + 계좌 사용이 '주 거래'가 아님 | 생계 흔적 없음 |
| ③ | 대화 내역 없음 (`source_type == "chat"` 카드 부재) | 거래 합의 증빙 없음 |

- [ ] 3종 구현
- [ ] 수용 기준: 송장을 빼고 업로드하면 발송 증빙 공백이 표시된다
- [ ] **발표에서 자료를 빼고 공백이 나타나는 장면을 시연한다** (`../../docs/04-testing/test-cases-and-demo.md` `[0:45]`) — 이 경로가 죽으면 데모가 죽는다

### ✅ 직거래 예외 확정 (2026-08-25) — 블로커 해제

회신: `../../docs/response/backend/evidence-structure-revision.md` §4. **A안(문진 문항 추가)** 으로 확정됐고, 필드는 `/api/intake`의 **`deliveryMethod`** (Phase 2에서 세션에 담는다).

- [ ] **`deliveryMethod == "in_person"`이면 규칙 ①을 적용하지 않는다.** 직거래는 송장이 원래 없어서, 그대로 두면 사용자에게 **채울 방법이 없는 공백**을 띄우고 준비도를 깎는다 (TC-30)
- [ ] `courier` / `not_applicable` / `null`은 종전 규칙 그대로
- [ ] **`delivery_evidence` 자체는 AI가 그대로 산출한다.** 판단 기준이 "송장·발송 기록"(F4-02)이라 직거래에서는 **구조적으로 `false`가 나오는 것이 정상**이다 — AI가 거래 방식을 추측하게 만들지 않고, **세션의 `deliveryMethod`를 아는 백엔드가 규칙 ①에서 거른다**
- [ ] 체크리스트의 `goods.delivery` 라벨도 `in_person`이면 **물품 사진·거래 장소·대면 인도 정황**으로 바꾼다 (Phase 4)

### F5-04 대체 증빙 제안

고정 매핑 테이블이므로 백엔드에서 구현한다 (총괄표 담당은 `B`이나 LLM이 필요 없는 고정 매핑이다).

| 없는 자료 | 제안 |
| --- | --- |
| 대화 내역 없음 | 이메일 · 문자 · 통화 기록 |
| 발송 증빙 없음 (**`courier`·`null`**) | 택배사 조회 화면 · 수령 확인 |
| 발송 증빙 없음 (**`in_person`**) | **물품 사진 · 거래 장소·시각을 보이는 자료 · 대면 인도 정황** (2026-08-25 신설) |
| 용역 증빙 없음 | 결과물 파일 · 전달 기록 |

- [ ] **`deliveryMethod == "in_person"`이면 택배 전제 제안을 내지 않는다.** 종전 매핑이 전부 택배 전제라, 그대로 두면 **채울 수 없는 자료를 "대안"이라며 제시**하게 된다 — F5-03에서 공백을 안 띄우기로 해놓고 여기서 다시 요구하는 셈이다

스코프 컷 순서 6번 — 밀리면 버린다.

## 성능 목표 (NFR-01)

| 항목 | 목표 |
| --- | --- |
| 이미지 1장 판독 | p95 **8초** |
| 타임라인 생성 | p95 **15초** |

**측정 구간은 "서버 수신 ~ 추출 완료"** 다. 업로드 전 마스킹(FR-027)과 카드 확인(FR-028) 대기 시간은 제외한다 — `../../docs/00-context/prd.md` NFR-01.

- [ ] 측정 구간 기준으로 소요 시간을 로그에 남긴다 (**시간·엔드포인트만. 이미지 내용·추출 텍스트 금지** — NFR-08)
- [ ] AI-server 타임아웃(20초)이 NFR-01 목표보다 크므로, 목표 초과와 타임아웃은 별개다. 8초를 넘겨도 20초 안에 오면 정상 응답으로 처리한다

## 완료 기준

- 이미지 4장 업로드 → 카드가 돌아오고 세션에 저장된다 (F3-01 수용 기준)
- 확장자를 위조한 파일이 거부되고 나머지는 정상 처리된다
- `low` 신뢰도 미확인 카드가 있으면 `/api/readiness`가 차단된다
- 송장 이미지를 빼면 발송 증빙 공백이 나온다
- **서버 어디에도 이미지 파일이 남지 않는다** (직접 확인 — `privacy-and-safety.md` 체크리스트)

## AI-server 연동 검증 (`internal-api-contract.md` 체크리스트)

계약 문서 하단 체크리스트 중 **백엔드가 확인해야 하는 항목**이다.

- [ ] AI-server의 `/internal/*` 응답 스키마가 `api-contract.md`와 **동일한지 확인**한다. 갈라지면 백엔드가 매번 변환 코드를 짜야 한다
- [ ] `/internal/health`가 외부 헬스체크 도구에서 접근 가능한지 확인한다 (토큰 없이 열려 있어야 함 — Phase 6 킵얼라이브의 전제)
- [ ] AI-server도 이미지를 처리 완료 즉시 폐기하는지 확인한다 (원본이 AI-server에 남지 않아야 함 — `privacy-and-safety.md`)

## 단위 테스트 (Phase 3 범위)

- 파일 검증: 매직바이트 위조 · 10MB 초과 · 11장째
- **금액 교차 대조: 카드 간 금액이 다르면 `amount_mismatch`가 선다**
- 게이팅: `low`+미확인 차단 / 그 외 미확인 통과+경고
- 타임라인 정렬 · 병합 후보 판정 · 공백 탐지 3규칙
