# [AI → 프론트] 회신: 키 등록 화면의 OpenAI 선택지 — **5건 전부 수정했습니다**

- 원본 요청: `../../request/ai/llm-provider-mismatch.md` (프론트 · 2026-08-26)
- 회신: AI · 2026-08-26

## 결론 — 지적이 전부 맞습니다. 제안 5건을 모두 반영했습니다

특히 **§2의 세 가지**는 제가 만든 진짜 결함이었습니다. 로컬 연동 중에 끝까지 파고들어 원인까지 짚어 주셔서 고쳤습니다. 저 혼자였으면 실 LLM 연동을 시작하는 시점에야 발견했을 것이고, 그때는 데모 리허설과 겹쳤을 겁니다.

| # | 제안 | 처리 |
| --- | --- | --- |
| 1 | OpenAI 선택지 제거·미지원 표시 | ✅ **"2) OpenAI (아직 미지원)"** 로 표시하고, 고르면 이유를 설명한 뒤 저장하지 않고 건너뜁니다 |
| 2 | `.env.example` 정리 | ✅ `OPENAI_API_KEY` 주석 줄 삭제, "공급자 미확정" 문구를 "현재 코드는 Anthropic 전용" 으로 교체 |
| 3 | 기동 시 키 확인 | ✅ 기동 로그에 명시 (아래) |
| 4 | 설정 오류를 `EXTRACTION_FAILED`로 감싸지 않기 | ✅ **`AI_CONFIG_ERROR`(500) 신설**, 재시도 없음. 계약 반영 |
| 5 | 텍스트 경로 메시지·fallback | ✅ 메시지에서 "이미지" 제거, **텍스트 경로에는 `fallback`을 주지 않습니다** |

## 1. `AI_CONFIG_ERROR` (500) 신설 — 계약 변경입니다

`../../02-architecture/internal-api-contract.md` 오류 절에 추가했습니다. **백엔드도 봐야 하는 변경**이라 계약 문서를 먼저 고쳤습니다.

```json
HTTP 500
{ "error": "AI_CONFIG_ERROR",
  "message": "AI 서버 설정에 문제가 있습니다. 관리자 확인이 필요합니다." }
```

- **`fallback`이 없습니다.** 사용자가 무엇을 다시 올리든 결과가 같으므로 텍스트 입력으로 유도하면 안 됩니다.
- **재시도하지 않습니다.** 키가 없는 상태를 다시 불러도 같아서 LLM 호출만 두 배가 된다는 지적(§2-3)이 정확했습니다. 이제 **호출 자체를 하지 않고** 즉시 반환합니다.
- 프론트는 이 코드를 받으면 "일시적인 오류" 계열로 처리하고 **AI 담당에게 알려주시면 됩니다.**

## 2. 텍스트 경로의 메시지와 `fallback`

§2-2에서 짚으신 "같은 자리를 맴돈다"가 그대로 맞았습니다.

| 경로 | 실패 시 `message` | `fallback` |
| --- | --- | --- |
| 이미지 | "이미지에서 내용을 읽지 못했습니다." | `"text_input"` |
| **텍스트** | **"입력하신 내용에서 거래 정보를 찾지 못했습니다."** | **없음** |

소명서 생성(`/internal/draft`) 경로도 같이 손봤습니다 — 타임아웃 시 `fallback: "text_input"`이 붙고 있었는데, 소명서가 실패했는데 "텍스트로 올리세요"는 말이 되지 않습니다. 제거했습니다.

## 3. 기동 로그

키가 없으면 **첫 호출까지 기다리지 않고 기동 즉시** 알 수 있습니다. 값은 찍지 않고 있고 없고만 남깁니다(NFR-08).

```
ERROR ai.access LLM API 키가 설정되지 않았습니다. /internal/health는 정상이지만
      판독·소명서 생성은 AI_CONFIG_ERROR(500)로 실패합니다.
      로컬은 set-key.ps1, 배포는 Secret Manager를 확인하세요.
WARNING ai.access INTERNAL_TOKEN이 비어 있습니다 — 모든 /internal 호출이 401로 거부됩니다.
```

## 4. 회귀 테스트로 고정했습니다

문서만 고치면 다시 새어나가므로 `ai-server/tests/test_api.py`에 3건 추가했습니다 (총 63건).

| 테스트 | 잠그는 것 |
| --- | --- |
| `test_missing_llm_key_is_config_error_not_extraction_failed` | 500 `AI_CONFIG_ERROR` · `fallback` 없음 · **LLM 호출 0회** |
| `test_text_path_failure_has_no_text_input_fallback` | 텍스트 경로에 `fallback` 없음 · 메시지에 "이미지" 없음 |
| `test_image_path_failure_keeps_text_input_fallback` | 이미지 경로는 종전대로 `fallback` 유지 |

## 5. 공급자 상태 — 여전히 Anthropic 전용입니다

지적하신 대로 **문서·스크립트만 "미확정" 시점에 멈춰 있었습니다.** 코드는 이미 Anthropic으로 확정돼 있습니다. 지금은 그 사실을 있는 그대로 드러내는 쪽으로 맞췄습니다.

OpenAI로 바꾸는 결정이 나면 `app/llm/client.py`와 `app/llm/prompts.py`의 structured output 부분을 교체해야 합니다(`output_config`는 Anthropic 전용 스키마라는 지적도 맞습니다). **스키마·프롬프트 문안·FactChecker는 공급자 중립이라 그대로 재사용됩니다.** 결정되면 이 문서에 갱신해 알려드리겠습니다.

## 6. 확인해 주신 것 감사합니다

§4의 확인 결과(헬스체크 200 / 401 / 400 필드명 안내 / 3.12 venv 기동)는 **AI-server의 첫 외부 검증**이었습니다. 계약대로 동작한다는 것을 제 손이 아닌 곳에서 확인받은 게 이번이 처음입니다.
