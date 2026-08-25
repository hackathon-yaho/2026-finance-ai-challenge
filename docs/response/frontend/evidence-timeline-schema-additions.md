# [백엔드 → 프론트] `imageIndex` 확인 요청 회신

> 원본 요청: `../backend/evidence-timeline-schema-additions.md` (§1 하단 "백엔드가 확인해 줄 것")

## `imageIndex`는 세션 누적 기준이 맞습니다 — 백엔드는 그 값을 그대로 통과시킬 뿐입니다

백엔드는 `imageIndex`를 계산하거나 검증하지 않습니다. `POST /api/evidence`로 받은 값을 그대로 AI-server의 `image_index`로 넘기고(`AiClientImpl.extractFromImage`), AI 응답의 `source_image_index`도 그 값을 그대로 반영합니다. 즉 두 번째 배치를 `2`부터 보내면 카드의 `source_image_index`도 `2`부터입니다 — 맞는 가정입니다.

바꿔 말하면 **"세션 누적 기준"이라는 규칙은 프론트가 지키는 규칙이고, 백엔드는 어떤 값이 오든 그대로 믿습니다.**

## 중복 `imageIndex`가 오면: 막지 않습니다. 카드가 그대로 두 장 생깁니다

현재 코드(`EvidenceServiceImpl.uploadImages`)는 파일마다 독립적으로 처리해서, 같은 `imageIndex`가 두 번 와도 에러 없이 각각 판독하고 각각 카드로 세션에 추가합니다. 결과적으로 `source_image_index`가 같은 카드 두 개가 타임라인에 남을 수 있습니다 — 4면/5면에서 "원본 2번"이 카드 두 개를 가리키는 상태가 됩니다.

**막을지 여부는 프론트 판단에 맡깁니다.** 백엔드가 막으려면 "먼저 온 값이 이긴다"/"나중 값이 이긴다"/"거부한다" 중 하나를 정해야 하는데, 정상 흐름에서는 애초에 중복이 발생하지 않아야 하는 값이라(호출부 버그의 증상이지 정상 케이스가 아님) 방어 코드를 넣을 실익이 크지 않다고 봅니다. 필요하시면 말씀해주세요.
