# API 계약 (Frontend ↔ Backend)

> **수정 기록 (2026-08-27, 백엔드)** — 근거: `../request/backend/recurrence-not-reaching-frontend.md` (프론트 실연동 신고)
> - **`recurrence` 필드를 계약에 반영.** `internal-api-contract.md`에 이미 있던 필드가 이 문서와 `ExtractedEvent`(record)에 빠져 있어 조용히 버려지고 있었다 — record는 미선언 필드를 받을 수 없고 Jackson 관대 모드라 에러도 로그도 없이 `200`이 났다. `ExtractedEvent`에 필드 추가(구 13필드 호출부는 호환 생성자로 유지, `recurrence=null`), `DemoFixtures`의 카드 재구성 경로도 같은 방식으로 값을 흘리고 있어 같이 고쳤다
> - **서버 PDF 3면·4면에 반복 표기 반영.** 3면은 요약 뒤 `"(매월 12회)"` + 금액 뒤 `"(1회분)"`, 4면은 "확인된 일시" 열이 `recurrence.first ~ last` 전체 기간을 보이도록. 반영 전엔 첫 회차 금액·날짜만 보여 "12번 있었던 일"이 "1건"으로 오독됐다(같은 문서 안 소명서-타임라인 불일치도 있었음)

> **수정 기록 (2026-08-26 ⑦, 백엔드)** — 근거: `../request/backend/repeated-events-and-irrelevant-cards.md` §7 (프론트 실연동 신고)
> - **`occurred_at == null`도 `UNCONFIRMED_FIELDS` 차단 대상으로 확장.** 은행 앱이 연도를 안 보여주는 캡처(`08.19`)는 `occurred_at: null`이 정상 동작인데, 종전 "값이 `null`이면 신뢰도 안 읽는다" 규칙 때문에 확인 없이 그냥 통과했다. `amount == null`은 그대로 둔다(대화 캡처에 금액 없는 것은 정상) — `occurred_at`만 정보 누락으로 취급한다. `/api/readiness`·`/api/draft` 둘 다 적용

> **수정 기록 (2026-08-26 ⑥, 백엔드)** — 문서 반영 누락 자체 점검으로 발견
> - **`/api/intake`의 `dueNoticeDate` 형식(`YYYY-MM-DD`) 및 위반 시 `400 INVALID_FORM_FIELD`를 명시.** 이 검증은 이전부터 코드에 있었는데(`notified` + 값 없음) 계약서엔 한 번도 반영된 적이 없었고, 오늘 형식 검증(존재하지 않는 날짜 등)까지 추가하면서 갭이 커졌다

> **수정 기록 (2026-08-26 ⑤, 백엔드)** — 문서-구현 불일치 자체 점검으로 발견
> - **`/api/draft/revise`에서 `text`가 오면 "여전히 매칭되는지" 확인하지 않고 항상 `user_text`로 낮춘다고 정정** — 재검증(재-LLM 호출) 엔드포인트가 계약에 없어 이렇게 단순화해 구현했다(`backend/docs/phase-5-draft-package.md`에는 이미 기록돼 있었으나 이 계약서엔 반영이 안 돼 있었음). 종전 표는 "오타 수정처럼 여전히 매칭되면 `evidence` 그대로"라고 적혀 있었는데 실제 동작과 다르다. **프론트는 이미 서버 응답을 그대로 보고 배지를 정하는 구조라 영향 없음** (코드 확인 완료)
> - **`/api/draft` 응답 예시의 `checklist`가 2필드 구버전(`{ item, have }`)으로 남아 있던 것을 8필드 현행 스키마로 정정** — `/api/readiness`와 같은 스키마를 그대로 씀. 코드·프론트 모두 이미 신버전이라 동작 영향 없음, 문서만 낡아 있었음

> **수정 기록 (2026-08-26 ④, 백엔드)** — 근거: `../02-architecture/internal-api-contract.md` (AI-server 변경, `../request/ai/llm-provider-mismatch.md`)
> - **`AI_CONFIG_ERROR`(500) 오류 코드 신설** — AI-server 설정 오류(LLM 키 미설정·인증 실패)가 사용자에게 판독 실패로 보이지 않도록 분리. 재시도·텍스트 입력 유도 없음
> - **`EXTRACTION_FAILED`의 `fallback`이 이미지 경로에만 붙음을 명시** — 텍스트로 이미 보낸 요청에는 텍스트 입력을 다시 안내하지 않는다(메시지도 경로별로 분리)

> **수정 기록 (2026-08-26 ③, 백엔드)** — 근거: `../response/backend/local-integration-findings.md` (프론트 확인 질문)
> - **`intake` 카드의 `confirmation_status`가 항상 `user_confirmed`임을 명시** — 세션 타임라인에 저장되지 않고 매 조회마다 새로 합성돼 확인·게이팅 대상이 될 수 없다. 코드에도 "여기를 건드리면 이 불변조건을 깨지 않는지 확인하라"는 주석을 남겼다

> **수정 기록 (2026-08-26 ②, 백엔드)** — 근거: `../request/backend/local-integration-findings.md` (프론트 로컬 연동 회신)
> - **`source_type`에 `intake` 신설(7번째 값)** — 문진 지급정지일을 백엔드가 합성한 카드용. AI가 아니라 백엔드가 만드는 유일한 카드 출처다. `/api/timeline`과 서버 PDF 3면 둘 다에 포함하고(미리보기·제출본 일치), **4면(증빙목록)에서는 제외**한다 — 증빙자료가 아니라서다
> - **`/api/intake`가 전체 교체(PUT류) 의미임을 명시** — 이전엔 "일부 필드만 와도 정상"으로 문서화돼 있었는데, 프론트가 매번 문진 전체를 재전송하는 것으로 확인돼(로컬 연동 회신) 정정. `null`로 온 필드는 지운다
> - **`/api/package/text`의 `excludedSentenceIds`가 최종** — `/api/draft/revise`의 세션 상태(`excluded`)는 그 응답 배열에서만 쓰고, PDF 생성은 이 요청 값만 본다(프론트가 제외 토글마다 `revise`를 부르지 않아도 되게)
> - **`DRAFT_FAILED` 후에도 세션·확인된 카드는 그대로 유지됨을 확정** — `storeResult()`가 AI 호출 실패 시 전혀 실행되지 않는 구조라 원래도 그랬다
> - **AI-server 연결 자체가 안 되는 상황(URL 미설정 등)도 `EXTRACTION_FAILED`/`DRAFT_FAILED`(502)로 통일** — 종전엔 `400 INVALID_REQUEST` + 내부 예외 메시지 노출
> - CORS 프리플라이트(`OPTIONS`)가 세션 검사를 통과하지 못해 `500`이 나던 버그 수정 (계약 변경 아님, 구현 버그)
> - 기한 경과 시 `notice`가 "-56일 남았습니다"로 나가던 문구를 FR-014에 맞게 정정 (계약 변경 아님, 구현 버그)

> **수정 기록 (2026-08-26, 백엔드)** — Phase 5 구현
> - **`DRAFT_FAILED`(502) 오류 코드 신설** — `/api/draft`가 AI-server 재시도 1회 후에도 실패하면 이 코드로 내려간다
> - **`/api/draft/revise`의 `sentences` 응답에서 제외(`excluded:true`)된 문장은 배열 자체에서 빠진다** — 별도 플래그가 없는 계약이라, "최종 문서에서 빠질 문장"이라는 뜻을 배열에서 없애는 것으로 표현했다

> **수정 기록 (2026-08-25 ④, 백엔드)** — Phase 3 구현 중 계약에 없던 부분을 채움
> - **`POST /api/evidence`에 `imageIndex` 신설** — 1장씩 병렬 호출 시 응답 도착 순서가 원래 배열 순서와 달라, 프론트가 blob 배열 인덱스를 명시적으로 보내야 함
> - **`gaps` 항목 스키마 신설** (`type`/`label`/`suggestions`) — 계약에 `gaps: []`만 있고 내용이 없었음
> - **`/api/evidence/confirm`의 `confirmed: false` = 카드 삭제로 명시** — F4-06 처리 ④ "카드 삭제"에 대응하는 필드가 없었음
> - **병합 승인 시 구현 방식 명시** — 카드를 합치지 않고 대표만 `events`에 남기며 원본은 세션에 보존

> **수정 기록 (2026-08-25 ③, 백엔드)** — 근거: `../request/frontend/text-entry-ownership-and-masking.md`, `../request/backend/deploy-handoff.md`
> - **`/api/evidence/text`의 `rawText`는 프론트엔드가 전송 전 마스킹(주민번호·전화번호·계좌번호)을 마친 값** — FR-027 마스킹 주체 명시에 따른 정정
> - **`UNCONFIRMED_FIELDS` 게이팅은 값이 존재하는 카드에만 적용** — `amount`/`occurred_at`이 `null`인 카드의 `low` 신뢰도는 게이팅 근거로 읽지 않음

> **수정 기록 (2026-08-25 ②, 백엔드)** — 근거: 프론트 회신 5건 (`../response/backend/evidence-structure-revision.md`, `legal-form-and-package.md`, `honest-disclosure-fixes.md`, `draft-preview-and-edit.md`, `deployment-domain.md`)
> - **CORS 허용 origin에 프론트 프로덕션 도메인 추가** — `https://2026-finance-ai-challenge-tau.vercel.app` (프리뷰 와일드카드는 종전대로 불허)
> - **`checklist` 스키마 전면 개정** — `{ item, status }` 2필드 → `id`·`label`·`tier`·`fulfillBy`·`whenMissing`·`status`·`note`·`options`. **택일(OR) 표현**과 **미보유 효과 구분**이 종전 구조로는 불가능했습니다
> - **`POST /api/checklist/self-held` 신설** — 서비스가 받지 않는 자료(`fulfillBy: "self"`)의 보유 여부를 사용자 자가 진술로 받습니다
> - **`POST /api/draft/revise` 신설** — 소명서 문장 수정·제외. 수정 문장은 삭제하지 않고 `user_text`로 유지 + `warning`
> - **`/api/package/text` 요청 바디 8 → 11필드** (`mobile`·`email`·`holderName`) + **`excludedSentenceIds`** 추가
> - **면 구성 개정** — 부족자료 체크리스트를 **제출본에서 제외**, **제출 서류 목록 표지 신설**, **4면 증빙목록의 출처를 `checklist` → 확인된 증거 카드로 정정**(종전 표기가 6면을 뺀 의미를 무력화하고 있었습니다)
> - **`/api/intake`에 `deliveryMethod` 신설** — 직거래에 채울 수 없는 공백을 띄우던 문제
> - **`notices`가 서버 단일 소스**임을 명시 (법 조문 근거 문구, 프론트는 순화 없이 그대로 노출)

> **수정 기록 (2026-08-25, 백엔드)** — 근거: AI 회신 3건 (`../response/backend/card-source-type.md`, `payer-name-extraction.md`, `image-transfer-and-internal-auth.md`) 및 AI 요청 `../request/backend/draft-intake-input.md`
> - **`/api/evidence` 카드 스키마에 3개 필드 추가** — `source_type`(6종, `unknown` 포함), `counterparty_name`, `payer_name`. `field_confidence`에도 이름 2종 키 추가
> - **프론트 주의 사항 명시**: 두 이름 필드는 `null`이 흔하다(잘린 캡처·F3-06 마스킹) / **이름 대조 결과를 프론트가 계산하지 않는다** / 불일치를 경고색으로 칠하지 않는다 / `event_id`는 불투명 문자열
> - **`/api/draft` 응답에 `evidenceRefs.type` 3종 확정** (`evidence` / `intake` / `user_text`)과 **"본인 진술" 배지 규칙** 신설. `intake`·`user_text`에는 `imageIndex`가 없는 것이 정상
> - `bbox`가 **근사 좌표**임을 명시 — 정밀 하이라이트(P1)를 전제로 UI를 설계하지 않도록

> **수정 기록 (2026-08-24, 백엔드)** — 근거: `../response/backend/pdf-ownership-and-open-contracts.md` (프론트 회신)
> - `/api/package/text` **`GET` → `POST`** 확정 + 요청 바디 필드(`applicant`, `account` 8개) 정의 및 필수/선택 규칙 신설
> - `GET /api/timeline` 응답에 `mergeCandidates` 추가 + `POST /api/timeline/merge` 신설 (F5-02 승인 엔드포인트)
> - `/api/intake` 응답의 `notice`가 `date`/`daysLeft`가 `null`일 때도 **항상 내려간다**고 명시
> - `/api/evidence` **프론트 → 백엔드 동시 요청 상한 4** 확정 + multipart 크기 상한(파일당 10MB) 명시
> - **CORS 허용 origin·헤더** 절 신설 — `http://localhost:5173` 등록, 프리뷰 도메인 와일드카드 **불허** 확정
> - 매직바이트 검증을 **서버에서도 수행**한다고 명시

> **수정 기록 (2026-08-23, 백엔드)**
> - 세션 전달 방식 TODO 줄 → 커스텀 헤더 `X-Session-Hash` 확정으로 대체
> - 엔드포인트 표의 `/api/intake` 응답에 `deadline` 추가 + 아래 "`/api/intake` 응답 — 이의제기 기한" 절 신설 (FR-014 계산 주체를 백엔드로 확정)
> - `/api/session` 응답에 `demoMode` 추가 (F11-03 배지 노출용 — 프론트가 데모 모드를 알 방법이 계약에 없었음)
> - `/api/readiness` 응답에 `smallAmountNotice` 추가 (PRD §4.3 소액 안내 카드 — 전달 경로가 계약에 없었음)
> - FR-028 게이팅을 **백엔드도 서버 측에서 거부**하도록 명시 + `UNCONFIRMED_FIELDS` 오류 코드 신설
> - `/api/evidence` 파일별 진행 표시(F3-03) 호출 방식 명시 — 프론트가 1장씩 병렬 호출

> 출처: `../00-context/prd.md` §9, `../00-context/spec.md` §4. 이 문서가 프론트엔드와 백엔드 사이의 실제 계약입니다. 엔드포인트를 바꾸면 이 문서를 먼저 고치고 상대 역할에게 알리세요.
>
> 백엔드는 독립 배포되는 Spring Boot 서비스이며, AI 파이프라인(추출·소명서 생성)은 별도 배포되는 AI-server가 담당합니다(`system-architecture.md` 참조). 프론트엔드는 아래 공개 API만 호출하며, 백엔드↔AI-server 사이의 내부 API(`internal-api-contract.md`)는 직접 호출하지 않습니다.

## 엔드포인트 목록

| Method | Path | 설명 | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/session` | 세션 생성 | — | `{ sessionHash, expiresAt, demoMode }` |
| POST | `/api/intake` | 문진 저장 | `{ when, dueNoticeStatus, dueNoticeDate, amount, kind, history, usage, deliveryMethod }` | `{ ok, nextStage, deadline }` |
| POST | `/api/evidence` | 이미지 판독 (메모리 통과, 서버 미저장) | `multipart[]` **+ `imageIndex[]`**(2026-08-25 ③ 신설, 아래 참조) — 세션당 누적 최대 10장, 파일당 10MB, JPG/PNG, 클라이언트에서 리사이즈·마스킹 완료된 상태 | `{ cards: [...], signals, qualityFlags }` |
| POST | `/api/evidence/confirm` | 추출 카드 확인·수정 저장 (FR-028) | `{ cardId, confirmed, corrections }` | `{ ok, confirmedCount, unconfirmedCount }` |
| POST | `/api/evidence/text` | 텍스트 대체 입력. **`rawText`는 프론트가 전송 전 마스킹을 마친 값**(FR-027, 2026-08-25 확정) | `{ rawText }` | `{ cards: [...] }` |
| GET | `/api/timeline` | 타임라인 조회 | — | `{ events: [...], gaps: [...], mergeCandidates: [...] }` |
| POST | `/api/timeline/merge` | 중복 이벤트 병합 승인 (F5-02) | `{ mergeGroupIds, approved }` | `{ events: [...], gaps: [...], mergeCandidates: [...] }` |
| POST | `/api/checklist/self-held` | **직접 첨부 항목 자가 진술** (2026-08-25 신설) | `{ itemId, held }` | `{ checklist: [...] }` |
| POST | `/api/readiness` | 제출 준비도 점검 실행 | — | `{ reason, checklist, readiness, missingItems, conflicts, notices, smallAmountNotice, urgentAlert }` |
| POST | `/api/draft` | 소명서 생성 | — | `{ draftText, sentences: [{ sentenceId, text, evidenceRefs: [...] }], checklist: [...] }` |
| POST | `/api/draft/revise` | **소명서 문장 수정·제외** (2026-08-25 신설) | `{ sentences: [{ sentenceId, text? , excluded? }] }` | `{ sentences: [...], warning }` |
| POST | `/api/package/text` | 제출 패키지 텍스트 PDF 생성 (FR-047) | `{ applicant, account, excludedSentenceIds }` (별지 제4호서식 **11개 필드**, 서비스 미저장) | `application/pdf` |
| DELETE | `/api/session` | 세션 즉시 파기 | — | `204` |
| GET | `/actuator/health` | 헬스체크 (킵얼라이브용, DB 활동 포함) | — | `{ status: "UP", db: "OK" }` |

세션은 **커스텀 헤더 `X-Session-Hash`** 로 전달되는 `sessionHash`로 식별됩니다(2026-08-23 확정). 쿠키를 사용하지 않으므로 프론트엔드는 `credentials: 'include'`가 필요 없고, 백엔드는 CORS 허용 헤더에 `X-Session-Hash`를 포함합니다. 프론트(정적 호스팅)와 백엔드(Render)의 도메인이 달라 크로스오리진 쿠키의 `SameSite=None; Secure` 및 브라우저 추적 방지 정책 리스크를 피하기 위한 결정입니다.

### CORS 허용 origin·헤더 (2026-08-24 확정)

| 항목 | 값 |
| --- | --- |
| 허용 origin | `http://localhost:5173` (Vite 개발 서버)<br>**`https://2026-finance-ai-challenge-tau.vercel.app`** (프론트 프로덕션, 2026-08-25 확정) |
| 허용 헤더 | `Content-Type`, `X-Session-Hash` |
| 허용 메서드 | `GET`, `POST`, `DELETE`, `OPTIONS` |
| `credentials` | 사용하지 않음 (쿠키 미사용) |

> **origin 끝에 슬래시를 붙이지 마세요.** origin 비교는 문자열 일치라 `https://….app/`은 매칭되지 않습니다. 프론트 배포 정보: `../response/backend/deployment-domain.md`.

**프리뷰 도메인 와일드카드는 허용하지 않습니다.** Vercel/Netlify가 브랜치마다 만드는 프리뷰 서브도메인에 `*` 패턴을 열면 임의의 브랜치·포크 배포에서 이 API를 호출할 수 있게 됩니다. 프론트는 **프로덕션 도메인 1개 + `localhost:5173`** 만 사용하고, 프리뷰 확인은 로컬로 대체합니다(프론트 회신에서 "후자여도 문제없다"고 확인됨).

프론트 배포 도메인은 아직 미정입니다(프론트 과제, 기한 9/5 — `../03-infra-ops/deployment-and-uptime.md`). 확정되면 위 표에 추가하고 백엔드 설정에 반영합니다.

`/api/session` 응답의 **`demoMode`** 는 서버의 `DEMO_MODE` 환경변수 값입니다. `true`이면 프론트엔드는 모든 화면 상단에 **"예시 데이터 사용 중 — 실제 AI 분석 결과가 아닙니다"** 배지를 고정 표시합니다(`../00-context/spec.md` F11-03). 이때 백엔드는 AI-server를 호출하지 않고 사전 저장된 응답 세트를 반환합니다.

## `/api/evidence` 호출 방식 — 파일별 진행 표시 (F3-03)

`/api/evidence`는 multipart 배열을 받지만, **프론트엔드는 이미지를 1장씩 병렬로 호출합니다**(2026-08-23 확정). 응답이 도착하는 순서대로 파일별 "읽음 / 실패"를 칠 수 있어 F3-03의 "파일별 처리 상태를 순차 표시"를 별도 SSE·폴링 인프라 없이 만족합니다. AI-server도 이미지별 병렬 호출(최대 4 동시)이 전제입니다(F4-01).

백엔드는 호출이 나뉘어도 **세션당 누적 10장 제한**을 유지합니다(F3-02 검증 ④). 11장째는 `400`입니다.

### `imageIndex` — 프론트가 명시적으로 보냅니다 (2026-08-25 ③ 신설, 계약 보완)

`internal-api-contract.md`의 `image_index`가 "프론트 blob 배열 인덱스와 일치해야 한다"고 못 박고 있는데, **1장씩 병렬(최대 4 동시) 호출하면 응답이 도착하는 순서가 원래 배열 순서와 달라집니다.** 백엔드가 도착 순서로 인덱스를 매기면 프론트의 블롭 배열과 어긋나므로, **프론트가 각 파일과 함께 그 파일의 원래 blob 배열 인덱스(0-base)를 `imageIndex` 필드로 보냅니다.**

```
POST /api/evidence
Content-Type: multipart/form-data

files: <이미지 바이트>
imageIndex: 2
```

- `files`와 `imageIndex`는 **같은 순서로 쌍을 이룹니다.** 여러 장을 한 요청에 담더라도 개수가 같아야 합니다(`400` + `INVALID_REQUEST`)
- 백엔드는 이 값을 그대로 `/internal/extract?image_index={n}`에 전달합니다 — 자체적으로 순번을 새로 매기지 않습니다

### 동시 요청 상한 — **4** (2026-08-24 확정)

프론트엔드는 `/api/evidence`를 **동시 4개까지만** 호출합니다. 10장이면 4 → 4 → 2로 끊어 보냅니다.

- 백엔드 → AI-server 구간이 이미 최대 4 동시이므로(F4-01), 프론트가 10장을 한꺼번에 던져도 백엔드에서 큐가 쌓일 뿐 처리량은 늘지 않습니다.
- Render 인스턴스는 **512MB RAM / 0.1 CPU**입니다(`../03-infra-ops/deployment-and-uptime.md`). 1600px PNG 10장을 동시에 메모리로 받으면 OOM 위험이 있습니다 — 이미지는 서버에 저장되지 않고 메모리로만 통과하기 때문에(F3-01 개발 주의) 동시 개수가 곧 메모리 점유입니다.
- 상한을 넘겨 도착한 요청도 백엔드는 **거부하지 않고 큐잉**합니다. 4는 거부선이 아니라 프론트가 지켜야 할 발신 상한입니다.

### 업로드 크기 상한

| 항목 | 값 | 비고 |
| --- | --- | --- |
| 파일당 | 10MB | F3-02 검증 ③ |
| 요청당 | 10MB | 1장씩 호출하므로 파일당 상한과 같음 |
| 포맷 | JPG / PNG | 프론트는 **PNG**로 보냅니다 (텍스트가 많은 캡처라 JPEG 링잉이 판독에 불리) |

프론트가 `spec.md` F3-01 처리 ①(장변 1600px 리사이즈)을 적용하면서 장당 페이로드가 300KB~1MB로 커졌습니다. **Spring Boot 기본값 `spring.servlet.multipart.max-file-size`는 1MB**이므로 그대로 두면 정상 이미지가 `400`으로 떨어집니다. 백엔드는 아래 값을 설정합니다.

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
```

Render 프록시의 요청 바디 상한도 함께 확인합니다(`../03-infra-ops/deployment-and-uptime.md` 백엔드 체크리스트).

### 파일 검증 주체

F3-02의 검증 4종(확장자 화이트리스트 / 매직바이트 / 파일당 10MB / 세션당 10장)은 **프론트와 백엔드가 모두 수행**합니다. 프론트 검증은 사용자 실수를 즉시 알리기 위한 것이고, **확장자를 위조한 파일을 실제로 막는 것은 서버 몫**입니다(F3-02 수용 기준).

## `/api/intake` 요청 필드 정의

문진은 **6개 항목 + 물품 거래일 때만 1개 추가**입니다(`../00-context/spec.md` F2-01).

| 필드 | 타입 | 값 | 비고 |
| --- | --- | --- | --- |
| `when` | string \| null | 지급정지일 (날짜, 모르면 null) | **FR-014 기한 계산 입력** |
| `dueNoticeStatus` | enum | `notified` \| `not_yet` \| `unknown` | 채권소멸절차 개시 공고 상태. `notified`면 `dueNoticeDate` 필요 |
| `dueNoticeDate` | string \| null | 공고일 (`YYYY-MM-DD`) | **FR-014 기한 계산 입력** — 기한 = 공고일 + 2개월. `dueNoticeStatus == notified`인데 값이 없거나 형식이 안 맞으면(존재하지 않는 날짜 포함) `400` + `INVALID_FORM_FIELD` (2026-08-26 명시) |
| `amount` | number \| null | 문제 입금액 (원 단위, 모르면 null) | **사실 기재 전용.** 준비도 판정에 사용하지 않음 (`../01-product/reason-type-rules.md` §3) |
| `kind` | enum | `goods` \| `service` \| `debt` \| `unclear` | 사유유형 4종에 대응 |
| `history` | boolean | 과거 지급정지 이력 여부 | `은행기준미상` 신호의 입력값 |
| `usage` | enum | `main` \| `occasional` \| `rare` | 생계 흔적 증빙 점검 보조 |
| **`deliveryMethod`** | enum \| null | `courier` \| `in_person` \| `not_applicable` \| null | **거래 방식** (2026-08-25 신설). `kind !== "goods"`면 `null` |

### `deliveryMethod` — 직거래를 위한 필드 (2026-08-25 신설)

**직거래는 송장이 원래 없습니다.** 그런데 F5-03 공백 탐지 규칙 ①이 `delivery_evidence == false` + 재화 거래를 곧바로 "발송 증빙 없음" 공백으로 판정하고, `delivery` 판단 기준은 **"송장·발송 기록"**(F4-02)입니다. 이대로 구현하면 **직거래 사용자에게 채울 방법이 없는 공백을 영원히 띄우고 준비도를 깎습니다.**

| 값 | 뜻 | 백엔드 처리 |
| --- | --- | --- |
| `courier` | 택배 | 종전대로 — 송장·발송 기록으로 판정 |
| **`in_person`** | **직거래(대면)** | **F5-03 ①의 "발송 증빙 없음" 공백을 띄우지 않습니다.** 체크리스트의 `goods.delivery` 라벨도 물품 사진·거래 장소·대면 인도 정황으로 바뀝니다 |
| `not_applicable` | 해당 없음 | 공백 판정 제외 |
| `null` | 물품 거래가 아니거나 미응답 | 종전 규칙 그대로 |

- **물품 거래일 때만 묻습니다.** 용역·채권 회수에는 배송 개념이 없어 "해당 없음"만 고르게 되는 문항이 하나 생깁니다. 프론트는 `kind` 바로 다음에 조건부로 노출합니다 — 물품이면 7문항, 나머지는 6문항.
- **B안(증거 유형 추가)을 쓰지 않은 이유**: 자료를 올린 뒤에야 직거래인 걸 알게 되어, F3-07이 풀려던 "다 올린 뒤에 알게 되는" 문제가 그대로 남습니다. 문진에서 확정하면 **업로드 전에** 무엇을 준비할지 안내할 수 있습니다.

## `/api/intake` 응답 — 이의제기 기한 (FR-014)

기한 계산은 **백엔드가 수행**합니다(2026-08-23 확정). 법 제7조 제1항 근거의 안내 문구이므로 서버가 단일 소스로 산출하며, 프론트엔드는 `notice`를 **그대로 노출하고 순화하지 않습니다**.

```json
{
  "ok": true,
  "nextStage": 2,
  "deadline": {
    "date": "2026-11-01",
    "daysLeft": 42,
    "notice": "이의제기 기한까지 42일 남았습니다. (2026-11-01)"
  }
}
```

공고일이 없으면 `date`와 `daysLeft`는 `null`입니다. **`notice`는 어떤 경우에도 `null`이 되지 않습니다** — `date`/`daysLeft`가 `null`일 때는 "공고일을 모르는 경우"에 해당하는 문구가 대신 들어갑니다(2026-08-24 확인). 프론트엔드는 `notice`가 항상 존재한다는 전제로 화면을 구성해도 됩니다.

분기별 문구는 `../00-context/prd.md` §4.1의 의사코드를 그대로 따릅니다. 기한 경과가 확실한 경우에도 "불가능"이라고 단정하지 않습니다.

> **2026-08-26 반영** — 프론트 신고 `../request/backend/recurrence-not-reaching-frontend.md`. `recurrence`는 `internal-api-contract.md`(2026-08-26 ③, AI)에서 AI-server가 이미 내보내고 있었는데, 이 문서와 백엔드 `ExtractedEvent`에 반영이 안 돼 `record`가 조용히 필드를 버렸습니다(에러도 로그도 없이 `200`). 이번에 계약·`ExtractedEvent`·PDF 3면·4면 전부 반영했습니다.

## `/api/evidence` 응답 — 추출 카드 스키마 (FR-021, FR-028)

```json
{
  "cards": [
    {
      "event_id": "evt_2_1",
      "source_image_index": 2,
      "source_type": "chat | bank | shipping | threat | autopay | unknown | intake",
      "occurred_at": "2026-09-02T14:12:00+09:00",
      "actor": "self | counterparty | system",
      "summary": "물품대금 700,000원 입금",
      "amount": 700000,
      "counterparty_name": "김OO",
      "payer_name": null,
      "recurrence": null,
      "identifiers": { "tracking_no": null, "account_last4": null },
      "field_confidence": {
        "occurred_at": "high | medium | low",
        "actor": "high | medium | low",
        "amount": "high | medium | low",
        "counterparty_name": "high | medium | low",
        "payer_name": "high | medium | low"
      },
      "source_region": { "x": 0.18, "y": 0.31, "w": 0.62, "h": 0.12 },
      "confirmation_status": "pending | user_confirmed | user_corrected"
    }
  ],
  "signals": {
    "threat_detected": false,
    "delivery_evidence": true,
    "life_activity": false,
    "quality_flags": { "blurry": false, "missing_date": false, "amount_mismatch": false }
  },
  "qualityFlags": {
    "evt_2_1": { "blurry": false, "missing_date": false, "amount_mismatch": false }
  }
}
```

`signals.threat_detected: true`가 오면 프론트엔드는 즉시 협박 대응 배너(FR-024)를 노출해야 합니다 — 사용자가 다음 단계로 넘어가길 기다리지 않습니다.

### 2026-08-25 추가된 3개 필드

| 필드 | 프론트가 쓰는 곳 |
| --- | --- |
| `source_type` | 카드 유형 배지. 값은 `chat / bank / shipping / threat / autopay / unknown / intake` 7종. `unknown`은 정상 값입니다(AI가 추측하지 않고 내린 값) — 오류로 처리하지 마세요. **`intake`는 AI가 아니라 백엔드가 문진 응답(지급정지일)으로 합성한 카드**입니다(`event_id: "evt_intake_when"`, `source_image_index: null`) — `/api/timeline`과 서버 PDF 3면에는 있지만 **4면(증빙목록)에는 없습니다**. `source_type`으로 걸러내세요(`event_id` 문자열 파싱 금지). **`confirmation_status`는 항상 `user_confirmed`로 고정**입니다 — 이 카드는 세션 타임라인에 저장되지 않고 매 조회마다 새로 합성되므로 `/api/evidence/confirm`이나 readiness 게이팅 대상이 될 수 없습니다(2026-08-26 ③ 확정) |
| `counterparty_name` | 확인 카드(F4-06)에 **수정 가능한 필드로 노출**. 대화 상대 표시명 |
| `payer_name` | 같음. 입금 내역의 입금자 표기 |

### `recurrence` — 반복 거래를 카드 한 장으로 (2026-08-26 신설, 계약 반영 지연분)

```json
"recurrence": { "count": 12, "period": "monthly | weekly | daily | other", "first": "2026-01-15T09:00:00+09:00", "last": "2026-12-15T09:00:00+09:00" }
```

`internal-api-contract.md`와 같은 모양입니다. 반복이 아닌 카드는 `null`(대부분이 `null`)입니다. **`amount`는 총액이 아니라 1회분**이고, `occurred_at`은 `recurrence.first`와 같습니다(첫 회차) — `recurrence.last`가 마지막 회차입니다.

- **F4-06 확인 카드**: 프론트는 이미 반영을 마쳤습니다(칩 "매월 · 12회" 배지, 금액 행을 "금액 (1회분)"으로, "2025.09.15부터 2026.08.15까지 12회예요" 문구). `recurrence`가 `null`이면 지금과 같은 단발성 카드로 그립니다.
- **서버 PDF 3면(타임라인)**: 요약 뒤에 `"(매월 12회)"`를 붙이고, 금액 뒤에 `"(1회분)"`을 붙입니다 — 12번 있었던 일이 "6만원짜리 거래 1건"으로 안 읽히게 합니다.
- **서버 PDF 4면(증빙목록)**: "확인된 일시" 열이 첫 회차 하나가 아니라 `recurrence.first ~ recurrence.last` 전체 기간을 보여주고, 요약 뒤에 `"(매월 12회, 1회분 65,890원)"`을 붙입니다.
- `count`는 **AI-server가 계산한 값을 그대로 신뢰**합니다 — 백엔드·프론트 어느 쪽도 재계산하지 않습니다.

- **두 이름 필드는 `null`이 흔합니다.** 상단바를 자른 캡처, F3-06으로 사용자가 가린 경우 모두 `null`입니다. `null`을 "읽기 실패"로 표시하지 말고 **빈 칸으로 두고 사용자가 채울 수 있게** 해주세요.
- **대조 결과를 프론트가 계산하지 않습니다.** 이름 일치 여부 판단은 백엔드 몫이고, 그 결과는 `/api/readiness` 응답으로 옵니다. 불일치는 위험 신호가 아니라 "설명이 필요한 항목"이므로 경고색으로 칠하지 마세요 — 닉네임과 실명이 다른 것은 정상입니다.
- `event_id`는 **불투명 문자열**입니다. 형식(`evt_{n}_{m}`)을 파싱해 의미를 꺼내 쓰지 마세요.

날짜 또는 금액이 `low` 신뢰도인 카드가 `confirmation_status: "pending"`으로 남아 있으면, 프론트엔드는 Stage 3(`/api/readiness`) 진입을 차단하고 확인을 요구합니다(FR-028).

**`occurred_at == null`도 같은 차단 대상입니다** (2026-08-26 정정 — `../request/backend/repeated-events-and-irrelevant-cards.md` §7). 은행 앱이 연도를 표시하지 않는 캡처(예: `08.19`)에서는 `occurred_at`이 `null`로 정직하게 내려가는 것이 정상 동작인데, 종전 규칙("값이 `null`인 필드의 신뢰도는 읽지 않는다")을 그대로 적용하면 이 카드가 확인 없이 그냥 통과했습니다. `amount == null`과는 성격이 다릅니다 — 대화 캡처에 금액이 없는 것은 정상이지만, **입출금 카드에 날짜가 없는 것은 정보 누락**이므로 `low` 신뢰도와 동급으로 차단합니다. `amount`는 종전 규칙 그대로입니다(`null`이면 차단 안 함).

**백엔드도 서버 측에서 같은 조건을 검사해 `/api/readiness`·`/api/draft`를 거부합니다**(2026-08-23 확정, `409` + `UNCONFIRMED_FIELDS`; 2026-08-26 `occurred_at == null` 포함하도록 확장). 프론트 차단은 사용자 경험, 서버 거부는 데이터 무결성 목적입니다 — 확인되지 않은 low 신뢰도·누락 날짜로 준비도가 산출되면 틀린 서류가 은행에 제출됩니다(F4-06 필요성). 그 외 미확인 카드는 서버도 통과시키며, 준비도 산출 입력에서 제외될 뿐입니다(F6-03).

## `/api/evidence/confirm` 요청

```json
{
  "cardId": "evt_001",
  "confirmed": true,
  "corrections": { "amount": 700000 }
}
```

`confirmed: true`인 카드만 `ReadinessService`와 `/api/draft`(DraftService)의 입력으로 사용됩니다. 사용자가 값을 고치면 백엔드는 해당 카드에 "사용자 수정" 표시를 남깁니다.

**`confirmed: false`는 카드 삭제입니다** (2026-08-25 ③ 명시 — `spec.md` F4-06 처리 ④ "카드 삭제 가능"에 대응하는 필드가 계약에 따로 없어 이 값으로 구현). `corrections`는 `confirmed: true`일 때만 의미가 있습니다.

## `/api/timeline` 응답 — 증거 공백 (F5-03/F5-04, 2026-08-25 ③ 스키마 신설)

`gaps: []`만 있고 항목 스키마가 계약에 없어 구현하며 정의했습니다.

```json
{
  "type": "no_delivery_evidence",
  "label": "발송 증빙 없음",
  "suggestions": ["택배사 조회 화면", "수령 확인"]
}
```

| `type` | 조건 | `label` | `suggestions` |
| --- | --- | --- | --- |
| `no_delivery_evidence` | `delivery_evidence == false` + `kind == "goods"` + `deliveryMethod != "in_person"` | 발송 증빙 없음 | 택배사 조회 화면 · 수령 확인 |
| `no_service_evidence` | `delivery_evidence == false` + `kind == "service"` | 용역 증빙 없음 | 결과물 파일 · 전달 기록 |
| `no_life_activity` | `life_activity == false` + `usage != "main"` | 생계 흔적 없음 | (없음) |
| `no_chat_evidence` | `chat` 유형 카드 없음 | 거래 합의 증빙 없음 | 이메일 · 문자 · 통화 기록 |

**`deliveryMethod == "in_person"`이면 `no_delivery_evidence`를 아예 띄우지 않습니다** — 직거래는 송장이 원래 없어 채울 방법이 없는 공백이 되기 때문입니다(F5-03 직거래 예외). 이때의 "물품 사진·거래 장소·대면 인도 정황" 제안은 이 공백-대체 제안 목록이 아니라 **Phase 4 체크리스트**의 `goods.delivery` 라벨 쪽입니다 — 서로 다른 기능입니다.

## `/api/timeline` 응답 — 병합 후보 (F5-02)

```json
{
  "events": [],
  "gaps": [],
  "mergeCandidates": [
    {
      "groupId": "mg_001",
      "eventIds": ["evt_003", "evt_007"],
      "reason": "시각 차 2분 · 금액 700,000원 일치 · actor 동일"
    }
  ]
}
```

`mergeCandidates`는 **판단 결과가 아니라 제안**입니다. 백엔드는 두 가지 규칙으로 후보만 산출하고 **자동 병합하지 않습니다** — `reason`은 사용자에게 그대로 보여줄 수 있는 문장입니다. 왜 같은 사건으로 보이는지 설명 없이 병합을 승인받아서는 안 됩니다.

1. **시각 창(F5-02 원안)**: 시각 차 5분 이내 + 금액 일치 + `actor` 동일. "같은 사건이 몇 분 사이에 두 번 캡처된 경우"를 겨냥합니다.
2. **반복 포함(2026-08-27 신설)**: `recurrence`가 있는 카드의 `[first, last]` 구간에 같은 `actor`·금액·`source_type`인 단발 카드가 들어오면 후보로 잡습니다. "다른 캡처에 찍힌 같은 정기 거래"(예: 입출금내역과 자동이체내역에 같은 자동이체가 중복 등장)를 겨냥합니다 — 시각 차가 아니라 포함 관계라 `MERGE_WINDOW`를 넓히지 않고도 잡습니다. **단발 카드에 `occurred_at`이 없으면(연도 미상 캡처) 판정이 불가능해 후보에서 빠집니다** — `../request/backend/cross-image-duplicates-and-extract-anchor.md` §1.

후보가 없으면 빈 배열입니다.

## `/api/timeline/merge` — 병합 승인 (F5-02)

```json
{
  "mergeGroupIds": ["mg_001"],
  "approved": true
}
```

- `mergeGroupIds`는 `mergeCandidates[].groupId`의 배열입니다. 여러 그룹을 한 번에 승인할 수 있습니다.
- `approved: false`면 해당 후보를 **거절**한 것으로 기록하고 이후 응답의 `mergeCandidates`에서 제외합니다. 이벤트는 그대로 둡니다.
- 응답은 갱신된 타임라인 전체(`GET /api/timeline`과 같은 형태)입니다. 프론트엔드는 응답으로 화면을 통째로 갱신하면 됩니다.
- 병합된 이벤트는 **출처를 둘 다 기록**합니다(F5-02 처리). 어느 캡처에서 나왔는지가 F7-05 문장-근거 연결의 입력이기 때문입니다.

**승인 시 구현 방식 (2026-08-25 ③ 명시)**: 두 카드를 하나로 합치지 않습니다. `occurred_at`이 가장 이른 카드를 대표로 남기고, 나머지는 **`events` 목록에서만 빼서 화면에 중복으로 안 보이게** 합니다 — 원본 카드 자체는 세션에 그대로 남아 있어 F7-05 근거 연결에서 계속 찾을 수 있습니다.

> **스코프 컷 시 동작** — F5-02는 스코프 컷 순서 4번입니다(`../00-context/spec.md` §9). 컷하면 백엔드는 `mergeCandidates`를 **항상 빈 배열로** 내리고 `/api/timeline/merge`를 구현하지 않습니다. 프론트엔드는 빈 배열이면 병합 후보 UI를 렌더하지 않으므로, 어느 쪽을 컷해도 상대를 기다리지 않습니다. **컷 결정이 나면 `../response/frontend/`에 회신합니다.**

## `/api/checklist/self-held` — 직접 첨부 항목 자가 진술 (2026-08-25 신설)

체크리스트 항목 중 `fulfillBy: "self"`인 것(신분증 사본, 재직증명서, 소득금액증명원 등)은 **서비스에 올리지 않는 자료**라 서버가 보유 여부를 알 방법이 없습니다. 그런데 TC-02는 재직 증빙 미보유를 `SUPPLEMENT_NEEDED`로 요구하므로 **누군가는 "없다"고 말해줘야** 합니다. 사용자가 화면에서 "챙겼어요"를 체크하고, 그 값을 여기로 보냅니다.

```json
POST /api/checklist/self-held
{ "itemId": "service.employment.insurance", "held": true }

→ 200 { "checklist": [ /* 갱신된 전체 체크리스트 */ ] }
```

| 항목 | 내용 |
| --- | --- |
| `itemId` | 단일 항목의 `id` **또는 택일 그룹의 옵션 `id`** |
| `held` | `true`면 해당 항목이 `met`, `false`면 `unmet` |
| 응답 | **갱신된 전체 체크리스트.** 택일 그룹은 옵션 하나가 `met`이 되면 그룹 상태도 함께 바뀌므로, 부분 갱신이 아니라 전체를 다시 내립니다 |

- **별도 엔드포인트로 둔 이유**: 체크리스트를 쓰는 화면이 **Stage 3(`/api/readiness`)과 Stage 4(`/api/draft`) 둘**입니다. `/api/readiness` 요청 바디에만 실으면 서버에 남지 않아 `/api/draft`가 그 값을 모르고, **두 화면이 서로 다른 체크리스트를 보게 됩니다.**
- **이 값은 사용자 자가 진술이지 서류 자체가 아닙니다.** 세션에만 두고 **PDF·로그에 남기지 않습니다.**
- 존재하지 않는 `itemId`면 `400` + `INVALID_REQUEST`.

## `/api/readiness` 응답

```json
{
  "reason": "goods | service | debt | unclear",
  "checklist": [
    {
      "id": "service.employment",
      "label": "일한 사실을 보이는 서류",
      "tier": "fss",
      "fulfillBy": "self",
      "whenMissing": "blocks",
      "status": "met",
      "note": "이 중 하나만 있으면 돼요. 정부24·건강보험공단에서 바로 뗄 수 있어요.",
      "options": [
        { "id": "service.employment.insurance",   "label": "건강보험 자격득실 확인서", "status": "met" },
        { "id": "service.employment.certificate", "label": "재직증명서",             "status": "unmet" }
      ]
    }
  ],
  "readiness": "SUBMISSION_READY | SUPPLEMENT_NEEDED | BANK_CHECK_REQUIRED",
  "missingItems": ["물품 발송 증빙"],
  "conflicts": [],
  "notices": ["최종 판단은 은행이 합니다"],
  "smallAmountNotice": "특정 소액 입금 건은 금융회사 판단에 따라 간소화된 일부지급정지 절차가 적용될 수 있습니다. 정확한 금액 기준과 적용 여부는 해당 금융회사에 확인해야 합니다.",
  "urgentAlert": false
}
```

### `checklist` 항목 스키마 (2026-08-25 전면 개정)

종전 `{ item, status }` 2필드를 대체합니다. 의미 정의의 단일 출처는 `../01-product/reason-type-rules.md` §3-2이고, 여기는 **전송 형식**입니다.

| 필드 | 타입 | 내용 |
| --- | --- | --- |
| `id` | String | `"goods.trade_doc"` — **불투명 문자열.** 파싱해 의미를 꺼내지 마세요 |
| `label` | String | **화면에 그대로 노출** |
| `tier` | enum | `legal` / `fss` / `common` / `supporting` — ①②③④ (근거 출처) |
| `fulfillBy` | enum | `upload`(올리는 캡처) / `self`(은행에 직접 첨부) / `derived`(서버가 뽑아 채움) |
| `whenMissing` | enum | `blocks`(준비도 깎음) / `notice`(문구만) / `silent`(표시 안 함) |
| `status` | enum | `met` / `unmet` / `unknown` / `needs_explanation` |
| `note` | String? | 있으면 **화면에 그대로 노출**하는 보조 문구 |
| `options` | array? | **택일 그룹.** 있으면 하나라도 `met`일 때 그룹 전체가 `met` |

**원소는 항상 같은 모양입니다** — 단일 항목은 `options`가 없을 뿐입니다. 프론트가 분기 없이 그릴 수 있게 하기 위한 형태입니다.

> **`sources`는 응답에 들어가지 않습니다** (2026-08-25 확인). 프론트 참조 구현(`frontend/src/types.ts`의 `ChecklistEntry`)에는 "이 항목을 채우는 업로드 자료가 무엇인가"를 담은 `sources: EvidenceId[]`가 있는데, 이건 **목에서 `status`를 계산하기 위한 입력**입니다. 실제로는 **서버가 확인된 카드로 `status`를 계산해서 내려주므로** 프론트가 이 값을 받을 이유가 없습니다.
>
> 프론트는 `sources`를 **카탈로그(로컬 상수) 쪽에만 두고, API 응답 타입에서는 빼거나 optional로** 두세요. 응답에 있을 거라 기대하고 렌더에 쓰면 실제 연동 시 `undefined`가 됩니다.

**프론트가 지킬 것**

- **미보유에 붉은색을 쓰지 않습니다.** `blocks`만 주의색, 나머지 미보유는 중립색입니다. 채울 수 없는 항목까지 경고로 칠하면 서비스가 사용자를 탓하는 화면이 됩니다
- **`whenMissing: "silent"` + 미보유는 배지 자체를 렌더하지 않습니다** (사업자등록증, 차용증 등)
- **`needs_explanation`·`unknown`은 중립색**입니다 — "설명 필요" / "확인 불가". `needs_explanation`은 구매자–송금인 불일치인데, **위험 신호가 아니며 준비도를 깎지 않습니다**
- `fulfillBy: "self"` 항목은 서버가 보유 여부를 알 수 없어 **사용자가 체크**합니다 (`POST /api/checklist/self-held`)

### `notices` — 서버가 단일 소스입니다 (2026-08-25 확정)

법 조문 근거 문구(법 제8조 제2항 등)는 **서버가 문자열로 내려주고, 프론트는 순화하지 않고 그대로 노출**합니다. FR-014의 `deadline.notice`를 그렇게 정한 것과 같은 이유입니다.

- 세 상태 공통으로 **"최종 판단은 은행이 합니다"** 와 **F6-05 업무처리 기간 안내**(5영업일 심사 통보 vs 2개월 지급정지 유지 — 아래 고정 문구)가 항상 포함됩니다 — 프론트는 이 두 문구를 생략하지 않습니다 (2026-08-26 명시)
- **심사 결과 통보와 지급정지 해제를 분리한 문장**으로 씁니다 (`../00-context/spec.md` F6-05). 둘은 다른 시점입니다
- 구매자–송금인 불일치 안내("이 차이를 소명서에 설명해야 한다")도 **서버가 씁니다** — `checklist[].note` 또는 `notices` 중 하나로. 대조 결과를 아는 쪽이 문구를 쓰는 것이 맞습니다
- `../01-product/reason-type-rules.md` §4·§4-1의 금지 문구 원칙이 이 문자열에 그대로 적용됩니다

- `readiness`가 `BANK_CHECK_REQUIRED`일 때 프론트엔드는 `../01-product/reason-type-rules.md` §4에 정의된 정직한 안내 문구를 그대로 노출합니다. 낙관적으로 순화하지 않습니다.
- `smallAmountNotice`는 **판정이 아니라 정보 제공**입니다(PRD §4.3 소액 안내 카드). 고정 문구이며 입금액에 따라 문구가 달라지지 않습니다 — 소액 여부를 서비스가 판정하지 않기 때문입니다(§14 OI-01). 프론트엔드는 이 문구를 "소액에 해당하니 유리하다"처럼 단정적으로 바꾸지 않습니다.
- `urgentAlert`는 협박 감지 여부이며 `readiness`와 독립적으로 산출됩니다.

## `/api/draft` 응답 — 문장-근거 연결 (FR-046)

```json
{
  "draftText": "...",
  "sentences": [
    {
      "sentenceId": "s1",
      "text": "2026년 9월 1일 물품대금 450,000원을 입금받았습니다.",
      "evidenceRefs": [
        { "type": "evidence", "imageIndex": 2, "bbox": { "x": 0.18, "y": 0.31, "w": 0.62, "h": 0.12 } }
      ]
    },
    {
      "sentenceId": "s2",
      "text": "이 계좌는 급여 수령과 공과금 자동이체에 사용하는 주 거래 계좌입니다.",
      "evidenceRefs": [ { "type": "intake" } ]
    }
  ],
  "checklist": [
    {
      "id": "goods.chat_evidence",
      "label": "거래 대화 캡처",
      "tier": "common",
      "fulfillBy": "upload",
      "whenMissing": "blocks",
      "status": "met",
      "note": null,
      "options": null
    }
  ]
}
```

> `checklist`는 `/api/readiness` 응답과 **같은 스키마**입니다("`checklist` 항목 스키마" 절 참조) — `/api/draft`가 별도로 계산하지 않고 `ReadinessService`가 만든 값을 그대로 씁니다. 위 예시는 2026-08-25 ②의 8필드 개정 전 구버전(`{ item, have }`)이 남아 있던 것을 정정했습니다(2026-08-26 ⑤).

`evidenceRefs`는 **이미지 파일이 아니라 참조(imageIndex, bbox)만** 담습니다. 원본 이미지는 서버에 없으므로, 프론트엔드가 자기 브라우저 메모리의 blob 배열에서 `imageIndex`로 찾아 표시하고 `bbox`가 있으면 해당 영역으로 스크롤합니다. 원본이 메모리에 없으면(새로고침 등) 배지를 회색 처리하고 "원본을 다시 올리면 확인할 수 있습니다"를 표시합니다.

### `evidenceRefs.type` — 근거 유형 3종과 "본인 진술" 배지 (2026-08-25 확정)

FR-045가 정의한 근거 유형 셋과 1:1로 대응합니다. **`type`은 항상 존재합니다.**

| `type` | 의미 | 함께 오는 필드 | 프론트 렌더 |
| --- | --- | --- | --- |
| `evidence` | 업로드한 이미지에서 추출된 카드가 근거 | `imageIndex`, `bbox` | 원본 이동 배지 (F7-05) |
| `intake` | 문진 응답이 근거 | 없음 | **"본인 진술" 배지** |
| `user_text` | 텍스트 직접 입력(F3-04) 카드가 근거 | 없음 | **"본인 진술" 배지** |

- **`imageIndex`가 없다고 오류로 처리하지 마세요.** `intake` / `user_text`는 원래 이미지 참조가 없습니다 — 이 둘에 원본 이동 배지를 붙이면 클릭했을 때 갈 곳이 없습니다.
- 자료 0건 경로(TC-06)에서는 **모든 문장이 `intake`** 이므로 전 문장에 "본인 진술" 배지가 붙습니다. 이것이 정상 동작이며, PRD가 요구하는 정직성 표기입니다.
- `bbox`는 LLM 비전이 낸 **근사 좌표**입니다. 이미지를 열고 해당 위치로 스크롤하는 용도(P0)로는 충분하지만, **픽셀 단위 정밀 하이라이트(P1)를 전제로 UI를 설계하지 마세요.**

## `/api/draft/revise` — 소명서 문장 수정·제외 (2026-08-25 신설)

**왜 필요한가**: 소명서 문장은 대부분 LLM이 생성한 값입니다. **"있는 사실을 틀리게 쓴 문장"**(카드는 맞는데 "발송했습니다"를 "수령했습니다"로 뒤집는 경우)은 근거와 매칭되므로 F7-02 사실 검증이 잡지 못합니다. 읽기 전용 미리보기만 두면 사용자는 그 문장을 **발견만 하고 고치지 못한 채** 다운로드합니다.

```json
POST /api/draft/revise
{
  "sentences": [
    { "sentenceId": "s3", "excluded": true },
    { "sentenceId": "s5", "text": "2026년 9월 1일 물품을 발송하였습니다." }
  ]
}

→ 200
{
  "sentences": [ { "sentenceId": "s5", "text": "...", "evidenceRefs": [ { "type": "user_text" } ] } ],
  "warning": "수정하신 문장은 업로드 자료와 연결되지 않아 '본인 진술'로 표시됩니다."
}
```

### `text`와 `excluded`를 분리합니다

한 필드에 두 의미를 넣지 않습니다. **`text: ""`는 삭제 신호로 쓰지 않습니다** — 되돌릴 수 없고(원문이 사라짐), 빈 문자열과 공백만 입력한 값을 구분해야 하는 부담이 생깁니다.

| 필드 | 뜻 |
| --- | --- |
| `text` | 문장을 이 내용으로 교체. **재검증 없이 항상 `user_text`로 낮춥니다**(2026-08-26 ⑤ 정정 — 아래 참조) |
| `excluded: true` | 문장을 산출물에서 제외. **되돌릴 수 있고, 재검증이 불필요**합니다 (새 사실을 만들지 않으므로) |

### 수정된 문장은 삭제하지 않고 `user_text`로 유지합니다

**`text`가 오면 매칭 여부를 판단하지 않고 항상 경고를 띄우고 문장은 살립니다** (2026-08-26 ⑤ 정정). 별도 재검증(재-LLM 호출 등) 엔드포인트가 계약에 없어, "매칭이 끊기면"이 아니라 **"`text`가 왔으면 무조건"**으로 단순화해 구현했습니다. 오타만 고친 경우에도 배지는 "본인 진술"로 바뀝니다 — 값이 여전히 근거와 일치하는지 서버가 다시 확인하지 않기 때문입니다.

**FR-045 ③의 "매칭 안 되는 문장 자동 삭제"는 LLM 출력에 적용하는 규칙**이고, 사람이 자기 사실을 적은 문장에 같은 규칙을 쓰면 성격이 다릅니다. FR-045 ⑤가 이미 `user_text`에 "본인 진술" 표기를 규정하고 있으므로, 살리는 쪽이 그 규정을 따르는 것입니다.

**프론트는 `warning` 문구와 배지 변화를 함께 렌더합니다.**

| 편집 전 | 편집 | 편집 후 | 화면 |
| --- | --- | --- | --- |
| `evidence` (근거 배지 + 원본 이동) | `excluded: true`만 (text 없음) | 그대로 | 문장이 산출물에서만 빠짐, 배지 변화 없음 |
| `evidence` | `text` 포함 (오타 수정이라도) | **항상 `user_text`로 강등** | 배지가 **"본인 진술"로 바뀌고 원본 이동 배지가 사라짐** — 매칭 여부와 무관 |

경고 문구는 읽고 넘기지만, 방금까지 "대화 캡처"라고 적혀 있던 배지가 "본인 진술"로 바뀌는 건 눈에 보입니다 — **사용자가 무엇을 잃었는지 알려주는 신호**입니다. `warning`은 서버가 준 문자열을 그대로 씁니다.

### 편집 범위

| 대상 | 편집 |
| --- | --- |
| 1면 서식 필드 | 자유 입력 (`/api/package/text` 바디) |
| **2면 소명서 문장** | **수정 + 제외** ← 이 엔드포인트 |
| 3면 타임라인 | **불가** — 고치면 소명서·증빙목록과 어긋납니다 |
| 4면 증빙자료 목록 | **불가** — 확인된 카드에서 파생됩니다 |

> 3면 값이 틀린 걸 발견한 사용자에게는 **"자료 확인으로 돌아가 고칠 수 있어요" 안내 + Stage 2 복귀 링크**를 둡니다 (F7-04 재생성 경로). 편집을 막아놓고 대안을 안 주면 사용자는 틀린 채로 다운로드합니다.

## `/api/package/text` — 제출 패키지 (FR-047)

서버는 **텍스트 기반 면들**을 PDF로 생성합니다. 원본 이미지 페이지는 서버가 만들지 않습니다 — 프론트엔드가 이 응답에 브라우저 blob으로 만든 이미지 페이지를 `pdf-lib`으로 병합해 최종 패키지를 완성합니다(`../00-context/spec.md` F7-06).

**PDF 생성 주체는 서버(백엔드)입니다**(2026-08-24 확정). `spec.md` 총괄표의 `F8-01 담당 = C` 표기는 오류였으며 `A`로 정정했습니다.

### 면 구성 (2026-08-25 개정)

| 면 | 내용 | 만드는 쪽 |
| --- | --- | --- |
| 표지 | **제출 서류 목록** — 포함된 것 + 신청인이 따로 첨부하는 것 | 서버 |
| 1 | 별지 제4호서식 이의제기신청서 작성 지원본 | 서버 |
| 2 | 사실관계 진술서 | 서버 |
| 3 | 시간순 거래 타임라인 | 서버 |
| 4 | 증빙자료 목록 — **올린 자료의 목차** | 서버 |
| 5 | 증빙별 원본 이미지 | **브라우저** |
| ~~6~~ | ~~부족자료 체크리스트~~ | **제출본에서 제외** |

> **부족자료 체크리스트를 제출본에서 뺀 이유**: 미보유 항목 중에는 **사용자가 애초에 채울 수 없는 것**이 섞여 있습니다(개인 중고거래자의 사업자등록증, 차용증 없는 대여의 차용증). 화면에서는 이것들을 `whenMissing: "silent"`로 두어 **표시조차 하지 않는데**, 같은 목록이 PDF가 되면 화면에서 감춘 항목이 제출본에서 되살아납니다. "이 사람은 사업자등록증도 차용증도 없다"는 문장을 사용자가 스스로 정리해 은행에 건네는 셈입니다. **부족자료 체크리스트는 화면에 그대로 있습니다** — 사용자가 무엇을 더 준비할지 보는 용도입니다.
>
> **4면도 같은 이유로 출처를 정정했습니다.** 종전에 4면 데이터 출처를 `/api/draft`의 `checklist`(첨부 서류 체크리스트)로 적어뒀는데, 그러면 6면을 빼도 **미보유 목록이 4면으로 그대로 나갑니다.** 4면은 **확인된 증거 카드에서 만드는 "올린 자료의 목차"** 이며, 뒤에 붙는 5면 원본 이미지와 짝을 이룹니다(`../00-context/prd.md` §4.4가 "타임라인 + 증빙목록 + 원본이미지"를 한 묶음으로 둔 구조).

### 요청 바디 (2026-08-25 개정 — 서식 8 → **11필드**, `excludedSentenceIds` 추가)

PRD §4.4 별지 제4호서식 필드 매핑상 아래 값은 **사용자 직접 입력이며 서비스가 저장하지 않습니다.** `GET` 쿼리로는 실을 수 없어 `POST`입니다.

```json
{
  "applicant": { "name": "", "birthDate": "", "address": "", "phone": "", "mobile": "", "email": "" },
  "account":   { "bank": "", "branch": "", "depositType": "", "accountNumber": "", "holderName": "" },
  "excludedSentenceIds": ["s3", "s7"]
}
```

| 키 | 서식 항목 | 타입 | 필수 |
| --- | --- | --- | --- |
| `applicant.name` | 신청인 성명 | string | 선택 |
| `applicant.birthDate` | 신청인 생년월일 | string (`YYYY-MM-DD`) | 선택 |
| `applicant.address` | 신청인 주소 | string | 선택 |
| `applicant.phone` | 신청인 연락처 | string | 선택 |
| **`applicant.mobile`** | 신청인 휴대전화번호 | string | 선택 |
| **`applicant.email`** | 신청인 전자우편주소 | string | 선택 |
| `account.bank` | 지급정지 계좌 — 금융회사 | string | 선택 |
| `account.branch` | 지급정지 계좌 — 개설점포 | string | 선택 |
| `account.depositType` | 지급정지 계좌 — 예금종별 | string | 선택 |
| `account.accountNumber` | 지급정지 계좌 — 계좌번호 | string | 선택 |
| **`account.holderName`** | 지급정지 계좌 — 명의인 | string | 선택 |
| `excludedSentenceIds` | 2면에서 제외할 문장 id | string[] | 선택 (기본 `[]`) |

**11개 필드는 전부 선택입니다. 빈 값이어도 `400`을 내지 않습니다.**

빈 값이 오면 해당 칸을 **공란으로 둔 PDF**를 생성합니다. 이 산출물은 제출용 완성본이 아니라 **작성 지원본**이며(FR-047), 사용자가 계좌번호나 개설점포를 모르는 경우가 실제로 있기 때문입니다. 모르는 값 때문에 패키지 생성 자체가 막히면 서비스가 목적을 잃습니다. **폼에 필수 표시(`*`)를 붙이지 않습니다.**

`applicant`/`account` 객체 자체를 생략하거나 `null`로 보내도 됩니다 — 전부 공란으로 둔 것과 같게 처리합니다.

> **`holderName`("신청인과 동일" 체크박스)**: 법 제7조 제1항의 이의제기 주체가 **명의인**이라 둘이 다른 경우가 예외적입니다. 프론트는 체크박스를 **기본 체크**로 두고 `applicant.name` 값을 그대로 실어 보냅니다. **체크박스 상태는 계약에 넣지 않습니다** — 요청 바디에는 항상 `holderName`에 최종 문자열이 들어옵니다.

**형식 검증은 합니다** (선택이라는 것은 "비어도 된다"이지 "무엇이든 받는다"가 아닙니다).

| 검증 | 위반 시 |
| --- | --- |
| 각 필드 문자열 최대 100자 | `400` + `INVALID_FORM_FIELD` |
| `birthDate`는 값이 있으면 `YYYY-MM-DD` | `400` + `INVALID_FORM_FIELD` |

- 응답은 `application/pdf` **바이너리**입니다. 프론트엔드는 이 응답을 그대로 `pdf-lib`에 넘깁니다.
- `excludedSentenceIds`에 있는 문장은 **2면 생성 시 제외**합니다. 세션에 상태를 만들지 않습니다 — 다운로드 시점에 한 번 전달되고 끝입니다. 존재하지 않는 id는 무시합니다.
- **백엔드는 서식 11개 값을 PDF 생성에만 사용하고 세션·DB·로그 어디에도 남기지 않습니다**(`../03-infra-ops/privacy-and-safety.md`). 요청 로깅 시 바디를 기록하지 않도록 주의합니다.

## 공통 오류 응답

```json
{
  "error": "EXTRACTION_FAILED",
  "message": "이미지에서 내용을 읽지 못했습니다.",
  "fallback": "/api/evidence/text"
}
```

| error 코드 | 상황 | 프론트엔드 처리 |
| --- | --- | --- |
| `EXTRACTION_FAILED` | 판독 실패 (`502`) | **이미지 경로**(`/api/evidence`)만 `fallback: "/api/evidence/text"`로 텍스트 입력을 안내. **텍스트 경로**(`/api/evidence/text`)는 `fallback`이 없다 — 이미 텍스트인 요청에 텍스트 입력을 다시 안내하면 같은 자리를 맴돈다(2026-08-26 ③) |
| `TIMEOUT` | 20초 초과 | 부분 결과 표시 + "일부 자료를 읽지 못했습니다" |
| `SESSION_EXPIRED` | TTL 30분 초과 (`410 Gone`) | 세션 재생성 후 처음부터 안내. 원본 이미지는 서버에 없었으므로 재업로드 필요 |
| `UNCONFIRMED_FIELDS` | 날짜가 `null`이거나(2026-08-26 추가), 날짜·금액**(값이 `null`이 아닌 경우에 한함)**이 `low` 신뢰도인 미확인 카드가 남은 채 `/api/readiness`·`/api/draft` 호출 (`409`) | 해당 카드 확인 화면으로 유도 |
| `INVALID_FORM_FIELD` | `/api/package/text` 요청 바디의 필드가 길이·형식 제한을 위반, 또는 `/api/intake`의 `dueNoticeDate`가 `notified` 상태인데 없거나 `YYYY-MM-DD`가 아님 (`400`, 후자는 2026-08-26 명시) | 해당 입력 칸에 사유 표시 (빈 값은 위반이 아님) |
| `QUOTA_EXCEEDED` | LLM API 쿼터 초과 | 오프라인 데모 모드로 전환 (발표 대비, `../04-testing/test-cases-and-demo.md` 참조) |
| `DRAFT_FAILED` | `/api/draft`가 AI-server 소명서 생성에 실패(내부 재시도 1회 후에도 실패) (`502`, 2026-08-26 신설) | "잠시 후 다시 시도해주세요" 안내. 재시도는 사용자가 다시 `/api/draft`를 호출하는 것으로 |
| **`AI_CONFIG_ERROR`** | **AI-server 설정 오류(LLM 키 미설정·인증 실패) — 사용자 입력과 무관 (`500`, 2026-08-26 ③ 신설)** | **텍스트 입력으로 유도하지 않는다.** "일시적인 오류" 계열 안내만 표시. `fallback` 없음, 백엔드도 재시도하지 않음 |

## 변경 이력

이 문서를 수정하면 아래에 한 줄씩 남기세요.

- **v1.16 (2026-08-27)**: 프론트 요청 회신(`../request/backend/cross-image-duplicates-and-extract-anchor.md` §1). `mergeCandidates`에 "반복 포함" 규칙 추가 — `recurrence` 카드의 `[first, last]` 구간에 포함되는 같은 actor·금액·source_type 단발 카드도 후보로 잡는다. `MERGE_WINDOW`는 넓히지 않음(다른 실거래까지 후보가 되는 위험 회피)
- **v1.15 (2026-08-26 ⑦)**: 프론트 실연동 신고 반영. `occurred_at == null`도 `UNCONFIRMED_FIELDS` 차단 대상으로 확장(연도 없는 은행 캡처가 확인 없이 통과하던 문제) — `amount == null`은 그대로 둠
- **v1.14 (2026-08-26 ⑥)**: 문서 반영 누락 자체 점검. `/api/intake`의 `dueNoticeDate` 형식(`YYYY-MM-DD`)과 위반 시 `400 INVALID_FORM_FIELD`를 명시 — 검증 자체는 기존 코드에 있었으나 계약서엔 없었음
- **v1.13 (2026-08-26 ⑤)**: 문서-구현 불일치 자체 점검 반영. `/api/draft/revise`에서 `text` 수정 시 "매칭 여부와 무관하게 항상 `user_text`로 강등"하는 게 실제 동작임을 명시(종전 "여전히 매칭되면 그대로" 표는 구현과 달랐음 — 동작 영향 없음, 프론트는 이미 서버 응답 기준으로 배지를 그림). `/api/draft` 응답의 `checklist` 예시를 8필드 현행 스키마로 정정(구버전 `{ item, have }` 잔존 — 코드는 이미 정상)
- **v1.12 (2026-08-26 ④)**: AI-server 내부 계약 변경 반영. `AI_CONFIG_ERROR`(500) 신설 — 재시도·텍스트 입력 유도 없음. `EXTRACTION_FAILED`의 `fallback`은 이미지 경로에만 붙는 것으로 정정
- **v1.11 (2026-08-26 ③)**: 프론트 확인 질문 회신. `intake` 카드의 `confirmation_status`가 항상 `user_confirmed`임을 명시(세션 타임라인 미저장 — 게이팅 대상 아님)
- **v1.10 (2026-08-26 ②)**: 프론트 로컬 연동 회신 반영. `source_type`에 `intake`(7번째 값) 신설 — 3면 포함·4면 제외. `/api/intake` 전체 교체 의미 명시. `excludedSentenceIds`가 PDF 제외의 최종 소스임을 명시. `DRAFT_FAILED` 후 세션·확인 카드 유지 확정. AI-server 연결 실패도 502로 통일(내부 예외 메시지 비노출). CORS 프리플라이트 500·기한 경과 문구는 구현 버그 수정(계약 변경 아님)
- **v1.9 (2026-08-26)**: Phase 5 구현. `DRAFT_FAILED`(502) 오류 코드 신설. `/api/draft/revise`에서 제외된 문장은 응답 배열에서 빠지는 것으로 명시
- **v1.8 (2026-08-25 ④)**: Phase 3 구현. `/api/evidence`에 `imageIndex` 신설, `gaps` 항목 스키마 신설, `/api/evidence/confirm`의 `confirmed: false` = 삭제 명시, 병합 승인 구현 방식 명시
- **v1.7 (2026-08-25 ③)**: `/api/evidence/text`의 `rawText` 마스킹 주체를 프론트로 명시. `UNCONFIRMED_FIELDS` 게이팅을 값이 존재하는 카드에만 적용하도록 정정
- **v1.6 (2026-08-25 ②)**: 프론트 회신 5건 반영. **`checklist` 스키마 전면 개정**(2필드 → 8필드, 택일 `options`·`whenMissing` 신설). **`POST /api/checklist/self-held`·`POST /api/draft/revise` 신설.** `/api/package/text` **8 → 11필드** + `excludedSentenceIds`, **면 구성 개정**(부족자료 체크리스트 제외·표지 신설·4면 출처 정정). `/api/intake`에 `deliveryMethod` 신설. `notices` 서버 단일 소스 명시. CORS에 프론트 프로덕션 도메인 등록
- v1.5 (2026-08-25): AI 회신 3건 반영. 카드 스키마에 `source_type`·`counterparty_name`·`payer_name` + `field_confidence` 2키 추가. `/api/draft` 응답의 `evidenceRefs.type` 3종(`evidence`/`intake`/`user_text`)과 "본인 진술" 배지 규칙 확정. `bbox`가 근사 좌표임을 명시
- v1.4 (2026-08-24): `/api/package/text` `GET` → `POST` + 요청 바디 8개 필드 정의(전부 선택, `INVALID_FORM_FIELD` 신설). `GET /api/timeline`에 `mergeCandidates` 추가, `POST /api/timeline/merge` 신설(F5-02). `deadline.notice`는 항상 non-null임을 명시. `/api/evidence` 동시 요청 상한 4·업로드 크기 상한·서버 측 매직바이트 검증 명시. CORS 허용 origin·헤더 절 신설(`localhost:5173` 등록, 프리뷰 와일드카드 불허)
- v1.3 (2026-08-23): `/api/session`에 `demoMode`, `/api/readiness`에 `smallAmountNotice` 추가. FR-028 게이팅의 서버 측 거부(`UNCONFIRMED_FIELDS`, 409) 명시. `/api/evidence` 1장씩 병렬 호출 방식 명시(F3-03)
- v1.2 (2026-08-23): 세션 전달 방식을 커스텀 헤더 `X-Session-Hash`로 확정(TODO 줄 대체). `/api/intake` 응답에 `deadline` 추가(FR-014 계산 주체를 백엔드로 확정)
- v1.1 (2026-08-23): 새 PRD/기능명세서 기준으로 재정렬 (3서비스 독립 배포 유지). `/api/verdict` → `/api/readiness`, `/api/draft/pdf` → `/api/package/text`로 개명. `/api/evidence/confirm` 신설(FR-028). 문진 필드에 채권소멸절차 공고일 추가(FR-014)
- v1.0 (2026-08-22): PRD 기준 최초 작성
