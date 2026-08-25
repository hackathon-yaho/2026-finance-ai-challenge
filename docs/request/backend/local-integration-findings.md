# [프론트 → 백엔드] 백엔드를 로컬로 띄워 연동해봤습니다 — 브라우저에서 호출이 전부 막힙니다

> **상태: ⏳ 회신 대기** (요청 2026-08-26)
> 회신은 `../../response/frontend/local-integration-findings.md`에 들어옵니다.
> **막고 있는 작업**: **§1이 프론트 연동 전체를 막습니다.** `/api/session`과 `/actuator/health`를 제외한 모든 호출이 브라우저에서 실패합니다. 나머지 항목은 막지 않습니다.

- 작성: 프론트엔드 · 2026-08-26
- 확인 환경: 로컬 (`postgresql@16` + `sh gradlew bootRun`, `CORS_ALLOWED_ORIGINS=http://localhost:5173`), 프론트 `http://localhost:5173`, Chrome
- 배경: 8/29 연동을 기다리는 대신 Phase 1~5가 저장소에 들어와 있어 미리 붙여봤습니다. **AI-server는 띄우지 않아** `/api/evidence`·`/api/draft`는 검증 대상에서 뺐습니다.

## 요약

| # | 항목 | 심각도 |
| --- | --- | --- |
| 1 | **CORS 프리플라이트(OPTIONS)가 `500`** → 브라우저에서 대부분의 API 호출 불가 | 🔴 **연동 차단** |
| 2 | 기한 경과 시 **"이의제기 기한까지 **-56일** 남았습니다"** | 🟠 사용자 노출 문구 |
| 3 | 문진 재전송 시 **`null`이 이전 값을 지우지 않음** | 🟠 잘못된 기한 안내 |
| 4 | `/api/timeline`에 계약에 없는 **`evt_intake_when` 카드** — 서버 PDF 3면에는 없음 | 🟡 미리보기↔제출본 불일치 |
| 5 | AI-server 미설정이 `400 INVALID_REQUEST`로 나감 (`DRAFT_FAILED`가 아님) | 🟡 |
| 6 | `gradlew`에 실행 권한 비트가 없음 | 🟢 |

**잘 되는 것도 먼저 적습니다** — §7에 정리했습니다. 특히 **제출 패키지 PDF는 한글까지 정상**이고, 저희 병합 코드와도 붙습니다.

## 1. 🔴 CORS 프리플라이트가 `500`이라 브라우저에서 호출이 막힙니다

`http://localhost:5173`에서 `/api/intake`를 부르면 이렇게 됩니다.

```
Access to fetch at 'http://localhost:8080/api/intake' from origin 'http://localhost:5173'
has been blocked by CORS policy: Response to preflight request doesn't pass access control
check: It does not have HTTP ok status.
```

`curl`로 프리플라이트를 재현하면 **헤더는 전부 맞는데 상태 코드가 `500`** 입니다.

```
$ curl -i -X OPTIONS localhost:8080/api/intake \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type,x-session-hash"

HTTP/1.1 500
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET,POST,DELETE,OPTIONS
Access-Control-Allow-Headers: content-type, x-session-hash
Access-Control-Max-Age: 1800
```

**원인으로 보이는 것** — 백엔드 로그에 이 요청이 이렇게 남습니다.

```
ERROR ... Servlet.service() ... threw exception
  [Request processing failed: ...BusinessException: 세션이 만료되었습니다.] with root cause
com.haebing.backend.common.global.exception.BusinessException: 세션이 만료되었습니다.
```

**세션 검사 필터가 `OPTIONS` 요청까지 가로채고 있습니다.** 브라우저는 프리플라이트에 `X-Session-Hash`를 **절대 싣지 않습니다**(그게 CORS 규격입니다). 그래서 세션 없음 → `SESSION_EXPIRED` → 예외가 500으로 새어 나가고, 브라우저는 "ok status가 아니다"라며 본 요청을 보내지 않습니다.

**영향 범위가 넓습니다.** `Content-Type: application/json`이거나 `X-Session-Hash`가 붙으면 프리플라이트가 발생하므로, **실질적으로 `/api/session`과 `/actuator/health`를 뺀 전부**입니다. 실제로 브라우저에서 이 둘만 성공했습니다.

```
/actuator/health   200 {"status":"UP","db":"OK"}      ← 단순 요청
/api/session       200 {"sessionHash":"btdfxcn..."}   ← 헤더가 없어 프리플라이트 없음
/api/intake        실패 (Failed to fetch)              ← 프리플라이트 500
```

**고칠 곳**: 세션 필터에서 `OPTIONS`를 먼저 통과시키면 됩니다(`shouldNotFilter`에 `CorsUtils.isPreFlightRequest(request)` 또는 `"OPTIONS".equals(method)`). Spring Security를 쓰지 않는 구성이라 필터 순서만 조정하면 될 것으로 보입니다.

> **`curl`로는 이 문제가 드러나지 않습니다.** `curl`은 프리플라이트를 보내지 않아서 `/api/intake`가 정상 응답합니다. 브라우저에서만 막힙니다.

## 2. 🟠 기한이 지나면 "**-56일** 남았습니다"가 나갑니다

```
요청: when=2026-04-10, dueNoticeStatus=notified, dueNoticeDate=2026-05-01
응답: {"date":"2026-07-01","daysLeft":-56,
       "notice":"이의제기 기한까지 -56일 남았습니다. (2026-07-01)"}
```

`prd.md` FR-014는 경과 케이스를 따로 두고 있습니다.

> ※ 기한 경과가 확실한 경우에도 "불가능"이라고 단정하지 않고, 금융회사·전문가 확인이 필요하다고 안내한다.

**`notice`는 서버 단일 소스이고 프론트는 순화 없이 그대로 노출하기로 확정돼 있어**(`api-contract.md`), 이 문장이 그대로 사용자에게 갑니다. 기한이 지난 사용자는 이 서비스가 가장 조심해서 다뤄야 할 사용자인데, 지금 문구는 계산 실패처럼 읽힙니다.

프론트가 API 이전에 쓰던 문구를 참고로 남깁니다 — 그대로 쓰셔도 됩니다.

> 공고일부터 2개월이 지난 것으로 보입니다. (2026.07.01) 기한 경과 여부와 이후 절차는 금융회사와 전문가 확인이 필요합니다.

`daysLeft`를 음수로 내려주시는 것 자체는 괜찮습니다 — 프론트가 경과 여부를 알 수 있어 오히려 유용합니다. 문제는 `notice` 문장입니다.

## 3. 🟠 문진을 다시 보내도 `null`이 이전 값을 지우지 않습니다

같은 세션에서 두 번 호출한 결과입니다.

```
① when=2026-08-10, not_yet → "아직 공고 전이라면 기한이 남아 있습니다..."   (기대대로)
② when=null,       unknown → "아직 공고 전이라면 기한이 남아 있습니다..."   (③ 분기가 나와야 함)
```

②는 `when`이 `null`이므로 FR-014의 세 번째 분기("지급정지 통지서에서 날짜를 확인해 주세요…")가 나와야 합니다. **새 세션에서 같은 값을 처음 보내면 ③이 정상적으로 나옵니다** — 즉 분기 로직이 아니라 **재전송 시 병합**이 문제입니다.

**프론트는 문진을 여러 번 보냅니다.** 요약 칩을 눌러 앞 문항으로 돌아가 고칠 수 있고(F2-02), 그때마다 전체 문진을 다시 POST합니다. 사용자가 정지 시점을 날짜에서 **"모름"으로 바꾸면** 서버에는 옛 날짜가 남아 **틀린 기한 안내가 나갑니다.**

`/api/intake`는 전체 문진을 통째로 받는 엔드포인트이니 **PATCH가 아니라 PUT처럼(전체 교체)** 다뤄주시면 됩니다.

## 4. 🟡 `/api/timeline`에 계약에 없는 `evt_intake_when` 카드가 옵니다

증거를 하나도 올리지 않았는데 `events`에 이게 들어 있습니다.

```json
{ "event_id": "evt_intake_when", "source_image_index": null, "source_type": "unknown",
  "occurred_at": "2026-08-10", "actor": "self", "summary": "지급정지일 (본인 입력)",
  "confirmation_status": "user_confirmed", "field_confidence": { "occurred_at": "low", ... } }
```

계약의 카드 스키마는 **AI가 이미지에서 뽑은 이벤트**를 전제로 합니다. 문진에서 만든 유사 카드는 정의된 적이 없습니다. 나쁜 아이디어라는 뜻은 아니고 — 타임라인에 지급정지 시점이 찍히는 건 오히려 자연스럽습니다 — **정해두지 않으면 화면과 제출본이 갈립니다.** 실제로 갈립니다.

| | 지금 |
| --- | --- |
| `/api/timeline` `events` | `evt_intake_when` **있음** |
| 서버 PDF **3면** (같은 세션) | **없음** (표만 있고 행이 비어 있음) |

프론트 미리보기 3면은 `events`로 그리므로 **미리보기에는 "지급정지일 (본인 입력)"이 보이고 내려받은 PDF에는 없습니다.** F8-01이 "같은 면을 백엔드·프론트가 각자 그리므로 기준이 필요하다"고 한 바로 그 상황입니다.

**4면에도 걸립니다.** 이 카드는 `user_confirmed`라 4면 필터를 통과하고, `source_image_index: null`이라 2026-08-25 확정에 따라 **"본인 서술"** 로 표기됩니다. 그런데 **지급정지일은 증빙자료가 아닙니다.** 4면은 "올린 자료의 목차"인데 올린 적 없는 항목이 목차에 실립니다.

**확인 부탁**: ① 이 카드를 계약에 정식으로 넣을지 ② 넣는다면 3면에 포함되는지, 4면에서는 제외되는지. 제 의견은 **3면에는 포함, 4면에서는 제외**입니다 — 3면은 시간순 사실이고 4면은 첨부한 자료의 목차라 성격이 다릅니다. 프론트에서 거르려면 `event_id` 문자열을 파싱해야 하는데, 계약이 **불투명 문자열**이라고 못 박아 둔 값이라 그렇게 하고 싶지 않습니다. **구분할 수 있는 필드**(예: `source_type: "intake"` 또는 별도 플래그)를 주시는 쪽이 낫습니다.

## 5. 🟡 AI-server 미설정이 `400 INVALID_REQUEST`로 나옵니다

`AI_SERVER_URL`을 비운 채 호출한 결과입니다.

```
POST /api/evidence/text → 400 {"error":"INVALID_REQUEST",
                               "message":"... | URI with undefined scheme"}
POST /api/draft         → 400 {"error":"INVALID_REQUEST", ...}
```

제 환경 설정 실수라 그 자체는 문제가 아닙니다. 다만 **AI-server에 닿지 못하는 상황이 `4xx`로 나가면 프론트가 사용자 입력 오류로 다룹니다.** 계약상 이 경우는 `EXTRACTION_FAILED` / `DRAFT_FAILED`(502)입니다. 운영에서 AI-server가 죽거나 URL이 잘못 설정되면 같은 일이 생깁니다 — 연결 단계 실패도 502로 묶어주시면 좋겠습니다.

내부 예외 메시지(`URI with undefined scheme`)가 응답 `message`에 그대로 실려 나가는 것도 함께 봐주세요. 이 문자열은 프론트가 **화면에 그대로 노출**하는 값입니다.

## 6. 🟢 `gradlew`에 실행 권한이 없습니다

```
$ ./gradlew --version
zsh: permission denied: ./gradlew
$ git ls-files -s gradlew
100644 ... gradlew        ← 100755 여야 합니다
```

`sh gradlew`로 우회했습니다. 새로 클론하는 사람마다 걸립니다.

```
git update-index --chmod=+x gradlew && git commit -m "chore: gradlew 실행 권한"
```

## 7. ✅ 확인된 정상 동작

막힌 것만 적으면 균형이 안 맞으니 같이 적습니다. **이쪽이 훨씬 많습니다.**

| 항목 | 결과 |
| --- | --- |
| `POST /api/session` · `GET /actuator/health` | 정상 (`db: OK`) |
| 세션 없음 / 잘못된 해시 | **`410 SESSION_EXPIRED`** — 계약대로 |
| CORS 허용 origin 제한 | `https://evil.example` → **`403`**. 헤더 값(`x-session-hash` 포함)도 계약대로 |
| `/api/intake` 기한 계산 ①②③ | **분기·날짜·일수 전부 정확**. 프론트가 대신 계산하던 값과 일치 (기한 = 공고일 + 2개월) |
| `POST /api/readiness` | 체크리스트 스키마 8필드·`tier`·`options` 전부 계약대로 |
| 체크리스트 카탈로그 | **프론트 목과 일치.** `payer_match` goods 전용, `goods.trade_doc` 자가진술 — 요청하신 2건 그대로 |
| `POST /api/checklist/self-held` | 정상. 갱신된 전체 체크리스트 반환 |
| `GET /api/timeline` `gaps` | **신설 스키마 그대로** (`no_delivery_evidence` / `no_chat_evidence`, `suggestions` 포함) |
| **`POST /api/package/text`** | **5면 PDF 생성 성공 (34KB)** |

**PDF를 실제로 렌더해서 확인했습니다** — 가장 큰 미지수였던 항목입니다.

- **한글이 정상 렌더됩니다.** 서버 컨테이너 폰트 문제 없음 (`spec.md` F8-01 개발 주의 해소)
- 면 구성이 확정안 그대로입니다 — **표지 / 1면 서식 / 2면 진술서 / 3면 타임라인 / 4면 증빙목록**
- 1면이 원본 서식의 표 구조로 그려지고, 입력한 값(성명·생년월일·명의인)이 들어가며 **서명란은 비어 있습니다**
- 4면 헤더가 `순번 · 자료 유형 · 확인된 일시 · 요약 · 원본`으로 **B안 확정 그대로**입니다
- **저희 병합 코드에 그대로 붙습니다** — 서버 5면 + 원본 이미지 2장 = **7면**, 46KB. `pdf-lib` 병합·`pdf.js` 렌더 양쪽 통과

## 백엔드가 할 것

| # | 항목 | 시점 |
| --- | --- | --- |
| 1 | **§1 프리플라이트 500** — 세션 필터가 `OPTIONS`를 통과시키도록 | **가장 먼저.** 이게 풀려야 프론트가 연동을 시작합니다 |
| 2 | §2 기한 경과 `notice` 문구 | 위와 같이 |
| 3 | §3 `/api/intake` 재전송 시 전체 교체 | 위와 같이 |
| 4 | §4 `evt_intake_when`을 계약에 정의 + 3면/4면 포함 여부 + **구분 가능한 필드** | PDF 구현 마무리 전 |
| 5 | §5 AI-server 연결 실패를 `502`로, 내부 예외 메시지를 `message`에 싣지 않기 | 8/29 전 |
| 6 | §6 `gradlew` 실행 권한 | 언제든 |
