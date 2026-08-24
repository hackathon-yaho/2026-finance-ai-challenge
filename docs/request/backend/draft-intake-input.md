# [AI → 백엔드] `/internal/draft` 요청에 문진 데이터 추가 — TC-06이 현행 계약으로 불가능합니다

> **상태: ✅ 회신 완료 (2026-08-25) — 전부 수용**
> - 회신: `../../response/ai/draft-intake-input.md`
> - **결론 요약**: `intake` 4필드 원안 그대로 계약 반영. 지급정지일 합성 이벤트는 `events`에 **넣지 않음**(권장 수용). `evidenceRefs.type` 3종과 "본인 진술" 배지 해석도 맞음 — `api-contract.md`에 표로 확정. `history`·`dueNotice*` 제외 확정(+ 소명서에 과거 이력 서술 금지 요청).
> - **AI 측 후속**: `DraftService` 요청 스키마를 확정본으로 교체, TC-06 임시 처리 해제. `field_confidence` 기본값 `"high"` 수정 요청 1건 포함(회신 §6)

- 작성: AI · 2026-08-25
- 관련 문서: `../../02-architecture/internal-api-contract.md` `/internal/draft` 절, `../../00-context/prd.md` FR-045, `../../04-testing/test-cases-and-demo.md` TC-06

## 1. 문제 — 현행 요청 스키마로는 자료 0건 소명서를 만들 수 없습니다

현행 `/internal/draft` 요청은 세 필드뿐입니다.

```json
{ "events": [...], "reason": "...", "readiness": "..." }
```

그런데 **TC-06(문진만, 자료 0건)** 은 `events`가 빈 배열입니다. 이 상태에서 소명서 골격을 만들려면 문진 응답(지급정지일, 입금액, 거래 성격, 계좌 사용 목적)이 사실 재료로 필요한데, **현행 스키마에는 문진이 들어올 자리가 없습니다.** FR-045도 근거 유형 세 가지(`evidence` / `intake` / `user_text`) 중 `intake`를 명시하고 있어, 문진이 소명서 입력이라는 것은 스펙상 확정입니다.

또 `reason-type-rules.md`의 "입금액은 소명서의 **사실 기재**에만 사용"이라는 규칙도, 입금액이 소명서 생성 입력으로 전달될 때만 실현됩니다.

## 2. 요청 — `intake` 객체를 추가해 주세요

```json
{
  "events": [ /* confirmed=true 카드만. 기존과 동일 */ ],
  "reason": "goods | service | debt | unclear",
  "readiness": "SUBMISSION_READY | SUPPLEMENT_NEEDED | BANK_CHECK_REQUIRED",
  "intake": {
    "when": "2026-09-04",        // 지급정지일, 없으면 null
    "amount": 450000,             // 문제 입금액, 없으면 null — 사실 기재 전용
    "kind": "goods",              // 거래 성격 (reason과 동일 계열이면 생략 가능)
    "usage": "main"               // 계좌 사용 목적 — "주 거래 계좌" 서술용
  }
}
```

- 필드명은 공개 API `/api/intake` 요청 필드를 그대로 따랐습니다(새 이름을 만들지 않기 위해). `history`와 `dueNotice*`는 소명서 사실 기재에 쓰지 않을 것이라 뺐습니다 — 필요 판단이 다르면 회신에 적어주세요.
- AI-server는 `intake` 기반 문장의 `evidenceRefs`를 `[{ "type": "intake" }]`로 내립니다(`imageIndex`·`bbox` 없음). **프론트는 `evidenceRefs`의 `type`이 `intake` 또는 `user_text`면 "본인 진술" 배지를 렌더**하면 됩니다(FR-045 ⑤) — 이 해석이 맞는지도 확인해 주세요 (프론트와 공유 필요).
- 텍스트 직접 입력(F3-04) 경로로 만들어진 카드는 `events`에 이미 포함되므로 별도 필드가 필요 없습니다. 그 카드 기반 문장은 `[{ "type": "user_text" }]`로 내립니다 (`source_image_index`가 `null`인 카드 = `user_text` 근거로 판정).

## 3. 함께 확인할 것 — 타임라인의 "지급정지일 삽입 이벤트"

F5-01은 백엔드가 지급정지일을 "사용자 진술 / 낮은 신뢰도" 이벤트로 타임라인에 삽입한다고 정의합니다. 이 합성 이벤트가 `/internal/draft`의 `events`에 **포함되어 들어오나요, 아니면 카드만 들어오나요?**

- **제 권장: 포함하지 말아 주세요.** 지급정지일은 `intake.when`으로 받는 편이 깨끗합니다 — 합성 이벤트가 `events`로 들어오면 제가 `evidence` 근거로 오인해 "근거 있는 사실"처럼 다루게 됩니다. `events`는 "사용자가 확인한 추출 카드"로 순수하게 유지하고, 문진 유래 사실은 전부 `intake`로 받는 쪽이 근거 유형 구분(FR-045)과 정확히 일치합니다.

## 4. 확정되면 반영할 문서

| 문서 | 내용 | 담당 |
| --- | --- | --- |
| `internal-api-contract.md` `/internal/draft` 요청 절 | `intake` 추가 + `evidenceRefs.type` 3종(`evidence`/`intake`/`user_text`) 명시 | 백엔드 (카드 스키마 갱신과 함께) |
| `api-contract.md` `/api/draft` 응답 절 | `evidenceRefs.type` 3종과 "본인 진술" 배지 규칙 (프론트 공유) | 백엔드 |

회신만 오면 AI-server 쪽은 즉시 맞춰 구현합니다. **이 건이 확정되기 전에는 TC-06 경로를 "events 빈 배열 + intake 없음 → 최소 안내문만 반환"으로 임시 처리**해 두겠습니다.
