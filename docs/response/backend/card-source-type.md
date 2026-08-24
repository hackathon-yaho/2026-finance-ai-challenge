# [AI → 백엔드] 회신: 추출 카드에 `source_type` 필드 추가 요청

- 원본 요청: `../../request/ai/card-source-type.md` (2026-08-23)
- 회신: AI · 2026-08-25

## 결정 — **요청하신 원안대로, 카드(이벤트) 단위 `source_type`을 넣습니다**

```json
{
  "event_id": "evt_2_1",
  "source_image_index": 2,
  "source_type": "chat",
  ...
}
```

- 값 범위는 정의된 그대로: `chat / bank / shipping / threat / autopay / unknown` (spec F4-02).
- **이미지 단위 대안(역매핑)은 쓰지 않습니다.** 요청서에 적으신 근거가 맞습니다 — 대화 캡처 안의 송금 알림처럼 한 이미지에 유형이 섞이는 경우가 실제로 흔하고, LLM이 이벤트를 분리 추출하는 시점에 유형도 함께 판정하는 것이 가장 정확합니다. 비용 증가도 없습니다.
- 판정이 애매한 이벤트는 추측하지 않고 `unknown`으로 내립니다. F5-01 동시각 tie-break에서 `unknown`은 우선순위 최하위로 취급해 주세요.
- 응답 **최상위** `source_type`(PRD FR-021 원안)은 넣지 않습니다 — 현행 계약(`api-contract.md` `/api/evidence` 응답)에도 최상위 필드가 없고, 이벤트 단위 값이 있으면 최상위 값은 중복입니다.

## 함께 확정한 것 — `event_id` 채번 규칙

카드별 필드와 직접 얽혀 있어 여기서 같이 확정합니다. AI-server는 무상태(세션을 모름)이므로 호출 간 ID 충돌을 피하기 위해:

- 이미지 경로: `evt_{image_index}_{n}` (예: 2번 이미지의 두 번째 이벤트 → `evt_2_2`)
- 텍스트 경로: `evt_txt_{n}`
- 백엔드는 이 ID를 불투명 문자열로 취급하면 됩니다. **같은 `image_index`로 재업로드가 일어나는 경우**(사용자가 카드 삭제 후 다시 올리는 등) 세션 내 중복 처리는 세션을 아는 백엔드 쪽에서 기존 카드 대체로 처리해 주세요.

## 백엔드가 해야 할 후속 작업

1. 예고하신 대로 `internal-api-contract.md`와 `api-contract.md`의 카드 스키마에 `source_type` 반영 + 변경 이력 기록. (제 회신 3건 — 본 건, `payer-name-extraction`, `image-transfer` — 의 스키마 변경을 한 번에 반영하시면 편할 것 같습니다.)
2. F5-01 동시각 tie-break (`chat → bank → shipping`, `unknown` 최하위), F5-03 ③ 대화 유무 판정(`source_type == "chat"` 존재 여부) 구현 착수 — 블로커 해제.
