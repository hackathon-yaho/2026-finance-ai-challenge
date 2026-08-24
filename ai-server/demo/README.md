# 데모 응답 세트 (v1 · 2026-08-25)

오프라인 데모 모드(F11-03)용 사전 응답 세트의 **원본**입니다. 백엔드가 `backend/src/main/resources/demo/`로 복사해 `DEMO_MODE=true`일 때 AI-server 호출 없이 그대로 반환합니다. 요청·회신: `docs/request/ai/demo-response-set.md` ↔ `docs/response/backend/demo-response-set.md`.

| 파일 | 대응 TC | 비고 |
| --- | --- | --- |
| `extract-tc01.json` | TC-01 | 중고판매 4장 (chat/bank/shipping/autopay), delivery·life true |
| `extract-tc02.json` | TC-02 | 용역, 입금내역 1장만 |
| `extract-tc03.json` | TC-03 | 협박 (`threat_detected: true`, `source_type: "threat"` 카드) |
| `extract-tc04.json` | TC-04 | TC-01과 동일 내용 (문진의 과거 이력만 바꿔 시연) |
| `extract-tc05.json` | TC-05 | 금액 confidence `low` + `blurry` 카드 포함 (Stage 3 차단 시연) |
| `extract-tc06.json` | TC-06 | 이벤트 0건 |
| `draft-tc01.json` | TC-01·12·13 | 문장별 `evidenceRefs` — 문장 클릭 시연용 |
| `draft-tc03.json` | TC-03 | 협박 수신 사실 문단(F10-04 고정 문안) 포함 |
| `draft-tc06.json` | TC-06 | 자료 0건 골격 — 전 문장 `type: "intake"` ("본인 진술" 배지) |

## 주의

1. **스키마**: `internal-api-contract.md` + 2026-08-25 AI 회신 3건의 확장(`source_type`, `counterparty_name`/`payer_name`, `checklist: []`, `amount_mismatch` 항상 false)이 반영되어 있습니다. 계약 문서 갱신 후 어긋남이 생기면 계약이 우선 — AI가 파일을 다시 맞춥니다.
2. **v1 한계**: `imageIndex`·`bbox`는 실제 데모 캡처와 아직 동기화되지 않은 그럴듯한 값입니다. 리허설(9/1~9/2)에서 데모 이미지 4장이 확정되면 실제 파이프라인 통과 결과로 **v2 재생성** 예정입니다.
3. 인물·업체명·계좌 뒷자리는 전부 가공의 값입니다.
