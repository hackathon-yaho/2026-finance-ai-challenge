# [AI → 백엔드] 회신: 내부 API 이미지 전달 방식 확정 및 인증 토큰 공유

- 원본 요청: `../../request/ai/image-transfer-and-internal-auth.md` (2026-08-23)
- 회신: AI · 2026-08-25
- 반영한 문서: `../../02-architecture/internal-api-contract.md` (요청하신 대로 `[결정: TODO]` 블록을 제가 직접 갱신하고 수정 기록에 남겼습니다)

## 1. 이미지 전달 방식 — **A 계열로 확정, 단 멀티파트 봉투 없이 raw body**

**결정: 이미지 바이트를 그대로 요청 본문(raw body)으로 전달합니다.** base64(B)는 기각합니다. A의 취지(바이트 그대로, 인코딩 없음)는 유지하되, 멀티파트 봉투를 벗겼습니다.

```
POST /internal/extract?image_index={n}
Content-Type: image/png (또는 image/jpeg)
X-Internal-Token: {INTERNAL_TOKEN}

<이미지 바이트>
```

정확한 요청 형식(텍스트 경로 포함)은 `internal-api-contract.md`의 갱신된 요청 절이 단일 출처입니다. 여기에는 이유만 적습니다.

| 판단 | 이유 |
| --- | --- |
| B 기각 | 말씀하신 그대로입니다 — 본문 33% 증가 + 양쪽 인코딩 버퍼. Render 512MB에서 손해만 있고 이득이 없습니다 |
| 멀티파트 봉투 제거 | 제 스택(Python/FastAPI)의 멀티파트 파서는 **1MB를 넘는 파트를 OS 임시 파일로 디스크에 스풀링**합니다. 1600px PNG는 장당 300KB~1MB로 이 경계를 넘나들어, "이미지를 디스크에 쓰지 않는다"(`privacy-and-safety.md`) 원칙이 프레임워크 기본 동작에 의해 깨질 수 있습니다. raw body는 메모리에만 존재함을 구조적으로 보장합니다 |
| 백엔드 측 부담 | 오히려 줄어듭니다 — `RestClient` 기준 `.contentType(MediaType.IMAGE_PNG).body(bytes)` 한 줄이면 되고, `MultipartBodyBuilder`가 필요 없습니다 |

이미지 1장당 1요청입니다. 공개 API가 이미 1장씩 병렬(동시 4)로 들어오므로 백엔드는 받은 요청을 1:1로 흘려보내면 되고, 저도 동시 4 처리를 전제로 용량을 잡습니다.

혹시 Spring 쪽에서 raw body 전송에 예상 못 한 문제가 생기면 알려주세요 — 그 경우 멀티파트(순수 A)로 하루 안에 전환 가능하며, 제 쪽에서 인메모리 파싱으로 스풀링을 우회해 구현하겠습니다.

## 2. 인증 — 확정 사항 전부 수용

- 모든 `/internal/*` 요청에서 `X-Internal-Token` 헤더를 검증하고, 없거나 다르면 **401**로 거부합니다 (상수 시간 비교 사용).
- **예외: `GET /internal/health`는 무인증 공개**합니다 (킵얼라이브용).
- 값은 환경변수 `INTERNAL_TOKEN` 공유 방식 그대로 갑니다. 값 자체는 문서·저장소에 남기지 않고 팀 채널로 공유하겠습니다.

## 3. 타임아웃·재시도·오류 변환 — 참고값 확인

- 백엔드 타임아웃(extract 20초 / draft 15초, 재시도 1회)에 맞춰 AI-server 내부 LLM 호출 타임아웃을 그보다 짧게(extract 12초 / draft 10초) 잡아, **백엔드가 타임아웃으로 끊기 전에 제가 먼저 정형화된 오류를 돌려주는 구조**로 만듭니다.
- 오류 응답은 공개 API와 같은 형식(`error` / `message` / `fallback`)이며, 제가 반환하는 코드 목록(`EXTRACTION_FAILED` / `TIMEOUT` / `QUOTA_EXCEEDED` / `DRAFT_FAILED` / 401)을 `internal-api-contract.md` 오류 절에 표로 추가해 뒀습니다. **`QUOTA_EXCEEDED`(429)를 별도 코드로 분리**했으니 데모 모드 폴백(F4-05) 분기에 사용하세요.
- `fallback: "text_input"` → `"/api/evidence/text"` 치환은 백엔드 몫으로 이해했습니다.

## 4. "백엔드가 쓰지 않는 값" 2가지 — 반영

- `/internal/draft` 응답의 `checklist`는 **항상 빈 배열 `[]`** 로 보냅니다 (스키마 유지, 값은 백엔드 소스가 단일 출처).
- `signals.quality_flags.amount_mismatch`는 **항상 `false`** 로 보냅니다 (카드 간 교차 대조는 백엔드 몫 — 구조적으로 동의합니다. 이미지 1장만 보는 제가 판단할 수 없는 값입니다). `blurry` / `missing_date`는 제가 산출합니다.
- 반드시 채워야 하는 값(`threat_detected`, `field_confidence`, `source_region`)은 전부 산출합니다. 단 `source_region`(bbox)은 LLM 비전 특성상 **근사 좌표**입니다 — F7-05의 P0 범위(이미지 열기 + 스크롤 이동)에는 충분하고, 정밀 하이라이트(P1)에 쓸 정도의 픽셀 정확도는 보장하지 못합니다. 평가 세트(F11-05)에서 실측해 공유하겠습니다.

## 5. 백엔드가 해야 할 후속 작업

1. `AiClient.extract()` 본문 직렬화를 위 확정 형식으로 구현 (Phase 3 블로커 해제).
2. 킵얼라이브 워크플로의 `AI_SERVER_URL`은 제가 Render 배포 직후(늦어도 8/26) 팀 채널로 전달하겠습니다.
3. `INTERNAL_TOKEN` 값 생성·공유 — 백엔드가 만들어 주시면 그대로 쓰겠습니다 (32자 이상 랜덤 권장).
