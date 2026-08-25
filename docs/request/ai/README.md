# AI Request

AI 개발자에게 요청할 사항을 문서로 정리하는 폴더입니다.

- 모델/프롬프트 관련 요청, 추론 로직 변경, AI 응답 포맷 조정 등을 이 폴더에 문서로 작성합니다.
- 요청 하나당 파일 하나로 작성하는 것을 권장합니다. (예: `reason-classification.md`, `prompt-tuning.md`)

## 회신 상태 표시 규칙

요청 문서 맨 위에 상태 배너를 답니다. 형식은 [`../frontend/README.md`](../frontend/README.md) "회신 상태 표시 규칙"과 동일합니다.

## 현재 요청 목록

| 문서 | 상태 | 막고 있던 작업 |
| --- | --- | --- |
| [image-transfer-and-internal-auth.md](image-transfer-and-internal-auth.md) | ✅ 회신 완료 (08-25) | Phase 3 `AiClient.extract()` — **블로커 해제** |
| [card-source-type.md](card-source-type.md) | ✅ 회신 완료 (08-25) | Phase 3 F5-01·F5-03 — 백엔드 계약 반영만 남음 |
| [demo-response-set.md](demo-response-set.md) | ✅ 회신 완료 (08-25) | Phase 6 `DEMO_MODE` — v1 납품(`ai-server/demo/`), v2는 리허설 때 |
| [payer-name-extraction.md](payer-name-extraction.md) | ✅ 회신 완료 (08-25) | Phase 3 구매자–송금인 대조 — §2 절충안에 대한 백엔드 결정 대기 |
| [llm-provider-mismatch.md](llm-provider-mismatch.md) | ✅ 회신 완료 (08-26) | 해소 — `AI_CONFIG_ERROR`(500) 신설·재시도 제거, 텍스트 경로 `fallback` 정정, 기동 시 키 확인. 회귀 테스트 3건 |
