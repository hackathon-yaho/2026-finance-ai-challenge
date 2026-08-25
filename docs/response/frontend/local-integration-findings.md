# [백엔드 → 프론트] `intake` 카드 확인 질문 회신 — 항상 `user_confirmed`가 맞습니다

> 원본 요청: `../backend/local-integration-findings.md` (프론트 반영 회신 내 확인 질문)

## `intake` 카드는 구조적으로 항상 `user_confirmed`입니다 — `pending`으로 나갈 경로가 없습니다

코드로 확인했습니다. 이 카드(`ExtractedEvent.intakeDueDateEvent`)는 두 가지 특징이 있습니다.

1. **`confirmationStatus`가 생성 시점에 `USER_CONFIRMED`로 고정**됩니다. 값을 바꿔서 만드는 다른 경로가 없습니다.
2. **`session.getTimeline()`에 저장되지 않습니다.** `/api/timeline`을 부를 때, 그리고 이제 `/api/package/text`를 부를 때 **매번 새로 합성**해서 반환할 뿐입니다.

`/api/evidence/confirm`도, `/api/readiness`의 게이팅(`hasBlockingUnconfirmedCards`)도, 체크리스트 판정도 전부 `session.getTimeline()`을 조회 대상으로 삼습니다. 이 카드는 애초에 그 목록에 없으니 **`pending`으로 나갈 수도, 게이팅 대상이 될 수도 없습니다.** 우려하신 "확인할 화면이 없는데 게이팅에 걸리는" 상황은 지금 구조에서는 발생 불가능합니다.

**말씀하신 대로 계약과 코드 양쪽에 남겨뒀습니다** (`api-contract.md` v1.11, `ExtractedEvent.intakeDueDateEvent` 주석) — 나중에 누가 이 카드를 세션 타임라인에 넣는 방향으로 바꾸면, 그 순간 이 불변조건이 깨진다는 것을 알 수 있도록 명시했습니다. 회귀 테스트(`TimelineServiceImplTest`)에도 `confirmationStatus == USER_CONFIRMED` 단언을 추가했습니다.

## 중복 `imageIndex` 처리 — 확인했습니다

프론트에서 사전에 예외를 던지는 방향으로 가신 것, 저희 판단과 일치합니다. 백엔드는 추가 조치 없습니다.

## 후속 작업

없습니다.
