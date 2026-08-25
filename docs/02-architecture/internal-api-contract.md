# 내부 API 계약 (Backend ↔ AI-server)

> **수정 기록 (2026-08-26 ③, 백엔드)** — 위 `amount` 부호 확정 건 확인, 코드 변경 없음
> - 백엔드는 `amount`를 항상 **크기 비교(동등 비교)·포맷 출력**에만 씁니다(`TimelineServiceImpl`의 충돌 탐지, `EvidenceServiceImpl`의 `distinctAmounts`, `PackageServiceImpl`의 "%,d원" 포맷). 부호를 읽거나 가정하는 코드가 없어 **고칠 곳이 없습니다**

> **수정 기록 (2026-08-26 ②, 백엔드)** — 위 AI-server 변경분 구현 완료
> - `AiClientImpl`이 HTTP `500`을 별도로 잡아 `BusinessException(AI_CONFIG_ERROR)`를 즉시 던진다. **재시도하지 않는다** — `AiRetryableException`으로 감싸지 않아 `withRetry`의 재시도 루프를 아예 타지 않는다(QUOTA_EXCEEDED와 같은 층위). 공개 계약(`api-contract.md`)에도 같은 코드명·`500`으로 노출
> - `extractFromText`(텍스트 경로) 실패는 이제 `fallback` 없이, 메시지도 "입력하신 내용에서 사실을 확인하지 못했습니다"로 이미지 경로(`EXTRACTION_FAILED` 기본 메시지)와 분리했다

> **수정 기록 (2026-08-26, AI)** — 프론트 신고 `../request/ai/llm-provider-mismatch.md` 반영
> - **`AI_CONFIG_ERROR`(500) 신설.** LLM 키 미설정·인증 실패가 `EXTRACTION_FAILED`로 둔갑해 사용자를 텍스트 입력으로 보내던 문제를 분리했습니다. **재시도하지 않습니다**
> - **`fallback: "text_input"`은 이미지 경로에만** 붙습니다. 텍스트 경로 실패에 텍스트 입력을 대안으로 주면 같은 자리를 맴돕니다

> **수정 기록 (2026-08-25 ②, AI)** — 백엔드 회신 `../response/ai/draft-intake-input.md` §6 지적 반영
> - **`field_confidence.counterparty_name` / `payer_name`을 `null` 허용으로 변경.** 이름이 `null`인데 신뢰도가 `"high"`로 나가면 "값이 없는데 높은 신뢰도"라는 성립하지 않는 조합이 됩니다. **이름이 `null`이면 신뢰도도 `null`** 이라는 불변식을 AI-server가 결정적으로 보장합니다(LLM 판단에 맡기지 않음)
> - `occurred_at` / `actor` / `amount`의 신뢰도는 **종전대로 `null`을 허용하지 않습니다** — 프론트가 F4-06 카드에서 "높음 / 확인 필요" 배지로 항상 렌더하는 값이라 세 번째 상태를 만들지 않습니다. 대신 **값이 `null`인 필드의 신뢰도는 읽지 않는다**는 해석 규칙을 명시
> - 소명서 생성 프롬프트에 **과거 지급정지 이력 서술 금지**·**금액 평가 문장 금지** 조항 추가 (회신 §1 요청, TC-29 / PRD §14 OI-01)

> **수정 기록 (2026-08-25, 백엔드)** — AI 회신 3건(`../response/backend/card-source-type.md`, `payer-name-extraction.md`, `image-transfer-and-internal-auth.md`)의 스키마 확장을 한 번에 반영
> - 카드 스키마에 **`source_type`** 추가 (`chat/bank/shipping/threat/autopay/unknown`, 애매하면 `unknown`)
> - 카드 스키마에 **`counterparty_name` / `payer_name`** 추가 (해당 없으면 `null` — 추측 금지). `field_confidence`에도 같은 키 추가
> - **`event_id` 채번 규칙** 명시 (`evt_{image_index}_{n}` / `evt_txt_{n}`) — AI-server는 무상태이므로 세션 내 중복 처리는 백엔드 몫
> - `/internal/draft` 요청에 **`intake` 객체** 추가 (TC-06 자료 0건 경로가 현행 스키마로 불가능했던 문제). 요청: `../request/backend/draft-intake-input.md`
> - `evidenceRefs.type` **3종(`evidence` / `intake` / `user_text`)** 명시 — FR-045의 근거 유형과 일치
> - AI가 채우지 않는 값 명시 (`checklist`는 항상 `[]`, `quality_flags.amount_mismatch`는 항상 `false`)

> **수정 기록 (2026-08-25, AI)**
> - **이미지 전달 방식 확정** — `[결정: TODO]` 블록을 확정 내용으로 대체. **A 계열(바이트 그대로 전달)로 확정하되, 멀티파트 봉투 없이 이미지 바이트를 요청 raw body로 전달**합니다(`Content-Type: image/png`, 메타데이터는 쿼리 파라미터). base64 미사용(B 기각). 근거·상세는 회신 문서 `../response/backend/image-transfer-and-internal-auth.md` 참조
> - 텍스트 대체 경로(F3-04)의 요청 형식을 같은 절에 명시 (`application/json` — 같은 엔드포인트에서 Content-Type으로 구분)
> - AI-server가 반환하는 오류 코드 목록(`EXTRACTION_FAILED` / `TIMEOUT` / `QUOTA_EXCEEDED` / `DRAFT_FAILED`)을 오류 절에 명시
> - 하단 체크리스트의 이미지 전달 방식 항목 완료 처리

> **수정 기록 (2026-08-23, 백엔드)**
> - "인증 (착수 전 확정 필요)" 절 → 공유 시크릿 헤더 `X-Internal-Token` 확정 내용으로 대체. `/internal/health`는 무인증 공개 예외로 명시
> - 하단 체크리스트의 인증 항목 완료 처리, 이미지 전달 방식(A/B) 항목에 요청 문서 링크 추가
> - **이미지 전달 방식(A/B)은 여전히 미확정**입니다 — AI 담당 회신 대기

> 출처: `../00-context/prd.md` §9.1. 이 문서는 **백엔드와 AI 개발자 사이의 계약**입니다. `api-contract.md`(프론트-백엔드 공개 API)와는 별개입니다.
>
> 배경: AI 파이프라인이 백엔드에서 분리되어 독립 배포되는 별도 서버(AI-server)가 되었습니다. 프론트엔드는 이 API를 직접 호출하지 않습니다 — 항상 백엔드를 거칩니다.

## 엔드포인트

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/internal/extract` | 이미지(또는 텍스트) → 구조화된 카드(이벤트) + signals + qualityFlags |
| POST | `/internal/draft` | 타임라인 + 준비도 결과 → 소명서 초안 + 문장-근거 연결 + 사실검증 결과 |
| GET | `/internal/health` | AI-server 헬스체크 (킵얼라이브용, 외부 헬스체크 도구가 직접 호출) |

## 인증 (2026-08-23 확정)

**공유 시크릿 헤더 `X-Internal-Token`** 을 사용합니다. Render는 고정 아웃바운드 IP를 보장하지 않아 IP 허용목록 방식은 채택하지 않았습니다.

- 백엔드는 모든 `/internal/*` 호출에 헤더 `X-Internal-Token`을 부착합니다. 값은 양쪽 환경변수 `INTERNAL_TOKEN`으로 공유합니다.
- AI-server는 이 헤더가 없거나 값이 다르면 **401로 거부**합니다.
- **예외: `GET /internal/health`는 토큰 없이 접근 가능해야 합니다.** 외부 헬스체크 도구가 직접 호출하는 킵얼라이브 용도이기 때문입니다(`../03-infra-ops/deployment-and-uptime.md` §3).

- [x] 인증 방식 확정
- [ ] AI-server 측 401 검증 구현 (AI 담당)

## `POST /internal/extract`

### 요청 (2026-08-25 확정 — A 계열: 이미지 바이트 raw body 전달)

**이미지 경로** — 백엔드가 받은 이미지 바이트를 **그대로 요청 본문(raw body)으로** 전달합니다. 멀티파트 봉투도, base64 인코딩도 쓰지 않습니다. 이미지 1장당 1요청입니다(공개 API `/api/evidence`가 1장씩 병렬 호출되는 구조와 1:1 대응).

```
POST /internal/extract?image_index={n}
Content-Type: image/png          (또는 image/jpeg — 받은 파일의 실제 타입 그대로)
X-Internal-Token: {INTERNAL_TOKEN}

<이미지 바이트 그대로>
```

| 항목 | 값 |
| --- | --- |
| `image_index` (쿼리, 필수) | 이 이미지의 세션 내 순번(0-base). 응답 카드의 `source_image_index`로 그대로 반사됨 — 프론트 blob 배열 인덱스와 일치해야 함 |
| 본문 크기 상한 | 10MB (공개 API와 동일) |
| Spring 측 호출 예 | `RestClient` — `.contentType(MediaType.IMAGE_PNG).body(bytes)` (멀티파트 빌더 불필요) |

**텍스트 경로 (F3-04)** — 같은 엔드포인트에 `Content-Type: application/json`으로 보냅니다. AI-server는 Content-Type으로 두 경로를 구분합니다.

```json
POST /internal/extract
Content-Type: application/json
X-Internal-Token: {INTERNAL_TOKEN}

{ "rawText": "9월 2일쯤 당근에서 아이패드를 팔고 45만원을 입금받았습니다. ..." }
```

- 텍스트 경로 카드의 `source_image_index`는 `null`, `occurred_at`의 `field_confidence`는 **전부 `low`** 입니다(F3-04 처리 — AI-server가 승격하지 않고, 백엔드도 승격하지 않음).
- `rawText` 최대 2000자(공개 API와 동일). 텍스트 경로에서도 협박 감지(`threat_detected`)는 동일하게 수행합니다.
- **`rawText`는 이미 프론트가 마스킹(주민번호·전화번호·계좌번호)을 마친 값입니다** (2026-08-25 확정, `FR-027` 주체 명시). AI-server의 `pii.py` 후처리는 그대로 두되 이중 방어로 취급하세요 — 원문이 아니라 이미 가려진 텍스트가 옵니다. 평가 세트에서 "개인정보 미추출"을 잴 때 입력 조건이 이 사실을 반영해야 합니다.

> **B(base64 JSON)를 기각한 이유**: 본문이 약 33% 커지고 양쪽에 인코딩/디코딩 버퍼가 한 번 더 뜹니다(Render 512MB). **멀티파트 봉투를 쓰지 않는 이유**: 서버 프레임워크의 멀티파트 파서는 큰 파트를 임시 파일로 디스크에 스풀링하는 것이 일반적이라 "이미지를 디스크에 쓰지 않는다"(`../03-infra-ops/privacy-and-safety.md`) 원칙과 충돌 위험이 있습니다. raw body는 메모리에만 존재함을 구조적으로 보장하고, 양쪽 코드도 더 단순합니다. 상세: `../response/backend/image-transfer-and-internal-auth.md`

### 응답 — 추출 카드 스키마

`api-contract.md`의 FR-021/FR-028 스키마와 동일합니다 (외부 API 응답과 내부 API 응답이 같은 형식을 씁니다 — 백엔드는 이 응답을 거의 그대로 프론트에 전달만 합니다).

```json
{
  "cards": [
    {
      "event_id": "evt_2_1",
      "source_image_index": 2,
      "source_type": "chat | bank | shipping | threat | autopay | unknown",
      "occurred_at": "2026-09-02T14:12:00+09:00",
      "actor": "self | counterparty | system",
      "summary": "물품대금 700,000원 입금",
      "amount": 700000,
      "counterparty_name": "김OO",
      "payer_name": null,
      "identifiers": { "tracking_no": null, "account_last4": null },
      "field_confidence": {
        "occurred_at": "high | medium | low",
        "actor": "high | medium | low",
        "amount": "high | medium | low",
        "counterparty_name": "high | medium | low | null",
        "payer_name": "high | medium | low | null"
      },
      "source_region": { "x": 0.18, "y": 0.31, "w": 0.62, "h": 0.12 },
      "confirmation_status": "pending"
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

> **`qualityFlags`(카드별)** 는 `api-contract.md`에는 있었으나 이 문서에 빠져 있던 필드입니다 (2026-08-25 보완). `signals.quality_flags`가 **이미지 전체**의 품질이라면, `qualityFlags`는 **`event_id`를 키로 한 카드별** 품질입니다. 두 계약이 같은 형식이어야 백엔드가 변환 코드를 짜지 않으므로 여기에 명시합니다.

`signals.threat_detected: true`는 백엔드가 받는 즉시 프론트엔드에 전달되어야 하는 신호입니다 — 백엔드가 버퍼링하거나 다음 단계까지 지연시키지 않습니다.

#### `source_type` (2026-08-25 확정)

**이벤트(카드) 단위** 값입니다. 이미지 단위가 아닙니다 — 대화 캡처 안에 송금 알림이 함께 찍힌 것처럼 **한 이미지에 유형이 섞이는 경우가 흔하기** 때문에, LLM이 이벤트를 분리 추출하는 시점에 유형도 함께 판정합니다. 응답 최상위에는 `source_type`을 두지 않습니다(이벤트 단위 값이 있으면 중복).

| 백엔드 사용처 | 내용 |
| --- | --- |
| F5-01 동시각 tie-break | `chat(0) → bank(1) → shipping(2) → threat(3) → autopay(4) → unknown(5)`. **`unknown`은 최하위** (2026-08-25 ② `threat`·`autopay` 자리 보완 — `../response/backend/card-source-type.md`). 화면 표시 순서일 뿐 의미 판정이 아니다 |
| F5-03 ③ 대화 유무 판정 | `source_type == "chat"` 카드의 존재 여부 |

판정이 애매한 이벤트는 AI-server가 추측하지 않고 `unknown`으로 내립니다.

#### `event_id` 채번 규칙 (2026-08-25 확정)

AI-server는 **무상태**(세션을 모름)이므로, 호출 간 ID 충돌을 피하기 위해 이미지 인덱스를 ID에 포함합니다.

| 경로 | 형식 | 예 |
| --- | --- | --- |
| 이미지 | `evt_{image_index}_{n}` | 2번 이미지의 두 번째 이벤트 → `evt_2_2` |
| 텍스트 (F3-04) | `evt_txt_{n}` | `evt_txt_1` |

- 백엔드는 이 ID를 **불투명 문자열**로 취급합니다 (파싱해서 의미를 꺼내 쓰지 않습니다).
- **같은 `image_index`로 재추출이 일어나면 ID가 충돌합니다** (사용자가 카드를 지우고 같은 자리에 다시 올리는 경우). 세션을 아는 쪽은 백엔드이므로, **세션 내 중복은 백엔드가 기존 카드 대체로 처리**합니다.

#### `counterparty_name` / `payer_name` (2026-08-25 추가)

금감원 표준 소명자료의 **"구매자와 송금인이 일치하는지 확인할 수 있는 자료"** 를 채우기 위한 필드입니다 (`../01-product/reason-type-rules.md` §2-1).

| 필드 | 출처 | 없으면 |
| --- | --- | --- |
| `counterparty_name` | 대화 캡처에 보이는 **대화 상대 표시명·닉네임** | `null` |
| `payer_name` | 입금 내역 캡처의 **입금자 표기** | `null` |

- **추측해서 채우지 않습니다.** 말풍선만 보고 상대명을 유추하는 것은 AI-server 프롬프트의 금지 조항입니다. 상단바가 잘린 캡처는 그냥 `null`입니다.
- **대조는 백엔드가 합니다.** AI-server는 `payer_matches` 같은 판정 필드를 만들지 않습니다. 백엔드도 **둘 다 값이 있을 때만 대조**합니다 — `null` ≠ 불일치입니다.
- **불일치는 위험 신호가 아닙니다.** 닉네임과 실명이 다른 것은 정상입니다. 대조 결과는 "설명이 필요한 항목"으로만 다루며, AI-server는 이름 불일치에 대한 해석·평가 문장을 생성하지 않습니다.
- 값이 있는 카드는 F4-06 확인 카드에 노출되어 **사용자가 확인·정정**합니다 (잘못 읽은 이름이 그대로 대조에 쓰이는 것을 막는 장치).

##### 신뢰도의 `null` (2026-08-25 ② 확정 — 백엔드 회신 §6 반영)

**`counterparty_name`이 `null`이면 `field_confidence.counterparty_name`도 `null`입니다** (`payer_name`도 같습니다). 값이 없는데 "높은 신뢰도"라는 조합은 의미가 성립하지 않고, 백엔드가 신뢰도로 대조 여부를 거르면 오작동합니다.

이 불변식은 **AI-server가 후처리에서 결정적으로 보장**합니다 — LLM이 뭘 내놓든 이름이 `null`인 카드의 이름 신뢰도는 `null`로 덮어씁니다. LLM에게 "값이 없으면 신뢰도도 비우라"고 시키는 것은 비결정적이므로 채택하지 않았습니다(이름 마스킹을 기각한 것과 같은 이유).

| 필드 | 신뢰도 `null` 허용 | 이유 |
| --- | --- | --- |
| `counterparty_name` · `payer_name` | **허용** | 값 자체가 없을 수 있는 선택 필드. 백엔드는 **둘 다 값이 있을 때만 대조**하므로 `null`을 그대로 처리 |
| `occurred_at` · `actor` · `amount` | **불허** (종전대로 3값) | 프론트가 F4-06 카드에서 "높음 / 확인 필요" 배지로 **항상** 렌더하는 값입니다. 세 번째 상태를 만들면 프론트 분기가 늘어납니다 |

> **해석 규칙 — 값이 `null`인 필드의 신뢰도는 읽지 마세요.** `amount`가 `null`인 카드(금액이 없는 대화 캡처, 흐려서 못 읽은 금액)의 `field_confidence.amount`는 의미 없는 값입니다. **"금액을 못 읽었다"의 단일 출처는 `amount == null`** 이고, 날짜는 `occurred_at == null`과 `qualityFlags[event_id].missing_date`입니다. FR-028의 low 신뢰도 차단은 **값이 있는 카드**에만 적용하세요.

> **값의 형태 (2026-08-25 확정 — 화면 표시명 그대로)**: 부분 마스킹(`김O수`)은 채택하지 않습니다. ① 동성·동돌림자 오탐(김민수/김영수 → 둘 다 `김O수`)으로 판별력이 떨어지고 ② **마스킹 규칙 자체를 LLM에 시키면 2글자 이름·법인명·외국명에서 비결정적**이 되어, 결정적 대조 로직의 전제가 깨집니다. 대신 **추출 범위를 거래 당사자로 한정**하는 것으로 개인정보 원칙을 지킵니다 — 상세와 근거는 `../03-infra-ops/privacy-and-safety.md` "거래 당사자 표시명 예외" 절. 판단 근거: `../response/backend/payer-name-extraction.md` §2.

#### AI-server가 채우지 않는 값 (2026-08-25 확약)

스키마에는 있지만 AI-server가 의미 있는 값을 넣지 않는 필드입니다. 백엔드는 **AI 응답의 이 값을 읽지 않습니다.**

| 필드 | AI가 보내는 값 | 실제 단일 출처 |
| --- | --- | --- |
| `signals.quality_flags.amount_mismatch` | 항상 `false` | 백엔드 — 카드 간 교차 대조는 이미지 1장만 보는 AI가 판단할 수 없습니다 |
| `/internal/draft` 응답의 `checklist` | 항상 `[]` | 백엔드 (F7-03 담당은 `A`) |

`blurry` / `missing_date`는 AI-server가 산출합니다.

> **`source_region`(bbox)의 정확도**: LLM 비전 특성상 **근사 좌표**입니다. F7-05 P0 범위(이미지 열기 + 스크롤 이동)에는 충분하지만, 정밀 하이라이트(P1)에 쓸 픽셀 정확도는 보장되지 않습니다. 실측치는 평가 세트(F11-05)에서 나옵니다.

## `POST /internal/draft`

### 요청

```json
{
  "events": [ /* 타임라인 이벤트 배열, confirmed=true 추출 카드만 */ ],
  "reason": "goods | service | debt | unclear",
  "readiness": "SUBMISSION_READY | SUPPLEMENT_NEEDED | BANK_CHECK_REQUIRED",
  "intake": {
    "when": "2026-09-04",
    "amount": 450000,
    "kind": "goods",
    "usage": "main"
  }
}
```

`reason`, `readiness`는 백엔드의 `ReadinessService`가 이미 결정한 값을 그대로 전달합니다. **AI-server는 이 값을 재해석하거나 다시 판단하지 않습니다** — 문장 생성에만 사용합니다.

#### `intake` 객체 (2026-08-25 추가)

**자료 0건 경로(TC-06)가 현행 스키마로 불가능했습니다.** `events`가 빈 배열일 때 소명서 골격을 만들 재료가 없었기 때문입니다. FR-045도 근거 유형에 `intake`를 명시하고 있어, 문진이 소명서 입력이라는 것은 스펙상 이미 확정이었습니다. 요청: `../request/backend/draft-intake-input.md`.

| 필드 | 내용 | 없으면 |
| --- | --- | --- |
| `when` | 지급정지일 | `null` |
| `amount` | 문제 입금액 — **소명서 사실 기재 전용** (`../01-product/reason-type-rules.md`: 준비도 판정에 쓰지 않습니다) | `null` |
| `kind` | 거래 성격 | `null` |
| `usage` | 계좌 사용 목적 — "주 거래 계좌" 서술용 | `null` |

- 필드명은 공개 API `/api/intake` 요청 필드를 그대로 씁니다 (같은 값에 새 이름을 만들지 않습니다).
- **`history`·`dueNotice*`는 전달하지 않습니다.** 이 둘은 준비도 판정(`BANK_CHECK_REQUIRED` 분기)에만 쓰이는 값이고 그 판정은 백엔드에서 이미 끝나 `readiness`로 전달됩니다. 소명서 사실 기재에 과거 이력을 적을 이유가 없고, 적으면 오히려 불리한 정보를 사용자가 스스로 제출하는 문서에 넣게 됩니다.
- **`intake`가 통째로 없거나 `null`이어도 오류가 아닙니다** — AI-server는 `events`만으로 생성합니다.

#### `events`에 넣지 않는 것 — 지급정지일 합성 이벤트

F5-01은 백엔드가 지급정지일을 "사용자 진술 / 낮은 신뢰도" 이벤트로 **타임라인에 삽입**한다고 정의합니다. 이 합성 이벤트는 **`/internal/draft`의 `events`에 넣지 않습니다.**

`events`는 "사용자가 확인한 추출 카드"로만 유지합니다. 합성 이벤트가 섞여 들어가면 AI-server가 그것을 `evidence` 근거로 오인해 "근거 있는 사실"처럼 서술하게 됩니다. 문진에서 온 사실은 전부 `intake`로 전달되며, 이 분리가 FR-045의 근거 유형 구분과 정확히 일치합니다.

> 합성 이벤트는 **타임라인 표시(F5-01)와 공백 탐지(F5-03)에서는 그대로 사용**합니다. 제외 대상은 소명서 생성 입력뿐입니다.

#### 소명서에 쓰지 않는 것 (2026-08-25 ② 확약 — 백엔드 회신 §1 요청)

입력으로 들어오지 않는 것에 더해, **들어온 값으로도 쓰지 않는 문장**이 있습니다. AI-server가 프롬프트 금지 조항 + 결정적 금칙어 검사(FR-045)의 **이중 방어**로 막습니다.

| 쓰지 않는 것 | 이유 | 검증 |
| --- | --- | --- |
| **과거 지급정지 이력**·다른 사건에 대한 서술 | 사용자에게 불리한 정보를 본인이 은행에 내는 문서에 스스로 적어 넣게 만들지 않습니다. `history`는 애초에 전달되지 않습니다 | TC-29 |
| **금액에 대한 평가** ("소액이므로", "금액이 크지 않아") | '소액' 기준은 은행 내규로 비공개입니다 — 추정 금지 (PRD §14 OI-01). `intake.amount`는 **사실 기재 전용** | 금칙어 검사 |
| **이름 일치·불일치에 대한 해석** ("입금자명이 일치하지 않습니다") | 대조는 백엔드가 합니다. 삼각사기 피해자는 원래 불일치하므로 AI가 이를 문장으로 만들면 사용자를 해칩니다 | TC-25 |

두 번째·세 번째 항목은 LLM 프롬프트만으로 막지 않고 **생성 후 금칙어 검사로 문장을 삭제**합니다 — 프롬프트 준수는 확률적이고, 이 문장들은 한 번만 새어나가도 사용자에게 손해이기 때문입니다.

### 응답

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
    }
  ],
  "checklist": [],
  "factCheckPassed": true
}
```

`evidenceRefs`는 이미지 파일이 아니라 **참조(imageIndex, bbox)만** 담습니다 — AI-server도 원본 이미지를 갖고 있지 않으므로(LLM 호출 후 즉시 폐기) 참조만 넘길 수 있습니다. `factCheckPassed: false`이면 백엔드는 이 응답을 그대로 프론트에 전달하지 않고 재시도 로직(`../00-context/prd.md` §10.3)을 따릅니다.

#### `evidenceRefs.type` — 근거 유형 3종 (2026-08-25 확정)

FR-045가 정의한 세 가지 근거 유형과 1:1로 대응합니다.

| `type` | 언제 | 함께 오는 필드 |
| --- | --- | --- |
| `evidence` | 이미지에서 추출된 카드가 근거인 문장 | `imageIndex`, `bbox` |
| `intake` | 문진 응답이 근거인 문장 (TC-06 자료 0건 경로 포함) | 없음 |
| `user_text` | 텍스트 직접 입력(F3-04) 카드가 근거인 문장 — `source_image_index`가 `null`인 카드 | 없음 |

- **`intake` / `user_text`는 "본인 진술" 배지 대상입니다** (FR-045 ⑤). 프론트는 `type`이 이 둘 중 하나면 배지를 렌더합니다. 이 규칙은 공개 API 쪽 단일 출처인 `api-contract.md` `/api/draft` 응답 절에도 같은 내용으로 적혀 있습니다.
- 텍스트 입력 카드는 이미 `events`에 포함되므로 `/internal/draft` 요청에 별도 필드가 필요 없습니다.

## 오류 응답 (공개 API와 동일한 형식 재사용)

```json
{
  "error": "EXTRACTION_FAILED",
  "message": "이미지에서 내용을 읽지 못했습니다.",
  "fallback": "text_input"
}
```

백엔드는 이 오류를 받으면 공개 API 응답의 `fallback` 필드를 `/api/evidence/text`로 바꿔서 프론트에 전달합니다 (내부 경로를 외부에 노출하지 않음).

**AI-server가 반환하는 오류 코드** (2026-08-25 확정):

| error 코드 | HTTP | 상황 | `fallback` |
| --- | --- | --- | --- |
| `EXTRACTION_FAILED` | 502 | 판독 실패 (LLM 응답 불가·스키마 불일치 재시도 후 실패·안전 거부) | `"text_input"` |
| `TIMEOUT` | 504 | AI-server 내부 LLM 호출 시간 초과 | `"text_input"` |
| `QUOTA_EXCEEDED` | 429 | LLM API 쿼터·레이트리밋 초과 — 백엔드는 데모 모드 폴백(F4-05) | 없음 |
| `DRAFT_FAILED` | 502 | `/internal/draft` 생성 실패 (스키마 불일치 재시도 후 실패 등) | 없음 |
| **`AI_CONFIG_ERROR`** | **500** | **AI-server 설정 오류 (LLM API 키 미설정·인증 실패). 사용자 입력과 무관하다** | **없음** |
| (401 Unauthorized) | 401 | `X-Internal-Token` 누락·불일치 | 없음 |

#### `AI_CONFIG_ERROR` — 사용자에게 재시도를 요구하지 마세요 (2026-08-26 신설)

**AI-server의 설정이 잘못된 상태**입니다. 사용자가 무엇을 다시 올리든 결과가 같습니다.

- 백엔드는 이 코드를 받으면 **텍스트 입력으로 유도하지 않습니다.** "일시적인 오류" 계열 안내로 처리하고, **AI 담당에게 알려야 하는 상황**입니다.
- **AI-server는 이 오류에 재시도하지 않습니다.** 키가 없는 상태를 다시 불러도 결과가 같아서 LLM 호출만 두 배가 됩니다.
- 종전에는 이 상황이 `EXTRACTION_FAILED`(502, `fallback: "text_input"`)로 나갔습니다. **설정 오류가 판독 실패로 둔갑해 사용자를 텍스트 입력으로 보내던 문제**를 프론트가 로컬 연동에서 발견해 분리했습니다 (`../request/ai/llm-provider-mismatch.md`).

#### `fallback: "text_input"`은 이미지 경로에만 붙습니다 (2026-08-26 명확화)

**텍스트 경로(F3-04) 요청이 실패하면 `fallback`을 주지 않습니다.** 이미 텍스트로 보낸 요청에 "텍스트로 입력하세요"를 대안으로 주면 같은 자리를 맴돕니다. 실패 메시지도 경로에 맞게 나갑니다 — 텍스트 요청에 "이미지에서 내용을 읽지 못했습니다"라고 답하지 않습니다.

| 경로 | 실패 시 `error` | `fallback` |
| --- | --- | --- |
| 이미지 (`Content-Type: image/*`) | `EXTRACTION_FAILED` / `TIMEOUT` | `"text_input"` |
| 텍스트 (`Content-Type: application/json`) | `EXTRACTION_FAILED` / `TIMEOUT` | **없음** |

`factCheckPassed: false`는 오류가 아니라 **정상 200 응답**입니다 — 백엔드가 재시도 로직(1회)을 따릅니다.

## 타임아웃 및 재시도

| 항목 | 값 |
| --- | --- |
| `/internal/extract` 타임아웃 | 20초 (PRD NFR-01 기준) |
| `/internal/draft` 타임아웃 | 15초 |
| 백엔드의 재시도 정책 | 1회, 동일 요청 재전송. 실패 시 오류 응답을 그대로 프론트에 전달 |

## 체크리스트

- [x] 인증 방식 확정 (`X-Internal-Token`) — AI-server 측 검증 구현은 진행 중
- [x] 이미지 전달 방식 확정 (2026-08-25, A 계열 raw body) — 회신: `../response/backend/image-transfer-and-internal-auth.md`
- [ ] AI-server가 `/internal/*` 응답 스키마를 `api-contract.md`와 동일하게 맞췄는지 확인 — 스키마가 둘로 갈라지면 백엔드가 매번 변환 코드를 짜야 합니다
- [ ] `/internal/health`가 외부 헬스체크 도구에서 접근 가능한지 확인 (킵얼라이브 목적이므로 이 엔드포인트만은 공개되어야 함)
- [ ] AI-server도 이미지를 처리 완료 즉시 폐기하는지 확인 (원본이 AI-server에도 남지 않아야 함, `../03-infra-ops/privacy-and-safety.md` 참조)
