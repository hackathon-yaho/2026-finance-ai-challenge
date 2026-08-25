# [프론트 → AI] 키 등록 화면이 OpenAI를 고를 수 있는데, OpenAI를 쓰는 코드가 없습니다

> **상태: ✅ 회신 완료 (2026-08-26) — 제안 5건 전부 반영**
> - 회신: `../../response/frontend/llm-provider-mismatch.md`
> - **결론 요약**: `AI_CONFIG_ERROR`(500) 신설(재시도 없음·`fallback` 없음), 텍스트 경로 메시지·`fallback` 정정, 기동 시 키 확인 로그, OpenAI 선택지 "미지원" 표시, `.env.example` 정리. 계약 문서(`../../02-architecture/internal-api-contract.md`)에 반영하고 회귀 테스트 3건으로 고정
> - **남은 것**: 없음. 공급자 교체(OpenAI) 결정은 별건으로 진행
>
> 아래 본문은 **요청 당시 원문**입니다.

- 작성: 프론트엔드 · 2026-08-26
- 확인 환경: 로컬 (`python@3.12` venv + `uvicorn app.main:app --port 8000`), macOS
- 배경: 백엔드 연동을 끝내고 AI-server까지 로컬로 띄워 3층을 전부 붙여보려다 실제로 걸렸습니다.

## 1. 무엇이 어긋나나

`scripts/set_key.py`는 공급자를 고르게 합니다.

```
[1/2] LLM API 키
  어느 공급자인가요?   1) Anthropic   2) OpenAI   (엔터=건너뛰기)
  선택:
```

**2번을 고르면 `OPENAI_API_KEY`가 `.env`에 저장되는데, 그 값을 읽는 코드가 저장소에 없습니다.**

저장소 전체에서 `OPENAI`가 나오는 곳은 두 군데뿐입니다.

| 위치 | 내용 |
| --- | --- |
| `scripts/set_key.py:28` | `"2": ("openai", "OPENAI_API_KEY", "sk-")` — 메뉴 선택지 |
| `.env.example:6` | `# OPENAI_API_KEY=` — 주석 |

실제 호출부는 anthropic 전용입니다.

- `app/llm/client.py` — `from anthropic import AsyncAnthropic`, `AsyncAnthropic(max_retries=0)`
- `requirements.txt` — `anthropic>=1.0`만 있고 **`openai` 패키지는 설치조차 되지 않습니다**
- `app/config.py` — `ai_model: str = "claude-opus-5"`
- 호출 인자 `output_config={"format": {"type": "json_schema", ...}, "effort": ...}` 는 **Anthropic 전용 스키마**라 공급자만 바꿔서는 성립하지 않습니다

`.env.example`에 **"공급자에 따라 둘 중 하나만 있으면 됩니다 (공급자 미확정, 2026-08-25)"** 라고 적혀 있는데, 코드는 이미 anthropic으로 확정돼 있습니다. **문서·스크립트만 미확정 시점에 멈춰 있습니다.**

## 2. ⚠️ 더 문제는, 틀린 키로 등록해도 그렇게 보이지 않는다는 겁니다

실제로 겪은 순서입니다. OpenAI 키를 등록한 상태에서 텍스트 판독을 호출했습니다.

```
$ curl -X POST localhost:8000/internal/extract \
    -H "X-Internal-Token: <token>" -H "Content-Type: application/json" \
    -d '{"rawText":"9월 1일에 자전거를 30만원에 팔았어요."}'

HTTP 502
{"error":"EXTRACTION_FAILED",
 "message":"이미지에서 내용을 읽지 못했습니다.",
 "fallback":"text_input"}
```

서버 로그입니다.

```
WARNING ai.llm extract llm unexpected TypeError
WARNING ai.llm extract llm unexpected TypeError
WARNING ai.llm extract failed after retry: unexpected
INFO    ai.access POST /internal/extract 502 0.05s
```

**세 가지가 겹칩니다.**

1. **설정 오류가 판독 실패로 둔갑합니다.** `ANTHROPIC_API_KEY`가 없어 SDK가 `TypeError`를 내는데, 밖으로는 `EXTRACTION_FAILED`가 나갑니다. 이건 **사용자에게 그대로 노출되는 계약 오류 코드**입니다 — 프론트는 이 코드를 받으면 "이미지에서 내용을 읽지 못했어요. 텍스트로 직접 적어주세요"를 띄우고 텍스트 입력 화면으로 보냅니다.
2. **텍스트 입력인데 "이미지에서 내용을 읽지 못했습니다"라고 답합니다.** 게다가 `fallback: "text_input"`입니다 — **이미 텍스트로 보낸 요청에 텍스트 입력을 대안으로 제시**하는 셈이라, 프론트가 그대로 따르면 같은 자리를 맴돕니다.
3. **설정 오류인데 재시도합니다.** 로그에 `TypeError`가 두 번 찍힙니다. 키가 없는 상태는 다시 불러도 결과가 같은데 LLM 호출을 한 번 더 씁니다. 운영에서 키가 잘못 주입되면 **모든 요청이 2배로 호출**됩니다.

**개발자 입장에서 원인을 찾을 단서가 로그의 `TypeError` 한 줄뿐입니다.** 저는 코드를 읽고 나서야 알았습니다.

## 3. 제안

| # | 항목 | 이유 |
| --- | --- | --- |
| 1 | `set_key.py`의 **2번 선택지를 없애거나**, 남긴다면 "현재 미지원"으로 표시 | 고를 수 있으면 고른 사람이 생깁니다 |
| 2 | `.env.example`의 `# OPENAI_API_KEY=` 줄과 "공급자 미확정" 문구 정리 | anthropic으로 확정된 상태를 반영 |
| 3 | **기동 시 `ANTHROPIC_API_KEY` 유무를 확인**하고, 없으면 로그에 명시적으로 남기기 | 첫 호출까지 기다리지 않고 즉시 알 수 있습니다 |
| 4 | **인증·설정 오류를 `EXTRACTION_FAILED`로 감싸지 않기** — 재시도 없이 별도 코드나 500으로 | 사용자를 텍스트 입력으로 보내도 해결되지 않는 문제입니다 |
| 5 | 텍스트 경로의 실패 메시지에서 "이미지에서"를 빼고, **텍스트 요청에는 `fallback: "text_input"`을 주지 않기** | 같은 자리를 맴돕니다 |

3~5번은 이번 건과 무관하게 남는 문제라 같이 봐주시면 좋겠습니다. **1·2번만이라도 먼저** 고쳐주시면 다음 사람이 같은 데서 막히지 않습니다.

## 4. 프론트가 확인한 것 (참고)

AI-server 자체는 정상 기동합니다. 키와 무관한 부분은 계약대로였습니다.

| 항목 | 결과 |
| --- | --- |
| `GET /internal/health` | `{"status":"UP"}` |
| `X-Internal-Token` 없음 / 불일치 | **`401 UNAUTHORIZED`** — 계약대로 |
| 잘못된 본문 키 (`raw_text`) | `400 BAD_REQUEST` + `{"rawText": "..."}` 형식 안내. **필드명을 정확히 짚어줍니다** |
| Python 3.12 venv + `requirements.txt` | 설치·기동 문제 없음 |

## AI 담당이 할 것

| # | 항목 | 시점 |
| --- | --- | --- |
| 1 | §3 1·2번 (선택지·예시 파일 정리) | 언제든 |
| 2 | §3 3~5번 (기동 시 키 확인 / 설정 오류를 판독 실패로 감싸지 않기 / 텍스트 경로 메시지) | 데모 리허설 전 |
