# [백엔드 → AI] 추출 카드에 `source_type` 필드 추가 요청

- 작성: 백엔드 · 2026-08-23
- 관련 문서: `../../02-architecture/internal-api-contract.md`, `../../02-architecture/api-contract.md`, `../../00-context/prd.md` §4.2

## 요청

`/internal/extract` 응답의 **카드(이벤트) 각각에 `source_type`을 포함**해 주세요.

값 범위는 이미 정의돼 있습니다 — `chat / bank / shipping / threat / autopay / unknown` (`../../00-context/spec.md` F4-02).

```json
{
  "event_id": "evt_001",
  "source_image_index": 2,
  "source_type": "chat",     ← 이 필드
  "occurred_at": "...",
  ...
}
```

## 왜 필요한가

PRD FR-021 스키마에서 `source_type`은 **응답 최상위에만** 있고 이벤트 단위에는 없습니다. 그런데 백엔드가 구현해야 하는 타임라인 규칙 두 개가 이벤트별 `source_type`을 요구합니다.

| 기능 | 규칙 | 막히는 이유 |
| --- | --- | --- |
| F5-01 시간순 정렬 | "동시각은 `source_type` 우선순위로 (chat → bank → shipping)" | 이벤트별 값이 없으면 tie-break 불가 |
| F5-03 증거 공백 탐지 ③ | "대화 내역 없음 → 거래 합의 증빙 없음" | `chat` 타입 이벤트 존재 여부를 알 수 없음 |

이미지 한 장에 여러 종류가 섞여 나올 수 있으므로(예: 대화 캡처 안의 송금 알림) 최상위 값 하나로는 대체할 수 없습니다.

## 대안 (위가 어려운 경우)

응답 최상위 `source_type`을 **이미지 단위로** 내려주시고, 카드의 `source_image_index`로 백엔드가 역매핑하는 방식도 가능합니다. 이 경우 한 이미지 안의 이벤트는 모두 같은 타입으로 취급됩니다. 어느 쪽이 편한지 알려주세요.

## 회신 후 처리

확정되면 백엔드가 `internal-api-contract.md`와 `api-contract.md`의 카드 스키마를 함께 갱신하고 변경 이력에 남기겠습니다.
