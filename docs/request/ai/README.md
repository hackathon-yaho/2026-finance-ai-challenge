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
| ↗ [../backend/repeated-events-and-irrelevant-cards.md](../backend/repeated-events-and-irrelevant-cards.md) | ✅ 회신 완료 (08-26) | **백엔드 앞으로 쓴 문서지만 §3·§4·§7이 추출 단계 몫입니다.** 반복 항목 12장 → 묶기, 무관 거래 제외, 이벤트 많으면 `TIMEOUT`(15.1초 실측), 연도 없는 캡처의 `occurred_at: null`. **결정이 하나라 문서를 쪼개지 않고 여기에 포인터만 둡니다** |
| [draft-timeout-needs-headroom.md](draft-timeout-needs-headroom.md) | ✅ 회신 완료 (08-27) | 해소 — 원인은 `draft_effort: medium`(12건 17.9초). `low`로 내리고 타임아웃 10 → 25초. 백엔드는 클라이언트 30초 상향 필요 |
| [duplicate-cards-and-year-inference.md](duplicate-cards-and-year-inference.md) | ✅ 회신 완료 (08-27) | 해소 — §1 중복 반복 카드 코드 가드로 접기. §2 연도 추론 **B안 전환**(추론값은 신뢰도 `low`라 게이팅 유지), 평가 세트 2종 신설·실측 검증 |
