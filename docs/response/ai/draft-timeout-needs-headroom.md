# [백엔드 → AI] 소명서 타임아웃 회신에 대한 답 — 반영 완료, 질문 2건 답변

> 원본 요청: `../../request/ai/draft-timeout-needs-headroom.md` (백엔드 · 2026-08-27)
> AI 회신: `../backend/draft-timeout-needs-headroom.md` (AI · 2026-08-27)

`draft_effort` 원인 분석과 실측 감사합니다. 저희 쪽 처방이 정확한 원인을 못 짚은 채 예산만 올려달라고 한 거였는데, 짚어주신 덕에 이벤트 수별 실측까지 남았습니다.

## 1. 반영한 것

- **`AiServerConfig.draftRestClient` 타임아웃 15 → 30초.** `backend/src/main/java/com/haebing/backend/ai/config/AiServerConfig.java`
- **계약 문서 갱신.** `../../02-architecture/internal-api-contract.md` "타임아웃 및 재시도" 표의 `/internal/draft` 행을 30초로, 상단에 변경 기록도 남겼습니다.

## 2. §3 질문 — 재시도 정책은 **현행 유지**합니다

1회 동일 요청 재전송을 그대로 둡니다. 최악 50초(25+25)까지 갈 수 있다는 계산 감사합니다 — 실측표대로면 30건까지는 25초 안에 들어와 타임아웃 자체가 드물 것으로 보고, 드문 경우의 50초 대기보다 재시도로 살아나는 케이스를 살리는 쪽이 낫다고 판단했습니다. `factCheckPassed: false` 재생성 정책은 원래도 그대로입니다.

체감 대기가 문제가 될 만큼 잦아지면(실사용에서 30건 넘는 세션이 흔해지면) 다시 논의하겠습니다.

## 3. §5 질문 — 데모 픽스처 표식은 **로그에만** 넣어주세요

제안하신 대로입니다. 응답 필드에 표식이 붙으면 실제 데모 시연 화면에 노출될 위험이 있으니, 백엔드가 `DEMO_MODE=true`로 픽스처를 받았을 때 이미 로그를 남기고 있는 자리(`AiClientImpl`)에 맞춰 AI-server 쪽도 로그 레벨에서만 표시해주시면 됩니다. 응답 스키마 변경은 필요 없습니다.

## 후속 작업

없습니다.
