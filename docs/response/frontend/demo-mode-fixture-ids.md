# [백엔드 → 프론트] 데모 픽스처 id 충돌 회신 — 반환 시점 재발급으로 수정 완료

> 원본 요청: `../backend/demo-mode-fixture-ids.md`

## 1·2. `event_id` 충돌·`source_image_index` 불일치 — 제안하신 방식 그대로 구현했습니다

`DemoFixtures`가 픽스처를 반환하기 직전에 다시 씁니다. 픽스처 파일 자체는 손대지 않았습니다(말씀하신 이유 그대로 — AI 담당 갱신 때 다시 어긋나는 것을 피하려고).

- **`source_image_index`**: 호출 시 받은 실제 `imageIndex`로 전부 교체
- **`event_id`**: `evt_{imageIndex}_{순번}`으로 재발급 (텍스트 입력은 `evt_text_{순번}`, `source_image_index`는 `null` 고정)
- **`qualityFlags`의 키**도 같이 재발급해 카드와 어긋나지 않게 했습니다

실측: 말씀하신 것과 같은 조합(imageIndex 0·1·2, tc01·tc02·tc03)으로 업로드해 카드 11장 · 고유 `event_id` 11개 확인했습니다. 전부 확인 가능합니다.

## 3. `/api/draft` 픽스처의 `evidenceRefs.imageIndex` — 클램프 방식으로 구현

세션의 confirmed 카드에 실제로 존재하는 `source_image_index` 집합을 계산해, 그 범위를 벗어나는 `evidenceRefs`는 `type: "user_text"`(이미지 참조 없음)로 내립니다. 말씀하신 두 옵션 중 "이미지 참조가 없는 형태로" 쪽을 택했습니다 — 클램프(예: 3 → 2)는 실제로 없는 이미지를 있는 것처럼 가리키게 될 수 있어서입니다.

실측: 이미지 0·1·2만 올린 세션에서 원래 imageIndex 3을 가리키던 문장이 `{"type":"user_text"}`로 내려오는 것 확인했습니다. 나머지 문장(0~2 범위)은 그대로 `evidence`로 남습니다.

## 5. `AI_CONFIG_ERROR`(500) — 이미 처리돼 있습니다

말씀하신 시점에는 아직 반영 전이었을 텐데, 그 사이 저희도 AI 담당의 계약 변경을 보고 `AiClientImpl`에 `HttpServerErrorException.InternalServerError`(500) 캐치를 추가했습니다. 재시도 없이 즉시 `AI_CONFIG_ERROR`로 던지고, `fallback`도 없습니다. 단위 테스트로 확인했습니다 — 넘어가 주셔도 됩니다.

## 4. 프론트 파일명 버그 — 확인했습니다

`form.append` 세 번째 인자로 파일명을 붙이신 것, 저희 쪽 확장자 화이트리스트(F3-02 ①)와 맞습니다. 백엔드 조치는 없습니다.

## 후속 작업

없습니다. 다음 데모 리허설 때 다시 확인해주시면 됩니다.
