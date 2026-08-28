# AI-server — 해빙 (解氷)

지급정지 계좌 소명 지원 서비스의 AI 서버. **멀티모달 판독**(이미지 → 구조화 카드)과 **소명서 생성**(문장 생성 + 결정적 사실 검증 + 문장-근거 연결)을 담당합니다. 백엔드만 호출하는 내부 API 서버이며, 프론트엔드가 직접 호출하지 않습니다.

- 스택: Python 3.12 · FastAPI · **OpenAI** (추출 `gpt-5.4-mini` · 소명서 `gpt-5.5`) · **Google Cloud Run**
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

### 키 등록 (PowerShell)

**어느 폴더에 있든 되는 형태** — 경로를 그대로 복사해 쓰세요. 가상환경 생성·패키지 설치까지 알아서 합니다.

```powershell
powershell -ExecutionPolicy Bypass -File "<저장소경로>i-server\set-key.ps1"
```

`ai-server` 폴더로 먼저 이동했다면 아래처럼 짧게 쓸 수 있습니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\set-key.ps1
```

> **`.\set-key.ps1`로 바로 실행하면 막힐 수 있습니다.** Windows 기본 실행 정책이 `Restricted`라 `.ps1` 실행을 금지하기 때문입니다. 위 `-ExecutionPolicy Bypass` 형태는 정책을 **바꾸지 않고** 그 실행에만 적용됩니다.
>
> 매번 길게 치기 싫으면 한 번만 정책을 풀어두면 됩니다 — `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (관리자 권한 불필요). 그 뒤로는 `.\set-key.ps1`로 실행됩니다.

등록된 값 확인 (입력받지 않고 마스킹해서 보여줍니다):

```powershell
powershell -ExecutionPolicy Bypass -File .\set-key.ps1 -Show
```

### 서버 실행

```bash
cd ai-server
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

PowerShell 없이 직접 등록하려면 `python scripts/set_key.py` (같은 화면입니다).

### 키 등록 방식

**키를 코드나 문서에 직접 쓰지 않습니다.** `scripts/set_key.py`가 CLI로 입력받아 `.env`에 저장하고, 서버가 시작할 때 자동으로 읽습니다. 다시 입력할 필요가 없습니다.

| 장치 | 이유 |
| --- | --- |
| 입력이 화면에 표시되지 않음 (`getpass`) | 터미널 기록·어깨너머 노출 방지 |
| 키를 명령행 인자로 받지 않음 | `--key sk-...`를 허용하면 셸 히스토리에 남습니다 |
| 쓰기 전 `.env`가 `.gitignore`에 있는지 확인 | 없으면 **아무것도 쓰지 않고 중단**합니다 |
| 출력은 항상 마스킹 (`sk-ant-****...abcd`) | |
| 기존 값 보존 | 파일을 덮어쓰지 않고 해당 줄만 교체 |

`.env`는 `app/config.py`의 `load_dotenv()`가 프로세스 환경변수로 올립니다 — pydantic-settings는 `Settings` 객체만 채우고 `os.environ`에는 넣지 않는데 **LLM SDK는 `os.environ`에서 키를 읽기** 때문입니다. `override=False`라서 **배포 환경(Cloud Run이 Secret Manager에서 주입한 값)이 항상 이깁니다.**

형식은 [`.env.example`](.env.example) 참조. 환경변수 전체 목록은 [`docs/design.md`](docs/design.md) §8.

## 디렉터리

| 경로 | 내용 |
| --- | --- |
| `app/` | 서버 코드 (라우터 / 서비스 / LLM / 결정적 검증기) |
| `demo/` | 오프라인 데모 모드용 사전 응답 세트 — 백엔드가 `src/main/resources/demo/`로 복사 |
| `evals/` | AI 품질 평가 세트 (F11-05) — 합성 이미지 + 채점 러너 |
| `set-key.ps1` | **PowerShell 키 등록 런처** — 가상환경·패키지까지 알아서 준비 |
| `scripts/` | `set_key.py` — API 키를 CLI로 입력받아 `.env`에 저장 |
| `docs/` | [design.md](docs/design.md) 설계 · [plan.md](docs/plan.md) 실행 계획 · [deployment.md](docs/deployment.md) 배포 절차 |

## 기능을 바꿀 때 함께 갱신할 문서

AI-server의 동작을 추가하거나 바꾸면 **코드만 고치고 끝내지 않습니다.** 아래 네 갈래를 같은 변경에서 함께 맞춥니다. 내부 문서만 맞고 제출본이 낡으면, 심사위원이 읽는 내용과 실제로 도는 서비스가 어긋납니다.

| 순서 | 대상 | 무엇을 |
| --- | --- | --- |
| 1 | [`../docs/02-architecture/internal-api-contract.md`](../docs/02-architecture/internal-api-contract.md) | 요청·응답 모양이 바뀌면 **코드보다 먼저** 고칩니다 (계약이 단일 출처) |
| 2 | [`../docs/00-context/prd.md`](../docs/00-context/prd.md) | 요구사항·원칙·AI 파이프라인(§10) |
| 3 | [`../docs/00-context/spec.md`](../docs/00-context/spec.md) | 해당 기능 항목(F3·F4·F7·F10·F11) |
| 4 | **제출본** `submission-기획서-해빙.pdf` · `submission-기능명세서-해빙.pdf` | 대회에 실제로 내는 산출물. **직접 수정하지 않습니다** (`../docs/README.md` 규정, 작성 소관은 프론트/팀장) — 바뀐 문장을 `../docs/request/frontend/`에 정정 요청으로 넘깁니다 |

제출본 2종은 코드만큼 중요한 제출물입니다(PRD §12.1). 마감 직전에 몰아서 맞추면 반드시 빠지는 항목이 생기므로, 기능을 건드릴 때마다 그 자리에서 반영합니다.

## 참고 문서

| 문서 | 내용 |
| --- | --- |
| [`../docs/00-context/prd.md`](../docs/00-context/prd.md) §10 | AI 파이프라인 명세 (프롬프트 원칙·실패 처리) |
| [`../docs/02-architecture/internal-api-contract.md`](../docs/02-architecture/internal-api-contract.md) | 백엔드↔AI-server 내부 API 계약 (단일 출처) |
| [`../docs/03-infra-ops/privacy-and-safety.md`](../docs/03-infra-ops/privacy-and-safety.md) | 무저장 원칙 — AI 책임 항목 |
| [`../docs/04-testing/test-cases-and-demo.md`](../docs/04-testing/test-cases-and-demo.md) | TC-06·08·09·10 등 AI 소관 테스트 |
