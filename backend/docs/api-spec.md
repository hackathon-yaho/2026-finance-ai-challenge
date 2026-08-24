# 해빙 백엔드 API 명세서

- 대상: **프론트엔드 개발자**
- 기준: 실제 구현된 백엔드 코드 (`backend/src/main/java`)
- 최종 갱신: 2026-08-24 (0장 작성, 엔드포인트 전체 미구현)

> **이 문서와 `../../docs/02-architecture/api-contract.md`의 관계**
>
> | 문서 | 성격 | 누가 고치나 |
> | --- | --- | --- |
> | `docs/02-architecture/api-contract.md` | **계약** — 프론트와 합의한 내용. 필드가 무엇이고 왜 그런지 | 변경 시 상대 역할과 **합의 후** 고침 |
> | 이 문서 | **구현 명세** — 실제로 지금 동작하는 것. 프론트가 보고 바로 붙이는 문서 | 백엔드가 **구현할 때마다** 고침 |
>
> **두 문서가 다르면 `api-contract.md`가 우선입니다.** 계약이 먼저 바뀌고 구현이 따라옵니다. 이 문서에서 계약에 없는 값을 새로 정하지 않습니다 — 정해야 하면 `api-contract.md`를 먼저 고칩니다(`../../docs/05-planning/role-assignment.md` 매몰 방지 원칙).
>
> **갱신 규칙: API를 하나 완료하거나 수정할 때마다 이 문서의 해당 절과 상단 "구현 현황" 표를 같이 고칩니다.** 코드만 바뀌고 이 문서가 그대로면 프론트는 그 변경을 알 방법이 없습니다.

---

## 구현 현황

| 절 | 엔드포인트 | Phase | 상태 |
| --- | --- | --- | --- |
| 1.1 | `POST /api/session` | 2 | 미구현 |
| 1.2 | `DELETE /api/session` | 2 | 미구현 |
| 2.1 | `POST /api/intake` | 2 | 미구현 |
| 3.1 | `POST /api/evidence` | 3 | 미구현 |
| 3.2 | `POST /api/evidence/confirm` | 3 | 미구현 |
| 3.3 | `POST /api/evidence/text` | 3 | 미구현 |
| 4.1 | `GET /api/timeline` | 3 | 미구현 |
| 4.2 | `POST /api/timeline/merge` | 3 | 미구현 (스코프 컷 후보) |
| 5.1 | `POST /api/readiness` | 4 | 미구현 |
| 6.1 | `POST /api/draft` | 5 | 미구현 |
| 6.2 | `POST /api/package/text` | 5 | 미구현 |
| 7.1 | `GET /actuator/health` | 1 | 미구현 |

상태 값: `미구현` → `구현 완료` → (계약이 바뀌면) `구현 완료 (YYYY-MM-DD 개정)`

---

## 0. 공통 사항 (반드시 먼저 읽어주세요)

### 0.1 Base URL

- 로컬: `http://localhost:8080`
- 배포: Render (URL 확정 시 이 절에 갱신)

경로에 `/api` 접두어가 포함되어 있습니다. 헬스체크(`/actuator/health`)만 예외입니다.

### 0.2 세션 식별 방식 — 로그인이 없습니다

이 서비스는 **회원가입도 로그인도 없습니다.** 대신 진입 시 발급받은 세션 해시를 이후 모든 요청에 실어 보냅니다.

1. 최초 진입 시 `POST /api/session`을 호출해 `sessionHash`를 받습니다.
2. 이후 **모든 요청 헤더에 `X-Session-Hash: {sessionHash}`** 를 넣습니다.
3. 세션 TTL은 **30분**입니다. 만료되면 `410 SESSION_EXPIRED`가 내려갑니다.

**쿠키를 쓰지 않습니다.** `credentials: 'include'`는 필요 없습니다. 프론트(정적 호스팅)와 백엔드(Render)의 도메인이 달라 크로스오리진 쿠키의 `SameSite=None; Secure` 및 브라우저 추적 방지 정책 리스크를 피하기 위한 결정입니다.

**세션 헤더가 필요 없는 경로**: `POST /api/session`(세션 발급 자체), `GET /actuator/health`.

**세션이 만료되면**: 서버 세션이 사라지는 것뿐 아니라 **원본 이미지도 다시 올려야 합니다.** 서버는 이미지를 보관하지 않으므로(0.6), 재업로드 없이는 복구할 수 없습니다. 안내 문구는 "원본이 필요합니다. 다시 올려주세요"로 통일합니다.

### 0.3 CORS

| 항목 | 값 |
| --- | --- |
| 허용 origin | `http://localhost:5173` (Vite 개발 서버) · 프론트 배포 도메인(확정 시 추가) |
| 허용 헤더 | `Content-Type`, `X-Session-Hash` |
| 허용 메서드 | `GET`, `POST`, `DELETE`, `OPTIONS` |
| credentials | 사용하지 않음 |

**프리뷰 서브도메인 와일드카드는 허용하지 않습니다.** Vercel/Netlify 브랜치 프리뷰에서는 API 호출이 막힙니다 — 프리뷰 확인은 로컬로 대체해주세요.

### 0.4 요청 / 응답 공통 규칙

- JSON 필드는 전부 **camelCase**입니다.
- **성공 응답에 래퍼가 없습니다.** 데이터를 그대로 반환합니다 (`{ "data": ... }` 없음).
- 날짜는 `YYYY-MM-DD`, 일시는 ISO-8601입니다.
- 금액은 **원 단위 정수**입니다 (`700000`). 문자열이나 소수가 아닙니다.

### 0.5 공통 에러 코드

실패 응답은 항상 아래 형태입니다.

```json
{ "error": "SESSION_EXPIRED", "message": "세션이 만료되었습니다.", "fallback": null }
```

| HTTP | `error` | 의미 | 프론트 처리 |
| --- | --- | --- | --- |
| 400 | `INVALID_REQUEST` | 필수 파라미터 누락, 형식 오류, 파일 검증 실패(개수·크기·확장자·매직바이트) | 사유를 해당 입력에 표시. 나머지 파일은 정상 처리 |
| 400 | `INVALID_FORM_FIELD` | `/api/package/text` 요청 바디의 길이·형식 위반 (**빈 값은 위반이 아님**) | 해당 입력 칸에 사유 표시 |
| 409 | `UNCONFIRMED_FIELDS` | 날짜·금액이 `low` 신뢰도인 미확인 카드가 남은 채 `/api/readiness` 호출 | 해당 카드 확인 화면으로 유도 |
| 410 | `SESSION_EXPIRED` | 세션 TTL 30분 초과 | 세션 재생성 + **원본 재업로드 안내** |
| 422 | `EXTRACTION_FAILED` | 이미지 판독 실패 | `fallback` 경로(`/api/evidence/text`)로 안내 |
| 504 | `TIMEOUT` | 판독 20초 초과 | 부분 결과 표시 + "일부 자료를 읽지 못했습니다" |
| 503 | `QUOTA_EXCEEDED` | LLM API 쿼터 초과 | 데모 모드 안내 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 | 일반 오류 안내, 재시도 유도 |

`fallback`은 대체 경로가 있을 때만 채워집니다(`EXTRACTION_FAILED` → `"/api/evidence/text"`). 나머지는 `null`입니다.

### 0.6 서버는 원본 이미지를 저장하지 않습니다

프론트 구현에 직접 영향이 있는 제약이라 여기 적습니다.

- 업로드된 이미지는 서버 메모리를 통과해 AI로 전달되고 **응답 직후 폐기**됩니다. 디스크·DB·Storage 어디에도 남지 않습니다.
- 따라서 **소명서의 근거 이미지를 서버에서 다시 받아올 수 없습니다.** 서버는 `imageIndex`(몇 번째 이미지인지)와 `bbox`(영역 좌표)만 돌려주며, **실제 이미지는 프론트가 자기 메모리의 blob 배열에서 찾아 표시**해야 합니다.
- 새로고침으로 blob이 날아가면 근거 배지를 회색 처리하고 "원본을 다시 올리면 확인할 수 있습니다"를 표시해주세요.

### 0.7 업로드 제약

| 항목 | 값 |
| --- | --- |
| 파일당 최대 | 10MB |
| 세션당 누적 최대 | **10장** (11장째는 400) |
| 허용 포맷 | JPG / PNG (**PNG 권장** — 텍스트 캡처는 JPEG 링잉이 판독에 불리) |
| 리사이즈 | 프론트에서 **장변 1600px**로 줄여 전송 |
| 동시 요청 상한 | **4** — 10장이면 4 → 4 → 2로 끊어 보냄 |

서버도 확장자·매직바이트·크기·개수를 다시 검증합니다. 프론트 검증은 사용자 실수를 즉시 알리기 위한 것이고, 위조 파일 차단은 서버 몫입니다.

### 0.8 이 서비스가 하지 않는 것 (문구 작성 시 주의)

응답 문구를 프론트에서 다듬을 때 반드시 지켜야 합니다.

- **은행의 승인·기각을 예측하지 않습니다.** 산출물은 "제출 서류가 갖춰졌는가"이지 "해제될 것인가"가 아닙니다.
- `notices`의 **"최종 판단은 은행이 합니다"** 는 생략하지 마세요.
- `deadline.notice`, `smallAmountNotice`는 **서버 문구를 그대로 출력**합니다. 순화·축약하거나 단정적으로 바꾸지 마세요 — 법 근거가 있는 안내 문구입니다.

---

## 1. 세션

### 1.1 `POST /api/session` — 세션 생성

> 상태: **미구현** (Phase 2) · 계약: `api-contract.md` 엔드포인트 목록

**설명**: 16자 랜덤 해시를 발급하고 인메모리 세션을 엽니다. 앱 최초 진입 시 1회 호출합니다.

**사전 조건**: 없음 (세션 헤더 불필요).

**Request**: 파라미터·바디 없음.

**Response**

| key | 설명 | 타입 | Nullable | 예시 |
| --- | --- | --- | --- | --- |
| sessionHash | 이후 모든 요청의 `X-Session-Hash` 값 | String(16) | N | "a1b2c3d4e5f6g7h8" |
| expiresAt | 세션 만료 시각 (발급 + 30분) | ISO-8601 | N | "2026-08-24T15:30:00Z" |
| demoMode | `true`면 전 화면 상단에 **"예시 데이터 사용 중 — 실제 AI 분석 결과가 아닙니다"** 배지 고정 | boolean | N | false |

`demoMode`는 서버 `DEMO_MODE` 환경변수 값입니다. `true`일 때 백엔드는 AI를 호출하지 않고 사전 저장된 응답 세트를 반환합니다.

**Status**

| status | 내용 |
| --- | --- |
| 200 | 발급 성공 |
| 500 | `INTERNAL_ERROR` |

---

### 1.2 `DELETE /api/session` — 세션 즉시 파기

> 상태: **미구현** (Phase 2)

**설명**: 사용자가 "지금 삭제"를 누르면 호출합니다. 서버 세션의 모든 데이터를 즉시 지웁니다.

**사전 조건**: `X-Session-Hash` 필요.

**Request**: 바디 없음.

**Response**: 바디 없음 (`204 No Content`).

프론트는 이 호출과 함께 **자기 메모리의 blob도 revoke** 해야 합니다. 서버만 지우면 원본이 브라우저에 남습니다.

**Status**

| status | 내용 |
| --- | --- |
| 204 | 파기 완료 |
| 410 | `SESSION_EXPIRED` (이미 만료 — 프론트는 성공과 동일하게 처리) |

---

## 2. 문진

### 2.1 `POST /api/intake` — 문진 저장 + 이의제기 기한 계산

> 상태: **미구현** (Phase 2)

**설명**: 6문항 응답을 세션에 저장하고, **이의제기 기한을 서버가 계산해** 함께 돌려줍니다.

**사전 조건**: `X-Session-Hash` 필요.

**Request Body**

6문항이지만 공고 문항이 2필드로 쪼개져 **7개 필드**입니다.

| key | 설명 | 타입 | 필수 | 예시 |
| --- | --- | --- | --- | --- |
| when | 지급정지일. 모르면 `null` | String(`YYYY-MM-DD`) \| null | Y | "2026-09-01" |
| dueNoticeStatus | 채권소멸절차 개시 공고 상태. `notified` / `not_yet` / `unknown` | enum | Y | "notified" |
| dueNoticeDate | 공고일. **기한 = 공고일 + 2개월** | String(`YYYY-MM-DD`) \| null | Y (`notified`면 값 필요) | "2026-09-01" |
| amount | 문제 입금액(원 단위 정수). 모르면 `null` | Integer \| null | Y | 700000 |
| kind | 사유유형. `goods` / `service` / `debt` / `unclear` | enum | Y | "goods" |
| history | 과거 지급정지 이력 여부 | boolean | Y | false |
| usage | 계좌 사용 빈도. `main` / `occasional` / `rare` | enum | Y | "main" |

> `amount`는 **사실 기재 전용**입니다. 준비도 판정에 사용되지 않습니다 — 소액 여부를 서비스가 판정하지 않기 때문입니다.

**Request Example**

```
POST /api/intake
X-Session-Hash: a1b2c3d4e5f6g7h8
Content-Type: application/json

{
  "when": "2026-09-01",
  "dueNoticeStatus": "notified",
  "dueNoticeDate": "2026-09-01",
  "amount": 700000,
  "kind": "goods",
  "history": false,
  "usage": "main"
}
```

**Response**

| key | 설명 | 타입 | Nullable | 예시 |
| --- | --- | --- | --- | --- |
| ok | 저장 성공 | boolean | N | true |
| nextStage | 다음 단계 번호 | Integer | N | 2 |
| deadline.date | 이의제기 기한일. **공고일 미입력 시 `null`** | String(`YYYY-MM-DD`) | Y | "2026-11-01" |
| deadline.daysLeft | 남은 일수. **공고일 미입력 시 `null`** | Integer | Y | 42 |
| deadline.notice | 화면에 그대로 출력할 안내 문구 | String | **N** | "이의제기 기한까지 42일 남았습니다. (2026-11-01)" |

**`notice`는 어떤 경우에도 `null`이 아닙니다.** `date`/`daysLeft`가 `null`일 때는 "공고일을 모르는 경우"에 해당하는 문구가 대신 들어갑니다. 항상 존재한다는 전제로 화면을 구성해도 됩니다.

**Example**

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

> **`notice`를 순화하거나 줄이지 마세요.** 법 제7조 근거의 안내 문구입니다. 기한이 지난 경우에도 "불가능"이라고 단정하지 않는 문구가 내려갑니다.

**Status**

| status | 내용 |
| --- | --- |
| 200 | 저장 성공 |
| 400 | `INVALID_REQUEST` — enum 값 오류, 날짜 형식 오류 |
| 410 | `SESSION_EXPIRED` |

---

## 3. 증거

### 3.1 `POST /api/evidence` — 이미지 판독

> 상태: **미구현** (Phase 3)

**설명**: 캡처 이미지를 AI로 판독해 **이벤트 카드**를 뽑아냅니다. 이미지는 서버에 저장되지 않습니다(0.6).

**사전 조건**
- `X-Session-Hash` 필요.
- 프론트에서 **장변 1600px 리사이즈 + 마스킹 완료** 상태로 보내야 합니다.
- **이미지 1장당 1요청, 동시 4개까지.** 응답 도착 순서대로 파일별 "읽음 / 실패"를 칠하면 됩니다(별도 SSE·폴링 없음).

**Request**: `multipart/form-data`. 제약은 0.7 참조.

**Response**

| key | 설명 | 타입 | Nullable |
| --- | --- | --- | --- |
| cards[] | 추출된 이벤트 카드 목록 | array | N |
| cards[].event_id | 카드 식별자 | String | N |
| cards[].source_image_index | 몇 번째 업로드 이미지인지 (**프론트 blob 배열 인덱스**) | Integer | N |
| cards[].occurred_at | 발생 일시 | ISO-8601 | Y |
| cards[].actor | `self` / `counterparty` / `system` | enum | N |
| cards[].summary | 한 줄 요약 | String | N |
| cards[].amount | 금액(원 단위 정수) | Integer | Y |
| cards[].identifiers.tracking_no | 운송장 번호 | String | Y |
| cards[].identifiers.account_last4 | 계좌 뒤 4자리 | String | Y |
| cards[].field_confidence.occurred_at | `high` / `medium` / `low` | enum | N |
| cards[].field_confidence.actor | 〃 | enum | N |
| cards[].field_confidence.amount | 〃 | enum | N |
| cards[].source_region | 원본 내 영역 좌표 `{x, y, w, h}` (0~1 비율) | object | Y |
| cards[].confirmation_status | `pending` / `user_confirmed` / `user_corrected` | enum | N |
| signals.threat_detected | 협박 감지 | boolean | N |
| signals.delivery_evidence | 발송 증빙 존재 | boolean | N |
| signals.life_activity | 생계 흔적 존재 | boolean | N |
| qualityFlags | `event_id` → `{ blurry, missing_date, amount_mismatch }` | object | N |

**프론트가 반드시 처리해야 하는 것 2가지**

1. **`signals.threat_detected: true`면 즉시 협박 대응 배너를 노출**합니다. 사용자가 다음 단계로 넘어가길 기다리지 않습니다.
2. **날짜 또는 금액이 `low` 신뢰도인 카드가 `pending`이면 Stage 3 진입을 차단**하고 확인을 요구합니다. 서버도 같은 조건을 `409 UNCONFIRMED_FIELDS`로 거부하지만, 정상 흐름에서는 프론트가 먼저 막아야 합니다.

**Status**

| status | 내용 |
| --- | --- |
| 200 | 판독 성공 |
| 400 | `INVALID_REQUEST` — 파일 검증 실패(개수·크기·확장자·매직바이트) |
| 410 | `SESSION_EXPIRED` |
| 422 | `EXTRACTION_FAILED` — `fallback: "/api/evidence/text"` |
| 504 | `TIMEOUT` |

---

### 3.2 `POST /api/evidence/confirm` — 카드 확인·수정

> 상태: **미구현** (Phase 3)

**설명**: 사용자가 카드 내용을 확인하거나 값을 고칠 때 호출합니다. **`confirmed: true`인 카드만 준비도 점검과 소명서 생성의 입력이 됩니다.**

**Request Body**

| key | 설명 | 타입 | 필수 |
| --- | --- | --- | --- |
| cardId | 대상 카드 `event_id` | String | Y |
| confirmed | 확인 여부 | boolean | Y |
| corrections | 고친 필드만 담은 객체 (예: `{ "amount": 700000 }`). 수정이 없으면 생략 | object | N |

**Response**

| key | 설명 | 타입 |
| --- | --- | --- |
| ok | 저장 성공 | boolean |
| confirmedCount | 확인 완료 카드 수 | Integer |
| unconfirmedCount | 미확인 카드 수 | Integer |

`unconfirmedCount`로 "확인하지 않은 자료 n건은 문서에 포함되지 않습니다" 경고를 그리면 됩니다.

**Status**: 200 / 400 `INVALID_REQUEST` / 410 `SESSION_EXPIRED`

---

### 3.3 `POST /api/evidence/text` — 텍스트 대체 입력

> 상태: **미구현** (Phase 3)

**설명**: 이미지 없이 자연어 서술만으로 카드를 만듭니다. 판독 전체 실패 시 자동 전환 경로이기도 합니다.

**Request Body**

| key | 설명 | 타입 | 필수 |
| --- | --- | --- | --- |
| rawText | 자유 텍스트 (최대 2000자) | String | Y |

**Response**: `{ cards: [...] }` — 3.1과 같은 카드 스키마.

> 이 경로로 만든 카드는 **날짜 신뢰도가 전부 `low`** 입니다. 따라서 사용자 확인(3.2) 없이는 Stage 3으로 넘어갈 수 없습니다.

**Status**: 200 / 400 `INVALID_REQUEST` (2000자 초과·빈 문자열) / 410 `SESSION_EXPIRED`

---

## 4. 타임라인

### 4.1 `GET /api/timeline` — 타임라인 조회

> 상태: **미구현** (Phase 3)

**설명**: 확인된 카드를 시간순으로 정렬하고, 빠진 증거(공백)와 병합 후보를 함께 돌려줍니다.

**Request**: 파라미터 없음.

**Response**

| key | 설명 | 타입 | Nullable |
| --- | --- | --- | --- |
| events[] | 시간순 정렬된 이벤트 | array | N |
| gaps[] | 증거 공백 (예: 발송 증빙 없음) | array | N |
| mergeCandidates[] | 중복으로 보이는 이벤트 묶음. **없으면 빈 배열** | array | N |
| mergeCandidates[].groupId | 후보 그룹 id (승인 시 이 값을 보냄) | String | N |
| mergeCandidates[].eventIds | 묶인 이벤트 id 목록 | String[] | N |
| mergeCandidates[].reason | **사용자에게 그대로 보여줄 수 있는 사유 문장** | String | N |

**`mergeCandidates`는 판단 결과가 아니라 제안입니다.** 서버는 자동 병합하지 않습니다. `reason` 없이 병합 승인을 받지 마세요 — 왜 같은 사건으로 보이는지 사용자가 알아야 합니다.

**Status**: 200 / 410 `SESSION_EXPIRED`

---

### 4.2 `POST /api/timeline/merge` — 병합 승인

> 상태: **미구현** (Phase 3) · **스코프 컷 후보**

**설명**: 사용자가 승인한 병합 후보만 실제로 합칩니다.

**Request Body**

| key | 설명 | 타입 | 필수 |
| --- | --- | --- | --- |
| mergeGroupIds | 승인/거절할 `groupId` 배열 (**`eventId`가 아닙니다**) | String[] | Y |
| approved | `true`면 병합, `false`면 거절 | boolean | Y |

`approved: false`는 후보를 거절로 기록해 이후 `mergeCandidates`에서 제외합니다. 이벤트는 그대로 둡니다.

**Response**: 4.1과 동일한 타임라인 전체. 프론트는 응답으로 화면을 통째로 갱신하면 됩니다.

> **스코프 컷 시**: `mergeCandidates`가 **항상 빈 배열**로 내려가고 이 엔드포인트는 구현되지 않습니다. 프론트는 빈 배열이면 후보 UI를 렌더하지 않으면 되므로 코드 변경이 필요 없습니다. 컷 결정이 나면 `docs/response/frontend/`에 회신합니다.

**Status**: 200 / 400 `INVALID_REQUEST` (없는 `groupId`) / 410 `SESSION_EXPIRED`

---

## 5. 제출 준비도

### 5.1 `POST /api/readiness` — 준비도 점검

> 상태: **미구현** (Phase 4)

**설명**: 확인된 카드와 문진 응답으로 **결정적 규칙 엔진**이 제출 준비 상태를 산출합니다. **LLM을 쓰지 않습니다.**

**사전 조건**: 날짜·금액이 `low` 신뢰도인 미확인 카드가 없어야 합니다. 남아 있으면 `409`입니다.

**Request**: 바디 없음 (세션의 값으로 계산).

**Response**

| key | 설명 | 타입 | Nullable |
| --- | --- | --- | --- |
| reason | 사유유형 `goods` / `service` / `debt` / `unclear` | enum | N |
| checklist[].item | 점검 항목명 | String | N |
| checklist[].status | `met` / `unmet` / `unknown` | enum | N |
| readiness | `SUBMISSION_READY` / `SUPPLEMENT_NEEDED` / `BANK_CHECK_REQUIRED` | enum | N |
| missingItems[] | 부족한 자료 | String[] | N |
| conflicts[] | 자료 간 충돌 | array | N |
| notices[] | 공통 안내. **"최종 판단은 은행이 합니다"가 항상 포함** | String[] | N |
| smallAmountNotice | 소액 안내 카드 문구 (고정 문구) | String | N |
| urgentAlert | 협박 감지 여부. `readiness`와 독립 | boolean | N |

**문구 처리 주의**

- `readiness`가 `BANK_CHECK_REQUIRED`면 `reason-type-rules.md` §3의 정직한 안내 문구를 그대로 노출합니다. 낙관적으로 순화하지 마세요.
- `smallAmountNotice`는 **판정이 아니라 정보 제공**입니다. 입금액에 따라 문구가 달라지지 않는 고정 문구이며, "소액이라 유리하다"처럼 단정적으로 바꾸지 마세요. 준비도 배지와 **시각적으로 분리**해 배치해주세요.

**Status**

| status | 내용 |
| --- | --- |
| 200 | 산출 성공 |
| 409 | `UNCONFIRMED_FIELDS` — 카드 확인 화면으로 유도 |
| 410 | `SESSION_EXPIRED` |

---

## 6. 산출물

### 6.1 `POST /api/draft` — 소명서 생성

> 상태: **미구현** (Phase 5)

**설명**: 확인된 사실만으로 소명서 초안을 만들고, **각 문장이 어느 자료에서 나왔는지** 참조를 함께 돌려줍니다.

**Request**: 바디 없음.

**Response**

| key | 설명 | 타입 | Nullable |
| --- | --- | --- | --- |
| draftText | 소명서 전문 | String | N |
| sentences[].sentenceId | 문장 id | String | N |
| sentences[].text | 문장 | String | N |
| sentences[].evidenceRefs[].type | 근거 유형 (`evidence` / `intake` 등) | String | N |
| sentences[].evidenceRefs[].imageIndex | **프론트 blob 배열 인덱스** | Integer | Y |
| sentences[].evidenceRefs[].bbox | 영역 좌표 `{x, y, w, h}` (0~1 비율) | object | Y |
| checklist[].item | 첨부 서류 항목 | String | N |
| checklist[].have | 보유 여부 | boolean | N |

**`evidenceRefs`에는 이미지가 들어 있지 않습니다.** 참조만 옵니다 — 프론트가 `imageIndex`로 자기 blob 배열에서 찾아 표시하고, `bbox`가 있으면 그 영역으로 스크롤합니다(0.6).

**Status**: 200 / 410 `SESSION_EXPIRED` / 504 `TIMEOUT` / 503 `QUOTA_EXCEEDED`

---

### 6.2 `POST /api/package/text` — 텍스트 5종 PDF

> 상태: **미구현** (Phase 5)

**설명**: 제출 패키지 6종 중 **텍스트 5종**(별지 제4호서식 작성 지원본 / 사실관계 진술서 / 타임라인 / 증빙목록 / 부족자료 체크리스트)을 A4 PDF로 생성합니다.

**⑤ 원본 이미지 페이지는 서버가 만들지 않습니다.** 프론트가 이 응답에 자기 blob으로 만든 이미지 페이지를 `pdf-lib`으로 병합해 최종 6종을 완성합니다.

**Request Body** — 별지 제4호서식 8개 필드

```json
{
  "applicant": { "name": "", "birthDate": "", "address": "", "phone": "" },
  "account":   { "bank": "", "branch": "", "depositType": "", "accountNumber": "" }
}
```

| key | 서식 항목 | 타입 | 필수 |
| --- | --- | --- | --- |
| applicant.name | 신청인 성명 | String | **선택** |
| applicant.birthDate | 신청인 생년월일 (`YYYY-MM-DD`) | String | **선택** |
| applicant.address | 신청인 주소 | String | **선택** |
| applicant.phone | 신청인 연락처 | String | **선택** |
| account.bank | 지급정지 계좌 — 금융회사 | String | **선택** |
| account.branch | 지급정지 계좌 — 개설점포 | String | **선택** |
| account.depositType | 지급정지 계좌 — 예금종별 | String | **선택** |
| account.accountNumber | 지급정지 계좌 — 계좌번호 | String | **선택** |

**8개 전부 선택입니다. 빈 값이어도 400이 아닙니다.**

- 빈 값이면 해당 칸이 **공란인 PDF**가 나오고, 5면 부족자료 체크리스트에 "직접 채워야 하는 항목"으로 표시됩니다.
- `applicant` / `account` 객체 자체를 생략하거나 `null`로 보내도 됩니다.
- **폼에 필수 표시(`*`)를 붙이지 마세요.** 사용자가 계좌번호를 모르는 경우가 실제로 있고, 그 때문에 패키지 생성이 막히면 안 됩니다. 이 산출물은 제출용 완성본이 아니라 **작성 지원본**입니다.

**형식 검증은 합니다** (비어도 되지만, 값이 있으면 형식을 봅니다).

| 검증 | 위반 시 |
| --- | --- |
| 각 필드 최대 100자 | 400 `INVALID_FORM_FIELD` |
| `birthDate`는 값이 있으면 `YYYY-MM-DD` | 400 `INVALID_FORM_FIELD` |

**Response**: `application/pdf` **바이너리**. 그대로 `pdf-lib`에 넘기면 됩니다.

> **이 8개 값은 PDF 생성에만 쓰이고 세션·DB·로그 어디에도 남지 않습니다.** 서버는 이 요청의 바디를 로깅하지 않습니다.

**Status**

| status | 내용 |
| --- | --- |
| 200 | `application/pdf` |
| 400 | `INVALID_FORM_FIELD` |
| 410 | `SESSION_EXPIRED` |

---

## 7. 운영 (프론트 사용 대상 아님)

### 7.1 `GET /actuator/health` — 헬스체크

> 상태: **미구현** (Phase 1)

킵얼라이브용입니다. 단순 상태 반환이 아니라 DB에 실제 쿼리를 날립니다. **프론트가 호출할 일은 없습니다.**

**Response**: `{ "status": "UP", "db": "OK" }`

---

## 부록. 변경 이력

API를 완료하거나 계약이 바뀔 때마다 한 줄씩 남깁니다. **"구현 현황" 표의 상태도 같이 고칩니다.**

| 날짜 | 대상 | 내용 |
| --- | --- | --- |
| 2026-08-24 | 전체 | 문서 신설. 0장(공통 사항) 작성, 엔드포인트 12종을 계약(`api-contract.md` v1.4) 기준으로 골격 작성. 구현은 전부 미착수 |
