# AI-server 배포 — Cloudflare Containers

> 팀 문서 단일 출처: `../../docs/03-infra-ops/deployment-and-uptime.md` §3, `../../docs/00-context/prd.md` §8.3.
> **2026-08-25 변경**: 종전 지정은 Render Starter였으나 Cloudflare Containers로 바꿨습니다. **AI-server 구현은 바뀌지 않습니다** — 같은 `Dockerfile`을 그대로 올립니다.

## 구조

```
백엔드 (Render)  ──HTTPS──▶  Cloudflare Worker  ──▶  Container
                              (엣지, 항상 살아 있음)     (python:3.12-slim + uvicorn)
                              worker/index.ts           Dockerfile
```

Worker는 **라우팅만** 합니다. `X-Internal-Token` 검증도, 계약 스키마 처리도 전부 컨테이너 안 FastAPI가 합니다 — 같은 검증을 두 곳에 두면 어느 쪽이 진짜인지 알 수 없게 되기 때문입니다.

**`/internal/health`도 컨테이너까지 전달합니다.** 엣지에서 끊으면 "Worker는 살아 있고 컨테이너는 죽은" 상태를 정상으로 보고하게 되어 킵얼라이브의 목적이 사라집니다.

## 사전 준비

| 항목 | 확인 |
| --- | --- |
| Cloudflare 계정 + **Workers Paid 플랜** ($5/월) | Containers는 유료 플랜 전용 기능입니다. 무료 플랜에는 기능 자체가 없습니다 |
| **Docker Desktop 실행 중** | `wrangler deploy`가 로컬에서 이미지를 빌드해 푸시합니다. `docker info`가 성공해야 합니다 |
| Node.js | `npx`를 쓰기 위해 필요 |
| `INTERNAL_TOKEN` 값 | **백엔드가 생성해 팀 채널로 공유**합니다 (32자 이상 랜덤). 저장소에 커밋하지 않습니다 |

## 배포 절차

```bash
cd ai-server

# 1. 의존성 (버전은 npm이 현재 것으로 잡게 둔다)
npm install --save-dev wrangler
npm install @cloudflare/containers

# 2. Cloudflare 로그인 (브라우저가 열립니다)
npx wrangler login

# 3. 시크릿 등록 — 저장소에 들어가지 않습니다
npx wrangler secret put INTERNAL_TOKEN      # 백엔드가 공유한 값
npx wrangler secret put ANTHROPIC_API_KEY   # LLM 키 (아래 주의 참조)

# 4. 배포 — Docker 이미지 빌드 + 푸시 + Worker 업로드가 한 번에 일어납니다
npx wrangler deploy
```

배포가 끝나면 `https://haebing-ai-server.<계정서브도메인>.workers.dev` 형태의 URL이 출력됩니다. **이 URL이 백엔드에 전달할 `AI_SERVER_URL`입니다.**

## 배포 후 확인 (반드시 이 3개)

```bash
BASE=https://haebing-ai-server.<계정서브도메인>.workers.dev

# ① 헬스체크가 무인증으로 200 — 킵얼라이브·모니터링이 이걸 씁니다
curl -i $BASE/internal/health
# 기대: 200 {"status":"UP"}

# ② 토큰 없는 요청은 401 — 외부에서 내부 API를 못 쓴다는 확인
curl -i -X POST "$BASE/internal/extract?image_index=0" \
  -H "Content-Type: image/png" --data-binary @sample.png
# 기대: 401 {"error":"UNAUTHORIZED", ...}

# ③ 10MB 이미지가 Worker → 컨테이너 구간을 통과하는지 (엣지 프록시 상한 확인)
curl -i -X POST "$BASE/internal/extract?image_index=0" \
  -H "Content-Type: image/png" -H "X-Internal-Token: <토큰>" \
  --data-binary @big-10mb.png
# 기대: 413이 아닐 것 (LLM 키가 없으면 502 EXTRACTION_FAILED가 정상)
```

③이 실패하면 계약의 이미지 상한(10MB)을 못 지키는 것이므로 **즉시 팀에 공유**해야 합니다 — 백엔드의 `AiClient` 구현 전제가 깨집니다.

## 백엔드에 전달할 것

배포 직후 팀 채널에 이 세 줄이면 됩니다.

```
AI_SERVER_URL = https://haebing-ai-server.<서브도메인>.workers.dev
헬스체크        = GET  {AI_SERVER_URL}/internal/health  (무인증 200)
INTERNAL_TOKEN = 공유해 주신 값 그대로 등록 완료
```

백엔드는 이 URL을 킵얼라이브 GitHub Actions Secrets와 `AiClient` 설정에 넣습니다 (`../../docs/03-infra-ops/deployment-and-uptime.md` 킵얼라이브 절).

## 주의

### LLM 키 이름은 아직 확정이 아닙니다

현재 구현은 Anthropic SDK 기반이라 `ANTHROPIC_API_KEY`를 읽습니다. **공급자가 OpenAI로 확정되면** 이 시크릿 이름과 `worker/index.ts`의 `envVars`를 함께 바꿔야 합니다. 교체 범위는 `app/llm/client.py` + `app/llm/prompts.py`의 structured output 부분뿐입니다 — 스키마·프롬프트 문안·FactChecker는 공급자 중립입니다.

**키가 없어도 배포는 됩니다.** 서버가 뜨고 `/internal/health`는 200을 주며, LLM을 실제로 쓰는 경로만 계약대로 502(`EXTRACTION_FAILED` / `DRAFT_FAILED`)를 돌려줍니다. 그래서 **키 확정을 기다리지 않고 먼저 배포해 백엔드의 연동을 풀어줄 수 있습니다.**

### 9/5까지 할 것

- [ ] Workers Paid 플랜 전환 (미전환 상태로는 Containers 배포 자체가 안 됩니다)
- [ ] 외부 헬스체크 도구에 URL 등록 (5~10분 간격) — 이 간격이 `sleepAfter = "45m"`보다 짧으므로 컨테이너가 잠들지 않습니다
- [ ] 심사 기간(9/7 11:00~9/11 23:59) 무중단 확인

### 재배포

코드를 고친 뒤 `npx wrangler deploy`를 다시 실행하면 됩니다. **URL은 바뀌지 않습니다** — 백엔드에 다시 공유할 필요가 없습니다.

### 로그 보기

```bash
npx wrangler tail
```

컨테이너 로그에는 개인정보가 남지 않습니다(NFR-08). 소요 시간·상태 코드·토큰 수만 남습니다 — `design.md` §6.
