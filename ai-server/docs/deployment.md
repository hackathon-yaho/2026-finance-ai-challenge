# AI-server 배포 — Google Cloud Run (무료 한도)

> 팀 문서 단일 출처: `../../docs/03-infra-ops/deployment-and-uptime.md` §3, `../../docs/00-context/prd.md` §8.3.
> **2026-08-25 변경**: 종전 지정은 Render Starter($7/월)였습니다. **AI-server 구현은 바뀌지 않습니다** — 같은 `Dockerfile`을 그대로 올리고, **비용은 $0**입니다.

## 왜 Cloud Run인가

- **코드 변경 없음.** Dockerfile을 그대로 빌드해 돌립니다. `Dockerfile`이 이미 `${PORT:-8000}`으로 바인딩하므로 Cloud Run이 주입하는 `PORT`(기본 8080)를 그대로 받습니다 — 수정할 것이 없습니다.
- **접속 불가 구간이 없음.** 인스턴스가 0으로 줄어도 요청이 오면 구글 프론트엔드가 컨테이너를 기동해 응답합니다. Render 무료 티어처럼 "재기동 1분 동안 접속 불가"가 되지 않습니다. 콜드스타트 수 초의 지연일 뿐이고, 킵얼라이브를 돌리면 그것도 없습니다.
- **요청 바디 32 MiB** — 계약 상한 10MB가 여유 있게 통과합니다.
- **무료 한도가 우리 사용량보다 훨씬 큽니다.** 심사 기간 전체를 합쳐도 수천 요청 규모(킵얼라이브 5분 간격 × 4.5일 ≈ 1,300건 + 심사 트래픽)로, Always Free 한도의 0.1% 미만입니다.

### Cloudflare를 기각한 이유 (재논의 방지)

- Workers는 컨테이너를 실행하지 않습니다. Docker를 돌리는 **Containers는 Workers Paid($5/월) 전용**입니다.
- TypeScript로 재작성해 무료 Workers에 올리는 안은 **무료 티어 CPU 한도 10ms**(유료 30초)에 막힙니다 — 이미지를 LLM에 보내려면 base64 인코딩이 필요한데 1MB급에서도 초과합니다.
- Python Workers(Pyodide)는 **베타 런타임**이라 가동시간이 결격 사유인 대회에 쓰지 않습니다.

## 사전 준비

| 항목 | 확인 |
| --- | --- |
| GCP 프로젝트 + **결제 계정 연결** | 무료 한도만 써도 결제 계정 연결이 필요합니다. 한도 내에서는 청구되지 않습니다 |
| `gcloud` CLI 설치·로그인 | `gcloud auth login`, `gcloud config set project <PROJECT_ID>` |
| `INTERNAL_TOKEN` 값 | **백엔드가 생성해 팀 채널로 공유**합니다 (32자 이상 랜덤). 저장소에 커밋하지 않습니다 |

로컬 Docker는 **필요 없습니다** — `--source` 배포는 Cloud Build가 클라우드에서 이미지를 빌드합니다.

## 배포 절차

```bash
cd ai-server

# 1. 필요한 API 활성화 (최초 1회)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

# 2. 시크릿 등록 — 저장소에 들어가지 않습니다
printf '%s' '<백엔드가 준 토큰>' | gcloud secrets create INTERNAL_TOKEN --data-file=-
printf '%s' '<LLM API 키>'      | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
# 값을 바꿀 때는: printf '%s' '<새 값>' | gcloud secrets versions add INTERNAL_TOKEN --data-file=-

# 3. 배포 (소스에서 빌드 → 배포까지 한 번에)
gcloud run deploy haebing-ai-server \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 4 \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 60s \
  --set-secrets INTERNAL_TOKEN=INTERNAL_TOKEN:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest
```

**옵션 설명 (임의로 바꾸면 안 되는 것들)**

| 옵션 | 이유 |
| --- | --- |
| `--allow-unauthenticated` | 백엔드가 IAM 토큰 없이 호출합니다. **접근 통제는 `X-Internal-Token`이 담당**하며(계약), `/internal/health`는 킵얼라이브를 위해 무인증 공개여야 합니다 |
| `--region asia-northeast3` | 서울. 백엔드·사용자와 가까워 지연이 가장 작습니다 |
| `--concurrency 4` | 앱의 `MAX_CONCURRENCY`(기본 4)와 맞춥니다. 더 키우면 한 인스턴스에 이미지가 몰려 메모리를 넘길 수 있습니다 |
| `--min-instances 0` | **1로 올리면 유휴 과금이 발생해 무료 한도를 벗어납니다.** 콜드스타트는 킵얼라이브로 막습니다 |
| `--memory 1Gi` | 10MB 이미지 × 동시 4건(base64 포함 약 13MB씩)을 감당하기 위한 여유 |

배포가 끝나면 `https://haebing-ai-server-<해시>-du.a.run.app` 형태의 URL이 출력됩니다. **이 URL이 백엔드에 전달할 `AI_SERVER_URL`입니다.**

## 배포 후 확인 (반드시 이 3개)

```bash
BASE=https://haebing-ai-server-<해시>-du.a.run.app

# ① 헬스체크가 무인증으로 200 — 킵얼라이브·모니터링이 이걸 씁니다
curl -i $BASE/internal/health
# 기대: 200 {"status":"UP"}

# ② 토큰 없는 요청은 401 — 외부에서 내부 API를 못 쓴다는 확인
curl -i -X POST "$BASE/internal/extract?image_index=0" \
  -H "Content-Type: image/png" --data-binary @sample.png
# 기대: 401 {"error":"UNAUTHORIZED", ...}

# ③ 10MB 이미지가 통과하는지 (계약 상한)
curl -i -X POST "$BASE/internal/extract?image_index=0" \
  -H "Content-Type: image/png" -H "X-Internal-Token: <토큰>" \
  --data-binary @big-10mb.png
# 기대: 413이 아닐 것 (LLM 키가 없으면 502 EXTRACTION_FAILED가 정상)
```

③이 실패하면 계약의 이미지 상한(10MB)을 못 지키는 것이므로 **즉시 팀에 공유**해야 합니다 — 백엔드 `AiClient` 구현의 전제가 깨집니다.

## 백엔드에 전달할 것

배포 직후 팀 채널에 이 세 줄이면 됩니다.

```
AI_SERVER_URL  = https://haebing-ai-server-<해시>-du.a.run.app
헬스체크        = GET {AI_SERVER_URL}/internal/health  (무인증 200)
INTERNAL_TOKEN = 공유해 주신 값 그대로 등록 완료
```

백엔드는 이 URL을 킵얼라이브 GitHub Actions Secrets와 `AiClient` 설정에 넣습니다.

## 주의

### LLM 키 이름은 아직 확정이 아닙니다

현재 구현은 Anthropic SDK 기반이라 `ANTHROPIC_API_KEY`를 읽습니다. **공급자가 OpenAI로 확정되면** 시크릿 이름과 `--set-secrets`를 함께 바꿔야 합니다. 교체 범위는 `app/llm/client.py` + `app/llm/prompts.py`의 structured output 부분뿐이며, 스키마·프롬프트 문안·FactChecker는 공급자 중립입니다.

**키가 없어도 배포는 됩니다.** 서버가 뜨고 `/internal/health`는 200을 주며, LLM을 실제로 쓰는 경로만 계약대로 502(`EXTRACTION_FAILED` / `DRAFT_FAILED`)를 돌려줍니다. 그래서 **키 확정을 기다리지 않고 먼저 배포해 백엔드 연동을 풀어줄 수 있습니다.** (시크릿을 아직 안 만들었다면 `--set-secrets`에서 `ANTHROPIC_API_KEY` 항목만 빼고 배포하면 됩니다.)

### 콜드스타트 — 킵얼라이브가 유일한 대책입니다

`min-instances=1`은 유휴 과금이 붙어 무료 한도를 벗어나므로 쓰지 않습니다. 대신 **외부 헬스체크를 5~10분 간격**으로 돌려 인스턴스를 살려 둡니다. 심사 기간(9/7 11:00~9/11 23:59) 전에 반드시 동작을 확인하세요.

### 예산 알림

무료 한도를 넘겼을 때 모르고 지나가지 않도록 GCP 결제 → 예산 및 알림에서 **$1 임계값 알림**을 걸어 두세요. 정상 사용량이면 알림이 올 일이 없고, 오면 뭔가 잘못된 것입니다.

### 재배포

`gcloud run deploy` 명령을 다시 실행하면 됩니다. **URL은 바뀌지 않습니다** — 백엔드에 다시 공유할 필요가 없습니다.

### 로그 보기

```bash
gcloud run services logs read haebing-ai-server --region asia-northeast3 --limit 50
```

로그에는 개인정보가 남지 않습니다(NFR-08). 소요 시간·상태 코드·토큰 수만 남습니다 — `design.md` §6.
