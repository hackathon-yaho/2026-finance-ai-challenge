# 배포 및 가동시간 리스크 대응

> 출처: `../00-context/prd.md` §8. **이 문서는 대회 결격 여부와 직결됩니다.** 제출된 웹서비스 URL은 2026.9.7 11:00 ~ 9.11 23:59 동안 접근 가능해야 하며, 접근 불가 시 결격 사유에 해당합니다.
>
> **개정 (2026-08-23 이후)**: 프론트엔드·백엔드·AI-server가 독립적으로 배포되는 3개 서비스로 분리되었습니다. **각 서비스는 그 서비스를 만든 담당자가 직접 배포하고 가동 상태를 책임집니다.** 아래는 서비스별로 정리했습니다.
>
> **개정 (2026-08-25, AI)** — **AI-server 배포처를 Render → Cloudflare Containers로 변경합니다.** 이 문서가 AI-server를 Render Starter로 지정하고 있었으나, AI 담당이 Cloudflare를 사용하기로 결정했습니다. 코드 변경은 없습니다(같은 Dockerfile을 그대로 올립니다). 비용은 월 $14 → **약 $12**로 내려갑니다. 상세·근거는 §3.
>
> **백엔드·프론트엔드는 영향이 없습니다.** 백엔드가 알아야 할 것은 `AI_SERVER_URL`의 도메인이 `*.onrender.com`이 아니라 `*.workers.dev`가 된다는 것뿐이며, 계약(`../02-architecture/internal-api-contract.md`)은 그대로입니다.

## 한눈에 보기

| 서비스 | 담당 | 권장 호스팅 | 비용 | 스핀다운 리스크 |
| --- | --- | --- | --- | --- |
| 프론트엔드 | 프론트 | Vercel / Netlify / Cloudflare Pages | $0 | 없음 (정적 파일) |
| 백엔드 | 백엔드 | Render Web Service (Starter) | $7/월 | 있음 → Starter로 제거 |
| AI-server | AI | **Cloudflare Containers** (Workers 유료 플랜) | 약 $5~7/월 | 있음 → `sleepAfter` + 킵얼라이브로 제거 |
| Supabase (백엔드 전용) | 백엔드 | Supabase 무료 플랜 + 킵얼라이브 | $0 | 7일 비활성 시 일시정지 |

총 예상 비용: **월 약 $12**. 비용을 아끼려고 백엔드나 AI-server를 무료 티어로 남기지 않습니다 — 스핀다운은 대회 결격 사유와 직결되어 협상 대상이 아닙니다.

---

## 1. 프론트엔드 — 정적 호스팅 (담당: 프론트)

정적 SPA는 Render Web Service보다 Vercel/Netlify/Cloudflare Pages 같은 정적 호스팅이 낫습니다. 스핀다운 개념이 없고 무료 티어로 충분합니다.

**체크리스트**
- [ ] Vercel/Netlify 등에 배포 (자동 배포 연동 권장 — main 브랜치 push 시 자동 배포)
- [ ] 백엔드 API 엔드포인트 URL을 환경변수로 관리 (하드코딩 금지 — 배포 환경마다 바뀔 수 있음)
- [ ] 백엔드와 CORS 협의 완료 (허용 origin에 프론트 배포 도메인 등록 요청). **`localhost:5173`은 이미 등록되어 로컬 연동은 도메인 확정 전에도 가능**하며, **프리뷰 서브도메인은 허용되지 않으므로 프리뷰 확인은 로컬로 대체**한다 (2026-08-24 확정)
- [ ] 9/7~9/11 매일 아침 URL 직접 접속 확인 (로테이션에 포함)

## 2. 백엔드 — Render (담당: 백엔드)

### 확인된 제약

| 제약 | 내용 | 대회 영향 |
| --- | --- | --- |
| **스핀다운** | 15분간 요청이 없으면 무료 웹 서비스가 스핀다운, 재기동에 약 1분 | **치명적.** 심사위원 접속 시 지연 |
| **휘발성 파일시스템** | 재배포·재시작 시 로컬 파일 전부 소실 | 이미지를 로컬에 저장하지 않으므로 직접 타격 없음. 세션(인메모리)은 재시작 시 유실 감수 |
| 리소스 | 512MB RAM, 0.1 CPU | Spring Boot 구동 시 빠듯함 |

**체크리스트**
- [ ] **9월 5일까지** Render Starter 플랜 전환 ($7/월, 스핀다운 제거)
- [ ] CORS 설정 — **`http://localhost:5173`(Vite 개발 서버)을 먼저 등록** (2026-08-24 확정). 프론트 배포 도메인은 미정이므로 확정되면 추가하며, **프리뷰 서브도메인 와일드카드는 허용하지 않는다**(`../02-architecture/api-contract.md` CORS 절)
- [ ] `spring.servlet.multipart.max-file-size` / `max-request-size`를 **10MB로 상향** — 기본값 1MB로는 1600px 리사이즈된 정상 캡처(장당 300KB~1MB)가 `400`으로 떨어진다 (F3-02 검증 ③)
- [ ] Render 프록시의 요청 바디 상한이 10MB 요청을 통과시키는지 확인
- [ ] `GET /actuator/health` 헬스체크 엔드포인트 구현 (킵얼라이브용) — 단순 상태 반환이 아니라 **DB에 실제로 쿼리를 날려야 함**
- [ ] Supabase 킵얼라이브 워크플로 등록 (아래 참조)
- [ ] AI-server 내부 API 호출 타임아웃·재시도 설정 (`../02-architecture/internal-api-contract.md`)
- [ ] Render 컨테이너에 한글 폰트(`fonts-nanum` 등) 설치 — 없으면 PDF 생성 시 한글이 깨짐

## 3. AI-server — Cloudflare Containers (담당: AI 개발자)

**2026-08-25 변경.** 종전 지정은 Render Starter였습니다. AI-server의 구현(Python FastAPI + Dockerfile)은 **바꾸지 않습니다** — 같은 이미지를 Cloudflare에 올립니다.

### 구조

```
백엔드 (Render)
   │  https://<name>.<subdomain>.workers.dev/internal/*
   ▼
Cloudflare Worker (엣지, 항상 살아 있음)
   │  요청을 그대로 전달 (헤더·쿼리·raw body 보존)
   ▼
Container — 기존 Dockerfile (python:3.12-slim + uvicorn)
```

Worker는 라우팅만 하고 **판단하지 않습니다.** 인증(`X-Internal-Token`)·계약 처리는 종전대로 전부 컨테이너 안의 FastAPI가 합니다 — 검증 로직이 두 곳에 흩어지지 않게 하기 위해서입니다.

### 왜 Render 대신인가

| 항목 | 근거 |
| --- | --- |
| **코드 변경 없음** | Cloudflare Containers는 Dockerfile을 그대로 빌드해 실행합니다. Python Workers(Pyodide)로 포팅하지 않습니다 — **Python Workers는 베타**이고, 가동시간이 결격 사유인 대회에 베타 런타임을 쓰지 않습니다 |
| **URL이 죽지 않음** | 앞단 Worker는 항상 살아 있습니다. 컨테이너가 잠들어 있어도 요청이 오면 깨우므로, 심사위원 접속 시 **연결 거부가 나지 않습니다.** Render 무료 티어의 스핀다운(재기동 1분)과 성격이 다릅니다 |
| **콜드스타트** | 1~3초 (Cloudflare 공식 수치). 킵얼라이브가 5분 간격으로 돌면 애초에 잠들지 않습니다 |
| 비용 | Workers 유료 플랜 $5/월 + 사용량. 심사 기간만 상시 가동하면 총 $6 내외 — Render Starter $7보다 쌉니다 |

### 확인된 제약

| 제약 | 내용 | 대응 |
| --- | --- | --- |
| **유료 플랜 필수** | Containers는 Workers Paid($5/월) 전용 | 9/5까지 전환. 무료 플랜에는 기능 자체가 없음 |
| **배포에 Docker 필요** | `wrangler deploy`가 로컬에서 이미지를 빌드해 푸시 | 배포자 PC에 Docker Desktop 필요 |
| **유휴 시 sleep** | 기본 10분 | `sleepAfter`를 길게 설정 + 킵얼라이브. **헬스체크를 Worker에서 끊지 않고 컨테이너까지 전달**해 실제 컨테이너 생존을 확인하면서 동시에 깨어 있게 유지 |
| 인스턴스 크기 | `basic` = 1/4 vCPU · 1 GiB · 4 GB | 동시 4요청 × 10MB 이미지(base64 포함 약 13MB)를 감당하려면 `lite`(256 MiB)로는 빠듯 |

**체크리스트**
- [ ] **9월 5일까지** Workers Paid 플랜 전환 ($5/월)
- [x] `GET /internal/health` 헬스체크 엔드포인트 구현 (무인증 공개 — 킵얼라이브 목적)
- [ ] 헬스체크가 **컨테이너까지 도달**하는지 확인 (Worker에서 조기 응답하면 컨테이너 생존을 확인하지 못함)
- [ ] 외부 헬스체크 도구에 AI-server URL 등록 (5~10분 간격)
- [x] `/internal/*` 나머지 경로는 백엔드 외 요청을 거부하도록 인증 구현 (`../02-architecture/internal-api-contract.md`)
- [x] 오프라인 데모 모드용 사전 응답 세트 준비 (`../../ai-server/demo/`, 발표 당일 네트워크 장애 대비)
- [x] 이미지가 LLM 호출 후 즉시 폐기되는지 확인 (디스크 기록 없음)
- [ ] 10MB 요청이 Worker → 컨테이너 구간을 통과하는지 실측 (엣지 프록시 바디 상한 확인)
- [ ] `INTERNAL_TOKEN`·LLM API 키를 **Cloudflare secret**으로 등록 (`wrangler secret put` — 저장소에 커밋하지 않음)

> 배포 절차와 설정 파일은 `../../ai-server/docs/deployment.md`에 있습니다.

## 4. Supabase — 백엔드 전용 (담당: 백엔드)

AI-server는 Supabase에 접근하지 않습니다. 통계 저장은 백엔드만 수행합니다.

| 제약 | 내용 |
| --- | --- |
| **7일 비활성 일시정지** | 무료 플랜은 7일간 DB 활동이 없으면 일시정지, 수동 복구 전까지 접근 불가 |
| DB 용량 | 프로젝트당 500MB (여유) |
| 백업 | 없음 — 스키마를 코드로 관리 (`../02-architecture/data-model.md`) |

### 킵얼라이브 워크플로 (백엔드가 등록)

> GitHub Actions는 **UTC로 실행**되므로 KST 대비 9시간 차이를 주석으로 표시했습니다.

```yaml
# .github/workflows/keepalive.yml
name: keepalive

on:
  schedule:
    - cron: "0 0 * * 0,3"  # UTC 기준 일·수요일 00:00 = KST 09:00
  workflow_dispatch:

jobs:
  ping-supabase:
    runs-on: ubuntu-latest
    steps:
      - name: ping supabase
        run: |
          curl -sS -X POST "${{ secrets.SUPABASE_URL }}/rest/v1/keepalive" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'

  ping-backend:
    runs-on: ubuntu-latest
    steps:
      - name: ping backend health
        run: curl -sS -o /dev/null "${{ secrets.BACKEND_URL }}/actuator/health"

  ping-ai-server:
    runs-on: ubuntu-latest
    steps:
      - name: ping ai-server health
        run: curl -sS -o /dev/null "${{ secrets.AI_SERVER_URL }}/internal/health"
```

필요한 GitHub Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BACKEND_URL`, `AI_SERVER_URL`. 저장소 Settings → Secrets and variables → Actions에서 등록합니다. **백엔드 담당이 이 워크플로 파일을 등록**하고, AI 개발자에게 `AI_SERVER_URL` 값을 요청합니다.

**유료 전환 판단 근거**: 대회 규칙상 URL 미접근은 결격 사유입니다. 서비스가 3개로 분리되며 총 비용이 월 약 $12(백엔드 Render Starter $7 + AI-server Cloudflare 약 $5~7)가 되었지만, 16일간 개발한 결과물이 콜드스타트 지연 때문에 무효화되는 위험 대비 여전히 명백히 합리적입니다. 이 항목은 협상 대상이 아닙니다.

## 전체 체크리스트 (심사 기간 대비)

- [ ] (프론트) 9/5까지 정적 호스팅 배포 완료
- [ ] (백엔드) 9/5까지 Render Starter 전환, CORS 설정, 킵얼라이브 워크플로 등록
- [ ] (AI) 9/5까지 **Cloudflare Workers Paid 전환**, 헬스체크 공개, 외부 모니터링 등록
- [ ] (전원) 오프라인 데모 모드(`DEMO_MODE=true`) 동작 확인 — 발표 당일 네트워크 장애 대비
- [ ] (전원) 9/6 밤: 3개 서비스 전체 플로우 3회 완주 확인
- [ ] (전원) 9/7~9/11 매일 아침 3개 URL(프론트 진입점, 백엔드 헬스체크, AI-server 헬스체크) 확인 로테이션
