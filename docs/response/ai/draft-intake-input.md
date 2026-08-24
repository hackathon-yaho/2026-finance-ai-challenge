# [백엔드 → AI] 회신: `/internal/draft` 요청에 문진 데이터 추가

- 원본 요청: `../../request/backend/draft-intake-input.md` (2026-08-25)
- 회신: 백엔드 · 2026-08-25
- 반영한 문서: `../../02-architecture/internal-api-contract.md`, `../../02-architecture/api-contract.md`

## 결론 — **요청 원안 전부 수용.** 계약 문서 갱신 완료했습니다

지적이 맞습니다. FR-045가 근거 유형에 `intake`를 명시해 두고 요청 스키마에는 문진이 들어갈 자리가 없었으니, 계약 쪽 누락이었습니다. TC-06이 계약상 불가능했다는 것도 사실입니다.

## 1. `intake` 객체 — 제안하신 4필드 그대로

```json
{
  "events": [ /* confirmed=true 추출 카드만 */ ],
  "reason": "goods | service | debt | unclear",
  "readiness": "SUBMISSION_READY | SUPPLEMENT_NEEDED | BANK_CHECK_REQUIRED",
  "intake": { "when": null, "amount": null, "kind": null, "usage": null }
}
```

- 필드명을 `/api/intake`와 맞춘 판단에 동의합니다. 같은 값에 이름을 둘로 만들 이유가 없습니다.
- **`intake`가 통째로 없거나 `null`이어도 오류가 아닙니다.** `events`만으로 생성해 주세요. 반대 방향(`events` 빈 배열 + `intake` 있음)이 바로 TC-06 경로입니다.
- 각 필드도 개별적으로 `null` 가능합니다 — 문진은 건너뛸 수 있습니다.

### `history`·`dueNotice*`를 뺀 것 — 확정입니다

빼신 판단이 맞고, 이유를 하나 더 붙입니다.

- 이 둘은 준비도 판정(`BANK_CHECK_REQUIRED` 분기)에만 쓰이는 값이고, 그 판정은 백엔드에서 이미 끝나 `readiness`로 전달됩니다. 같은 정보를 두 경로로 보낼 이유가 없습니다.
- 더 중요한 이유: **과거 지급정지 이력은 사용자에게 불리한 정보**입니다. 이 소명서는 사용자 본인이 은행에 제출하는 문서인데, 묻지도 않은 과거 이력을 스스로 적어 넣는 문서를 만들면 서비스가 사용자를 해치는 것이 됩니다. **소명서 본문에 과거 이력을 서술하지 마세요** — 프롬프트 금지 조항으로 넣어 주시길 요청합니다.

### `amount`는 사실 기재 전용

`reason-type-rules.md`가 정한 대로 **입금액은 준비도 판정에 쓰지 않습니다.** `intake.amount`도 소명서의 사실 기재("450,000원을 입금받았습니다")에만 쓰고, "소액이므로 유리하다" 같은 평가 문장을 만들지 마세요 — PRD §14 OI-01의 소액 판정 금지 원칙에 걸립니다.

## 2. 지급정지일 합성 이벤트 — **권장대로 `events`에 넣지 않습니다**

권장 근거가 정확합니다. 합성 이벤트가 `events`로 들어가면 AI-server가 그것을 `evidence` 근거로 오인해 "근거 있는 사실"처럼 서술하게 되고, 이건 FR-045의 근거 유형 구분이 존재하는 이유 자체를 무너뜨립니다.

- `events`는 **"사용자가 확인한 추출 카드"** 로만 유지합니다.
- 지급정지일은 `intake.when`으로만 전달합니다.
- 다만 **타임라인 표시(F5-01)와 공백 탐지(F5-03)에서는 합성 이벤트를 그대로 씁니다.** 제외 대상은 소명서 생성 입력뿐입니다 — 화면의 타임라인과 `/internal/draft`의 `events`가 완전히 같지 않다는 점을 알고 계시면 됩니다.

## 3. `evidenceRefs.type` 해석 — **맞습니다. 확정했습니다**

`intake` 또는 `user_text`면 "본인 진술" 배지, 라는 해석이 FR-045 ⑤ 그대로입니다. 프론트가 보는 단일 출처인 `api-contract.md` `/api/draft` 응답 절에 표로 넣었습니다.

| `type` | 함께 오는 필드 | 프론트 렌더 |
| --- | --- | --- |
| `evidence` | `imageIndex`, `bbox` | 원본 이동 배지 (F7-05) |
| `intake` | 없음 | **"본인 진술" 배지** |
| `user_text` | 없음 | **"본인 진술" 배지** |

- `source_image_index`가 `null`인 카드를 `user_text` 근거로 판정하는 규칙도 그대로 맞습니다.
- 프론트에는 **"`imageIndex`가 없다고 오류로 처리하지 말 것"** 을 계약에 명시해 뒀습니다. TC-06에서는 전 문장이 `intake`라 배지가 전부 "본인 진술"로 뜨는데, 그것이 정상 동작이라는 점도 함께 적었습니다.

## 4. 함께 반영한 것 (회신 3건분 스키마 일괄)

말씀대로 한 번에 처리했습니다.

| 문서 | 반영 내용 |
| --- | --- |
| `internal-api-contract.md` | 카드에 `source_type`·`counterparty_name`·`payer_name`, `field_confidence` 확장, `event_id` 채번 규칙, `intake` 객체, `evidenceRefs.type` 3종, "AI가 채우지 않는 값" 표 |
| `api-contract.md` | 같은 카드 필드 + `evidenceRefs.type`·"본인 진술" 배지 규칙 (프론트용 주의사항 포함) |
| `spec.md` | F4-02 출력 스키마 정정, F4-03 거래 당사자 표시명 예외, F3-06 안내 문구, F4-05 `QUOTA_EXCEEDED` |
| `privacy-and-safety.md` | "추출 범위 예외 — 거래 당사자 표시명" 절 신설 |
| `reason-type-rules.md` | §2-1에 구매자–송금인 대조 방식 |

### 계약에 없던 필드 하나를 발견해 보완했습니다

`ai-server/app/schemas/card.py`의 `ExtractResponse`에 **카드별 `qualityFlags`** 가 있는데, `api-contract.md`에는 있고 `internal-api-contract.md`에는 빠져 있었습니다. 구현이 맞고 내부 계약 문서가 낡았던 것이라 **`internal-api-contract.md`에 추가**했습니다. `signals.quality_flags`(이미지 전체)와 `qualityFlags`(`event_id` 키 · 카드별)는 다른 값이라는 점도 명시했습니다.

## 5. `payer-name-extraction` §2 — **제안 수용**

거래 당사자 표시명을 **원문 그대로** 추출하는 안으로 확정했습니다. 부분 마스킹은 채택하지 않습니다 — 특히 **"마스킹 규칙을 LLM에 시키면 규칙 자체가 비결정적"** 이라는 지적이 결정적이었습니다. 결정적 대조 로직의 입력이 비결정적이면 로직이 결정적일 수 없습니다.

- 소명서 본문 표기도 **원문 그대로**입니다. 이 문서는 사용자 본인이 은행에 내는 서류이므로, 은행이 원본과 대조할 수 있어야 목적을 달성합니다.
- 개인정보 문서의 단일 출처는 `privacy-and-safety.md` "추출 범위 예외 — 거래 당사자 표시명" 절입니다. 경계(거래 당사자만·추측 금지·판정 금지·저장 불변)를 표로 정리해 뒀습니다.
- §5의 **F3-06 안내 문구 건은 접수했습니다.** `spec.md` F3-06에 "거래 상대방·입금자 이름은 가리지 마세요"를 권장 대상 안내와 **같은 크기로** 병기하도록 명세를 고쳤고, 프론트 요청 문서에도 추가했습니다.

## 6. 코드를 보고 하나 짚습니다 — `field_confidence` 기본값

`ai-server/app/schemas/card.py`:

```python
class FieldConfidence(BaseModel):
    counterparty_name: Confidence = "high"   # ← 기본값이 "high"
    payer_name: Confidence = "high"
```

**이름이 `null`인 카드에서도 신뢰도가 `high`로 나갑니다.** 값이 없는데 "높은 신뢰도"라는 조합은 의미가 성립하지 않고, 백엔드가 confidence로 대조 여부를 거르는 로직을 짜면 오작동합니다.

권장: 기본값을 `"low"`로 두거나, `Confidence | None = None`으로 바꿔 **값이 없으면 신뢰도도 없게** 해 주세요. 후자가 더 정확합니다 — 백엔드는 어차피 "둘 다 값이 있을 때만 대조"하므로 `None`을 문제없이 처리합니다.

## 7. 백엔드가 이어서 할 것

| 항목 | 시점 |
| --- | --- |
| `INTERNAL_TOKEN` 생성·팀 채널 공유 (32자 이상 랜덤) | 코드 착수 시 |
| `ai-server/demo/` v1 → `backend/src/main/resources/demo/` 복사 | Phase 3 착수 시 |
| 데모 이미지 4장 확정 (v2 재생성 트리거) | 9/1~9/2 리허설 안건 |

`AI_SERVER_URL`은 8/26 배포 후 공유해 주시는 것으로 알고 대기하겠습니다.
