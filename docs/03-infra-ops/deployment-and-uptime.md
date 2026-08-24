# 배포 및 가동시간 리스크 대응

> 출처: `../00-context/prd.md` §8. **이 문서는 대회 결격 여부와 직결됩니다.** 제출된 웹서비스 URL은 2026.9.7 11:00 ~ 9.11 23:59 동안 접근 가능해야 하며, 접근 불가 시 결격 사유에 해당합니다.
>
> **개정 (2026-08-23 이후)**: 프론트엔드·백엔드·AI-server가 독립적으로 배포되는 3개 서비스로 분리되었습니다. **각 서비스는 그 서비스를 만든 담당자가 직접 배포하고 가동 상태를 책임집니다.** 아래는 서비스별로 정리했습니다.
>
> **개정 (2026-08-25, AI)** — **AI-server 배포처를 Render Starter → Google Cloud Run(무료 한도)으로 변경합니다.** 코드 변경은 없습니다(같은 Dockerfile을 그대로 올립니다). AI-server 인프라 비용이 $7 → **$0**이 되어 팀 총 비용은 월 $14 → **$7**(백엔드 Render Starter만)로 내려갑니다. 상세·근거는 §3.
>
> **백엔드·프론트엔드는 영향이 없습니다.** 백엔드가 알아야 할 것은 `AI_SERVER_URL`의 도메인이 `*.onrender.com`이 아니라 `*.run.app`이 된다는 것뿐이며, 계약(`../02-architecture/internal-api-contract.md`)은 그대로입니다.

## 한눈에 보기

| 서비스 | 담당 | 권장 호스팅 | 비용 | 스핀다운 리스크 |
| --- | --- | --- | --- | --- |
| 프론트엔드 | 프론트 | Vercel / Netlify / Cloudflare Pages | $0 | 없음 (정적 파일) |
| 백엔드 | 백엔드 | Render Web Service (Starter) | $7/월 | 있음 → Starter로 제거 |
| AI-server | AI | **Google Cloud Run** (Always Free 한도) | $0 | 없음 → 요청 시 자동 기동 + 킵얼라이브 |
| Supabase (백엔드 전용) | 백엔드 | Supabase 무료 플랜 + 킵얼라이브 | $0 | 7일 비활성 시 일시정지 |

총 예상 비용: **월 $7** (백엔드 Render Starter만). **"무료 티어를 쓰지 않는다"는 원칙은 무료 티어 일반이 아니라 스핀다운이 있는 무료 티어를 겨냥한 것입니다** — Render 무료 티어는 스핀다운 1분 동안 실제로 접속이 불가능하지만, Cloud Run은 요청이 오면 구글 프론트엔드가 컨테이너를 기동해 응답하므로 접속 불가 구간이 생기지 않습니다(§3). 백엔드는 스핀다운이 실재하므로 Starter 전환이 그대로 필수입니다.

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

## 3. AI-server — Google Cloud Run (담당: AI 개발자)

**2026-08-25 변경.** 종전 지정은 Render Starter($7/월)였습니다. AI-server의 구현(Python FastAPI + Dockerfile)은 **바꾸지 않습니다** — 같은 이미지를 Cloud Run에 올리며, **비용은 $0**입니다.

### 왜 Render 대신인가

| 항목 | 근거 |
| --- | --- |
| **코드 변경 없음** | Cloud Run은 Dockerfile을 그대로 빌드해 실행합니다. 이미 있는 `ai-server/Dockerfile`이 `${PORT}`를 읽으므로 수정도 필요 없습니다 |
| **접속 불가 구간이 없음** | Render 무료 티어는 스핀다운 후 재기동 1분 동안 **실제로 접속이 불가능**합니다. Cloud Run은 인스턴스가 0으로 줄어도 **요청이 오면 구글 프론트엔드가 기동해 응답**하므로 연결 거부가 나지 않습니다 — 콜드스타트 몇 초의 지연일 뿐입니다 |
| **비용 $0** | Always Free 한도(월 200만 요청 수준) 안에서 무료입니다. 우리 사용량은 심사 기간 전체를 합쳐도 수천 요청 규모로 한도의 0.1% 미만입니다 |
| **바디 상한 여유** | HTTP/1 요청 최대 **32 MiB** — 계약 상한 10MB가 여유 있게 통과합니다 |

### 왜 Cloudflare가 아닌가 (검토 후 기각 — 재논의 방지용 기록)

- **Cloudflare Workers 무료 티어로는 이 서버를 돌릴 수 없습니다.** Workers는 컨테이너를 실행하지 않고, Docker를 돌리는 **Containers는 Workers Paid($5/월) 전용**입니다.
- TypeScript로 전면 재작성해 무료 Workers에 올리는 안도 기각했습니다 — **무료 티어 CPU 한도가 요청당 10ms**(유료 30초)인데, 이미지를 LLM에 보내려면 base64 인코딩이 필요해 계약 상한 10MB는 물론 1MB급에서도 한도를 초과합니다.
- Python Workers(Pyodide)는 **베타 런타임**이라 가동시간이 결격 사유인 대회에 쓰지 않습니다.

### 확인된 제약

| 제약 | 내용 | 대응 |
| --- | --- | --- |
| **결제 계정 등록 필요** | 무료 한도만 쓰더라도 GCP 프로젝트에 결제 계정 연결이 필요 | 한도 내에서는 청구되지 않음. 예산 알림을 걸어 확인 |
| **콜드스타트** | 인스턴스가 0으로 줄면 다음 요청에서 컨테이너 기동(수 초) | 킵얼라이브 5~10분 간격으로 인스턴스를 살려 둠. `min-instances=1`은 **유휴 과금이 발생하므로 쓰지 않음** |
| 요청 바디 | HTTP/1 최대 32 MiB | 계약 상한 10MB — 여유 |
| 요청 타임아웃 | 최대 60분 (기본 5분) | 백엔드 타임아웃(추출 20s·소명서 15s)이 훨씬 짧아 무관 |

**체크리스트**
- [ ] **9월 5일까지** 배포 완료 + 무료 한도 내 동작 확인 (유료 전환 불필요)
- [x] `GET /internal/health` 헬스체크 엔드포인트 구현 (무인증 공개 — 킵얼라이브 목적)
- [ ] 외부 헬스체크 도구에 AI-server URL 등록 (5~10분 간격 — 콜드스타트 방지 겸용)
- [x] `/internal/*` 나머지 경로는 백엔드 외 요청을 거부하도록 인증 구현 (`../02-architecture/internal-api-contract.md`)
- [x] 오프라인 데모 모드용 사전 응답 세트 준비 (`../../ai-server/demo/`, 발표 당일 네트워크 장애 대비)
- [x] 이미지가 LLM 호출 후 즉시 폐기되는지 확인 (디스크 기록 없음)
- [ ] 10MB 요청이 실제로 통과하는지 실측
- [ ] `INTERNAL_TOKEN`·LLM API 키를 **Secret Manager**로 등록 (저장소에 커밋하지 않음)
- [ ] 예산 알림 설정 (무료 한도를 넘기면 알림이 오도록)

> 배포 절차와 명령어는 `../../ai-server/docs/deployment.md`에 있습니다.

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

**유료 전환 판단 근거**: 대회 규칙상 URL 미접근은 결격 사유입니다. 백엔드 Render Starter $7/월은 **스핀다운 중 실제로 접속이 불가능**하기 때문에 협상 대상이 아닙니다. 반면 AI-server는 Cloud Run으로 옮기며 접속 불가 구간 없이 $0이 되었습니다 — 판단 기준은 "무료냐 유료냐"가 아니라 **"접속 불가 구간이 생기느냐"** 입니다.

## 전체 체크리스트 (심사 기간 대비)

- [ ] (프론트) 9/5까지 정적 호스팅 배포 완료
- [ ] (백엔드) 9/5까지 Render Starter 전환, CORS 설정, 킵얼라이브 워크플로 등록
- [ ] (AI) 9/5까지 **Cloud Run 배포 완료**, 헬스체크 공개, 외부 모니터링 등록
- [ ] (전원) 오프라인 데모 모드(`DEMO_MODE=true`) 동작 확인 — 발표 당일 네트워크 장애 대비
- [ ] (전원) 9/6 밤: 3개 서비스 전체 플로우 3회 완주 확인
- [ ] (전원) 9/7~9/11 매일 아침 3개 URL(프론트 진입점, 백엔드 헬스체크, AI-server 헬스체크) 확인 로테이션
