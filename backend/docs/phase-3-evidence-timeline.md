# Phase 3 — 증거 판독 오케스트레이션 · 타임라인

> 목표: 프론트가 보낸 이미지를 AI-server로 흘려보내고, 돌아온 카드를 세션에 담고, 사용자 확인을 받고, 타임라인으로 조립한다.
>
> 근거: `../../docs/00-context/spec.md` F3-02·F3-04·F4-05·F4-06·F5-01~04, `../../docs/02-architecture/api-contract.md`, `../../docs/02-architecture/internal-api-contract.md`

## 이 Phase의 경계

**백엔드는 이미지를 판독하지 않는다.** 판독은 AI-server의 몫이고, 백엔드는 오케스트레이션(수신·검증·전달·보관·확인·조립)만 한다 — `../../docs/02-architecture/system-architecture.md` 컴포넌트 책임표.

## 3-1. AiClient (내부 API 클라이언트)

`../../docs/02-architecture/internal-api-contract.md`

- [ ] `ai/` 패키지에 `AiClient` 인터페이스 + `AiClientImpl`
- [ ] 모든 `/internal/*` 호출에 헤더 `X-Internal-Token` 부착 (값은 환경변수 `INTERNAL_TOKEN`)
- [ ] 타임아웃: `/internal/extract` **20초**, `/internal/draft` **15초**
- [ ] 재시도: **1회, 동일 요청 재전송.** 실패 시 오류 응답을 그대로 프론트에 전달
- [ ] AI-server 오류 응답의 `fallback: "text_input"`을 공개 응답에서는 `"/api/evidence/text"`로 치환 (내부 경로 비노출)

> ⚠️ **미확정 — 이미지 전달 방식 A/B.** 계약 문서의 해당 블록이 `[결정: TODO]` 상태다. 회신 전까지 `AiClientImpl.extract()`의 **본문 직렬화 부분만 비워두고** 나머지(헤더·타임아웃·재시도·오류 변환)는 먼저 구현한다. 요청: `../../docs/request/ai/image-transfer-and-internal-auth.md`

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
| **날짜 또는 금액이 `low` 신뢰도인 카드가 미확인** | 프론트 차단 + **백엔드도 `/api/readiness`를 `409` + `UNCONFIRMED_FIELDS`로 거부** |
| 그 외 미확인 카드 | 진행 허용 + "확인하지 않은 자료 n건은 문서에 포함되지 않습니다" 경고 |

- [ ] 위 두 케이스를 구분해 구현한다 (전부 차단하면 안 된다)
- [ ] 서버 측 거부는 2026-08-23 확정 사항이며 `api-contract.md`에 명시했다. 프론트 차단은 사용자 경험, 서버 거부는 데이터 무결성 목적이다
- [ ] **`confirmed`가 아닌 카드는 `/api/draft` 입력에서 제외한다** (F4-06 소명서 반영, 수용 기준: 미확인 카드의 날짜·금액이 소명서 본문에 나타나지 않음 — TC-11)

## 3-4. `POST /api/evidence/text` (F3-04)

- [ ] 요청 `{ rawText }` (최대 2000자) → AI-server `/internal/extract`의 텍스트 경로로 전달
- [ ] 응답 `{ cards }`
- [ ] 텍스트 경로로 만들어진 카드는 **`occurred_at` 신뢰도를 전부 `low`로 유지**한다 (F3-04 처리). 백엔드가 이를 `high`로 승격시키지 않는다

> 정규식 자동 마스킹(주민번호·전화번호·계좌번호)은 프론트 담당이다(F3-06 텍스트 경로). 백엔드는 받은 텍스트를 **로그에 남기지 않는다**(NFR-08).

## 3-5. 타임라인 조립 — `GET /api/timeline`

응답 `{ events, gaps }`. 아래 규칙은 전부 결정적이며 **LLM을 호출하지 않는다.**

### F5-01 시간순 정렬

- [ ] `occurred_at` 오름차순
- [ ] 동시각은 `source_type` 우선순위 (`chat → bank → shipping`)
- [ ] 사용자가 입력한 **지급정지일만** 이벤트로 삽입하고 "사용자 진술 / 낮은 신뢰도"로 표시
- [ ] **금지: 문진 응답에서 날짜를 역산해 이벤트를 생성하지 않는다** (F5-01 금지 — 없는 사실을 만드는 행위)

> ⚠️ **미확정 — `source_type`.** 카드 스키마에 `source_type`이 없어 동시각 tie-break을 구현할 수 없다. 회신 전까지는 `occurred_at` 단일 정렬로 두고 tie-break은 비워둔다. 요청: `../../docs/request/ai/card-source-type.md`

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
| ① | `delivery_evidence == false` + 사유가 재화 거래 | 발송 증빙 없음 |
| ② | `life_activity == false` + 계좌 사용이 '주 거래'가 아님 | 생계 흔적 없음 |
| ③ | 대화 내역 없음 | 거래 합의 증빙 없음 |

- [ ] 3종 구현. ③은 `source_type == chat` 판정이 필요하므로 위 미확정 항목에 함께 걸린다
- [ ] 수용 기준: 송장을 빼고 업로드하면 발송 증빙 공백이 표시된다
- [ ] **발표에서 자료를 빼고 공백이 나타나는 장면을 시연한다** (`../../docs/04-testing/test-cases-and-demo.md` `[0:45]`) — 이 경로가 죽으면 데모가 죽는다

> ⚠️ **회신 대기 — 직거래 경로.** 규칙 ①은 `delivery`를 **"송장·발송 기록"**(F4-02)으로 판정하는데, **직거래는 송장이 원래 없다.** 이대로 구현하면 직거래 사용자에게 채울 수 없는 공백을 띄우고 준비도를 깎는다. 회신 전까지 **규칙 ①을 구현하되, 거래 방식이 직거래로 판정되는 경로가 생기면 예외 처리를 추가할 자리를 비워둔다.** 요청: `../../docs/request/frontend/evidence-structure-revision.md` §3

### F5-04 대체 증빙 제안

고정 매핑 테이블이므로 백엔드에서 구현한다 (총괄표 담당은 `B`이나 LLM이 필요 없는 고정 매핑이다).

| 없는 자료 | 제안 |
| --- | --- |
| 대화 내역 없음 | 이메일 · 문자 · 통화 기록 |
| 발송 증빙 없음 | 택배사 조회 화면 · 수령 확인 |
| 용역 증빙 없음 | 결과물 파일 · 전달 기록 |

스코프 컷 순서 6번 — 밀리면 버린다.

> ⚠️ **회신 대기.** 위 매핑의 "발송 증빙 없음 → 택배사 조회 화면·수령 확인"도 **택배 전제**다. 직거래에는 물품 사진·거래 장소·대면 인도 정황이 필요하다. §3 회신에 따라 매핑을 늘린다.

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
