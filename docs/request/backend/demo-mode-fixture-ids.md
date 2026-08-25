# [프론트 → 백엔드] 데모 모드로 전 구간을 돌렸습니다 — 픽스처의 `event_id`·`source_image_index`가 실제 업로드와 어긋납니다

> **상태: ⏳ 회신 대기** (요청 2026-08-26)
> 회신은 `../../response/frontend/demo-mode-fixture-ids.md`에 들어옵니다.
> **막고 있는 작업**: 없음 — 실 LLM 모드에서는 발생하지 않습니다. 다만 **데모 모드가 발표 경로(F11-03)이자 `QUOTA_EXCEEDED` 폴백**이라 그 자리에서 드러납니다.

- 작성: 프론트엔드 · 2026-08-26
- 확인 환경: 로컬 3층 (Postgres + `DEMO_MODE=true` 백엔드 + Vite `localhost:5173`), **프론트 API 클라이언트(`lib/api/`)로 브라우저에서 호출**
- 배경: CORS 수정 확인 겸 데모 모드로 세션부터 PDF 병합까지 전부 돌려봤습니다. **AI-server는 띄우지 않았습니다** — 데모 모드가 호출 자체를 하지 않아 필요 없었습니다.

## 먼저: CORS 프리플라이트 수정 확인했습니다

```
OPTIONS /api/intake  (Origin: http://localhost:5173)  →  200
```

브라우저에서 `/api/intake`·`/api/evidence`·`/api/readiness`·`/api/draft`·`/api/package/text` 전부 정상 호출됐습니다. **프론트 연동을 막던 블로커가 풀렸습니다.**

## 1. 데모 모드에서 `event_id`가 겹칩니다 — 확인할 수 없는 카드가 남습니다

이미지 3장을 `imageIndex` 0·1·2로 올린 결과입니다.

| `imageIndex` | 픽스처 | 돌아온 `event_id` |
| --- | --- | --- |
| 0 | `extract-tc01` | `evt_0_1`, `evt_0_2`, `evt_1_1`, `evt_2_1`, `evt_3_1` |
| 1 | `extract-tc02` | `evt_0_1` |
| 2 | `extract-tc03` | `evt_0_1`, `evt_0_2`, `evt_0_3`, `evt_1_1`, `evt_2_1` |

**카드 11장인데 고유 `event_id`는 6개입니다.** `evt_0_1`만 세 번 나옵니다.

`/api/evidence/confirm`은 `cardId`로 카드를 특정합니다. 고유 id 6개를 전부 확인했더니 이렇게 끝났습니다.

```
{ "ok": true, "confirmedCount": 6, "unconfirmedCount": 2 }
```

**확인할 방법이 없는 카드가 2장 남습니다.** 그 카드의 `event_id`는 이미 다른 카드가 가져갔기 때문입니다.

**여기서 잠길 수 있습니다.** 남은 카드 중 하나라도 날짜·금액이 `low` 신뢰도면 `/api/readiness`가 계속 `409 UNCONFIRMED_FIELDS`를 냅니다. 화면은 "확인해주세요"라고 안내하는데 **누를 카드가 없습니다.** 이번 조합에서는 우연히 저신뢰 카드가 없어 넘어갔습니다.

## 2. `source_image_index`가 보낸 `imageIndex`와 다릅니다

`imageIndex: 4` **한 장**만 올린 결과입니다.

```
보낸 것:  imageIndex = 4
받은 카드: source_image_index = 0, 1
```

회신(`../../response/frontend/evidence-timeline-schema-additions.md`)에서 이렇게 확정해 주셨던 부분입니다.

> 백엔드는 `imageIndex`를 계산하거나 검증하지 않습니다. (…) AI 응답의 `source_image_index`도 그 값을 그대로 반영합니다.

**데모 모드에서는 이 보장이 성립하지 않습니다.** 픽스처가 자기 시나리오의 인덱스를 그대로 들고 오기 때문입니다. 프론트에는 이렇게 드러납니다.

- **`[원본 보기]`** — `source_image_index`로 메모리의 blob 배열을 찾는데(F7-05), 없는 인덱스를 가리킵니다
- **4면 "원본 n번"** — 3장 올렸는데 "원본 4번"이 적힙니다. 5면에는 그 장이 없습니다

`/api/draft` 픽스처도 같습니다 — `evidenceRefs`가 `imageIndex` 0~3을 가리키는데, 그 세션에서 실제로 올린 이미지는 1장이었습니다.

## 3. 제안

**픽스처를 반환하기 직전에 인덱스를 다시 매기면 됩니다.** 파일 내용은 그대로 두고 `DemoFixtures`에서 한 겹 덮어쓰는 방식입니다.

| 대상 | 규칙 |
| --- | --- |
| `source_image_index` | 호출 시 받은 `imageIndex`로 **전부 교체** |
| `event_id` | `evt_{imageIndex}_{n}` 으로 재발급 (`n`은 그 응답 안의 순번) |
| `/internal/draft` 픽스처의 `evidenceRefs.imageIndex` | 세션의 실제 업로드 장수 안으로 클램프하거나, 넘어가는 ref는 `type: "intake"`처럼 이미지 참조가 없는 형태로 |

**픽스처 파일 자체를 고치는 것보다 낫다고 봅니다** — AI 담당이 납품한 값이라 손대면 다음 갱신 때 다시 어긋납니다. 반환 시점 변환이면 픽스처가 바뀌어도 유지됩니다.

## 4. 이건 프론트 버그였습니다 — 고쳤습니다 (참고)

같이 발견한 것이라 적어둡니다. **업로드가 전부 400으로 떨어졌습니다.**

```
WARN [EvidenceService] 파일 검증 실패로 스킵: blob
WARN [BusinessException] code=INVALID_REQUEST ... | 유효한 이미지 파일이 없습니다
```

원인은 프론트였습니다. 마스킹 결과가 `File`이 아니라 **`Blob`** 이라 `FormData`에 이름 없이 넣었고, 브라우저가 파일명을 `blob`으로 보내 확장자 화이트리스트(F3-02 ①)에 걸렸습니다. `form.append("files", file, "evidence-{n}.png")`로 고쳤고 정상 통과합니다.

**사용자 파일명은 쓰지 않습니다** — `카톡_김철수_20260901.png`처럼 개인정보가 섞입니다. 4면에 파일명을 넣지 않기로 한 것과 같은 이유고, 판독에 파일명이 쓰이지 않아 잃는 것도 없습니다.

## 5. ⚠️ `AI_CONFIG_ERROR`(500)를 `AiClientImpl`이 잡지 않는 것 같습니다

오늘 AI 담당이 내부 계약에 `AI_CONFIG_ERROR`(**500**)를 신설했습니다(`../../response/frontend/llm-provider-mismatch.md`). LLM 키 미설정·인증 실패를 `EXTRACTION_FAILED`에서 떼어낸 것입니다.

`AiClientImpl.callOnce`의 `catch` 절을 보면 429·401·**502**·**504**·`ResourceAccessException`·`IllegalArgumentException`은 있는데 **일반 500(`HttpServerErrorException.InternalServerError`) 분기가 없습니다.** 이대로면 매핑되지 않은 채 밖으로 나가 프론트가 계약에 없는 코드를 받게 됩니다(우리 클라이언트는 `UNKNOWN`으로 떨어뜨려 "잠시 문제가 생겼어요. 다시 시도해주세요"를 띄웁니다 — **재시도해도 해결되지 않는 상황**입니다).

데모 모드로 테스트해서 직접 재현하지는 못했습니다. 코드만 보고 짚는 것이라 **이미 처리되고 있다면 넘어가 주세요.**

## 6. ✅ 정상 확인 — 이번에도 이쪽이 많습니다

프론트 API 클라이언트로 브라우저에서 호출한 결과입니다.

| 항목 | 결과 |
| --- | --- |
| `X-Session-Hash` 자동 주입 | 정상. `createSession` 후 모든 호출에 실림 |
| `demoMode: true` 전달 | 정상 (`/api/session` 응답) |
| `/api/intake` 기한 계산 | `2026-10-15 · 50일` — 프론트 계산과 일치 |
| **F4-06 서버 게이팅** | **정확히 동작.** 저신뢰 카드 미확인 → **`409 UNCONFIRMED_FIELDS`**, 확인 후 통과 |
| 오류 매핑 | `409`가 클라이언트에서 `code`·`status` 그대로 잡힘 |
| `/api/timeline` | `intake` 카드 **`user_confirmed` + `occurred_at: low`** — 예상대로 |
| `checklist` 스키마 | 12항목, `tier`·`fulfillBy`·`whenMissing`·`options`(옵션별 `status`) 전부 계약대로 |
| `payer_match` / `goods.trade_doc` | goods 전용 / `self`·`silent` — 합의대로 |
| `/api/checklist/self-held` | `unmet` → **`met`** 갱신 정상 |
| `conflicts` | 금액 충돌 문장이 실제로 내려옴 |
| `/api/draft` | 문장 5개 + `evidenceRefs`(`type: "evidence"`, `imageIndex` 포함) |
| `/api/draft/revise` | 제외 문장이 배열에서 빠짐 (5 → 4) — 계약대로 |
| **`/api/package/text` → 병합** | 서버 5면 + 원본 이미지 2장 = **7면 56KB**, `pdf.js` 렌더까지 통과 |

## 백엔드가 할 것

| # | 항목 | 시점 |
| --- | --- | --- |
| 1 | §3 — `DemoFixtures` 반환 시 `event_id`·`source_image_index` 재발급 | **데모 리허설 전** |
| 2 | §5 — `AiClientImpl`이 `AI_CONFIG_ERROR`(500)를 계약 코드로 매핑하는지 확인 | 실 LLM 연동 전 |
