# AI-server — 해빙 (解氷)

지급정지 계좌 소명 지원 서비스의 AI 서버. **멀티모달 판독**(이미지 → 구조화 카드)과 **소명서 생성**(문장 생성 + 결정적 사실 검증 + 문장-근거 연결)을 담당합니다. 백엔드만 호출하는 내부 API 서버이며, 프론트엔드가 직접 호출하지 않습니다.

- 스택: Python 3.12 · FastAPI · Claude API (`claude-opus-5`) · Render
- **설계와 실행 계획은 [`docs/`](docs/)에 있습니다. 작업 전 [`docs/design.md`](docs/design.md)를 먼저 여세요.**

## 절대 원칙

> **제출 준비도 점검을 하지 않습니다.** 이 서버에는 "준비도" 개념이 없습니다 — 준비도는 백엔드 `ReadinessService`(결정적 규칙 엔진)의 몫이고, 이 서버는 증거 추출과 문장 생성만 합니다. 은행의 승인·기각을 예측하는 출력을 만들지 않습니다.

> **아무것도 저장하지 않습니다.** 완전 무상태(stateless) 서버입니다. 이미지는 메모리로 받아 LLM 호출 후 즉시 폐기하고, 디스크·DB에 쓰지 않으며, 로그에 이미지 내용·추출 텍스트·소명서 본문을 남기지 않습니다. Supabase에 접근하지 않습니다.

## 엔드포인트 (계약: [`docs/02-architecture/internal-api-contract.md`](../docs/02-architecture/internal-api-contract.md))

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/internal/extract` | 이미지(raw body) 또는 텍스트(JSON) → 카드 + signals | `X-Internal-Token` |
| POST | `/internal/draft` | 확인된 이벤트 + reason/readiness → 소명서 + 문장-근거 연결 + 사실검증 | `X-Internal-Token` |
| GET | `/internal/health` | 헬스체크 (킵얼라이브용) | 없음 (공개) |

## 실행

```bash
cd ai-server
pip install -r requirements.txt
INTERNAL_TOKEN=dev ANTHROPIC_API_KEY=... uvicorn app.main:app --port 8000
```

환경변수 전체 목록은 [`docs/design.md`](docs/design.md) §8 참조.

## 디렉터리

| 경로 | 내용 |
| --- | --- |
| `app/` | 서버 코드 (라우터 / 서비스 / LLM / 결정적 검증기) |
| `demo/` | 오프라인 데모 모드용 사전 응답 세트 — 백엔드가 `src/main/resources/demo/`로 복사 |
| `evals/` | AI 품질 평가 세트 (F11-05) — 합성 이미지 + 채점 러너 |
| `docs/` | [design.md](docs/design.md) 설계 · [plan.md](docs/plan.md) 실행 계획 |

## 참고 문서

| 문서 | 내용 |
| --- | --- |
| [`../docs/00-context/prd.md`](../docs/00-context/prd.md) §10 | AI 파이프라인 명세 (프롬프트 원칙·실패 처리) |
| [`../docs/02-architecture/internal-api-contract.md`](../docs/02-architecture/internal-api-contract.md) | 백엔드↔AI-server 내부 API 계약 (단일 출처) |
| [`../docs/03-infra-ops/privacy-and-safety.md`](../docs/03-infra-ops/privacy-and-safety.md) | 무저장 원칙 — AI 책임 항목 |
| [`../docs/04-testing/test-cases-and-demo.md`](../docs/04-testing/test-cases-and-demo.md) | TC-06·08·09·10 등 AI 소관 테스트 |
