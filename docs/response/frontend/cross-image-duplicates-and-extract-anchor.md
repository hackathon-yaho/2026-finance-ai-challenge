# [프론트 → 백엔드] 이미지 간 중복이 `mergeCandidates`에 안 잡힙니다 + `/internal/extract`에 기준 시점 전달 — 회신

- 작성: 백엔드 · 2026-08-27
- 원본 요청: `../../request/backend/cross-image-duplicates-and-extract-anchor.md` (프론트 · 2026-08-27)

## §1. 병합 규칙 — `MERGE_WINDOW`는 넓히지 않고, "반복 포함" 규칙을 새로 추가했습니다

말씀하신 대로 `MERGE_WINDOW`를 넓히는 쪽은 위험하다고 판단했습니다. 창을 넓히면 "같은 금액을 두 번 보낸 진짜 다른 거래"까지 후보가 됩니다.

대신 제안하신 **반복(`recurrence`) 포함 관계** 판정을 별도 규칙으로 추가했습니다(`TimelineServiceImpl.detectRecurrenceContainmentCandidates`). `mergeCandidates`는 이제 두 규칙의 합집합입니다.

1. 시각 창(기존, 그대로): 시각 차 5분 이내 + 금액 일치 + `actor` 동일
2. **반복 포함(신설)**: `recurrence`가 있는 카드의 `[first, last]` 구간에 같은 `actor`·금액·`source_type`인 단발 카드가 들어오면 후보. 시각 차가 아니라 포함 관계라 `MERGE_WINDOW`와 무관합니다

승인 시 동작(먼저 발생한 카드를 대표로 남기고 나머지는 화면에서만 뺌)은 그대로라 프론트가 손댈 곳은 없습니다. `mergeCandidates` 스키마도 그대로입니다 — `reason` 문구만 "반복 구간(2026-01-15T09:00:00+09:00~2026-12-15T09:00:00+09:00)에 포함 · 금액 128,640원 일치 · actor 동일"처럼 달라집니다.

**다만 말씀하신 재현 케이스(원본 2번 카드, 연도 없음)는 이 규칙으로도 아직 후보로 안 잡힙니다.** 단발 카드에 `occurred_at`이 없으면(연도 미상) 구간 포함 여부를 판정할 방법이 없어서, 기존 규칙과 똑같이 걸러냅니다("말하지 않은 시각을 만들지 않는다" 원칙 유지). 이건 §2가 풀려야 같이 풀립니다 — 문서에 적어주신 대로 두 건이 이어져 있는 게 맞았습니다.

## §2. `/internal/extract`에 기준 시점을 실었습니다

`reference_date`(오늘 날짜, 항상 실림)와 `intake_when`(문진 지급정지일, 없으면 쿼리 자체 생략)을 **쿼리 파라미터**로 추가했습니다. 이미지 경로·텍스트 경로 둘 다 동일합니다.

```
POST /internal/extract?image_index={n}&reference_date=2026-08-27&intake_when=2026-08-15
POST /internal/extract?reference_date=2026-08-27&intake_when=2026-08-15   (텍스트 경로)
```

"둘 다 보내고 AI가 있는 것을 쓰게 하자"는 의견 그대로 받았습니다 — 어느 쪽을 기준으로 삼을지, 아니면 A안(추론 안 함)을 유지할지는 AI 쪽 결정으로 남겨뒀습니다(`../../request/ai/duplicate-cards-and-year-inference.md` §2, 회신 대기 중). AI가 A안 유지로 결론 내도 이 파라미터는 무시하면 그만이라 코드 변경이 필요 없습니다.

프론트가 바꿀 것은 없습니다 — `/api/evidence`만 호출하는 구조는 그대로입니다.

## 후속 작업

없습니다. AI 회신이 오면 §1의 재현 케이스가 실제로 후보로 잡히는지 다시 확인하겠습니다 — 그건 저희 쪽에서 추적하겠습니다.

계약 반영: `../../02-architecture/api-contract.md` v1.16(반복 포함 규칙), `../../02-architecture/internal-api-contract.md`(기준 시점 쿼리 파라미터).
