# [프론트 → 백엔드] `recurrence`가 프론트까지 오지 않습니다 — 회신

- 작성: 백엔드 · 2026-08-27
- 원본 요청: `../../request/backend/recurrence-not-reaching-frontend.md` (프론트 · 2026-08-26)

**원인 확인했습니다.** `ExtractedEvent`가 `record`인데 `recurrence`를 선언하지 않고 있어, Jackson이 관대 모드로 조용히 버렸습니다(에러도 로그도 없이 `200`). 요청하신 3가지 전부 반영했습니다.

## 1. `api-contract.md`에 `recurrence` 반영

`internal-api-contract.md`와 같은 모양입니다 — `{ count, period, first, last }`, 반복이 아니면 `null`. `/api/evidence` 응답 스키마 절에 추가했습니다.

## 2. `ExtractedEvent`에 필드 추가 — 그대로 통과

`ExtractedEvent`에 `Recurrence recurrence` 필드를 추가했습니다(해석 없이 통과만 함). 기존 13필드 호출부(테스트 다수)가 전부 깨지지 않도록 호환 생성자를 남겨뒀습니다 — `recurrence`를 안 주면 `null`로 들어갑니다.

같은 문제가 하나 더 있었습니다 — 데모 모드 픽스처 재구성 경로(`DemoFixtures.remapIds`)도 카드를 필드별로 하나하나 다시 조립하는 구조라, 고치지 않았으면 데모 모드에서도 `recurrence`가 같은 방식으로 유실됐을 겁니다. 같이 고쳤습니다.

## 3. 서버 PDF 3면·4면 반영 — 저희가 정한 문구

**3면(타임라인)**
- 요약 뒤에 `"(매월 12회)"`를 붙입니다. 기간(첫~마지막)은 같은 줄 왼쪽 `일시` 열에 첫 회차가 이미 있어 중복하지 않았습니다
- 금액 뒤에 `"(1회분)"`을 붙입니다 — `65,890원 (1회분)`

```
2025-09-15 00:00  본인  SK텔레콤 통신요금이 자동 출금됨 (매월 12회) · 65,890원 (1회분)
```

**4면(증빙목록)**
- "확인된 일시" 열이 첫 회차 하나가 아니라 `recurrence.first ~ recurrence.last` **전체 기간**을 보여줍니다
- 요약 뒤에 `"(매월 12회, 1회분 65,890원)"`을 붙입니다

```
4  자동이체  2025-09-15 00:00 ~ 2026-08-15 00:00  SK텔레콤 통신요금이 자동 출금됨 (매월 12회, 1회분 65,890원)  원본 2번
```

`period` 라벨은 `monthly→매월 / weekly→매주 / daily→매일 / other→주기적으로`로 매핑했습니다. `count`는 저희도 재계산하지 않고 AI-server 값을 그대로 씁니다.

**F5-01 미리보기와 맞추실 때 이 문구를 그대로 쓰시면 됩니다.** 계약에 새 필드가 생긴 것 외에 기존 필드 의미는 안 바뀌었습니다.

## 후속 작업

없습니다. 반복 카드 하나로 3면·4면·데모모드 왕복까지 테스트 추가해 확인했습니다(`PackageServiceImplTest#recurringCard_showsCountAndFullRange_notJustFirstOccurrence`).
