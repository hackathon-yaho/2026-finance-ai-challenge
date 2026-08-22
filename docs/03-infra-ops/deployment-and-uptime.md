# 배포 및 가동시간 리스크 대응

> 출처: `../00-context/prd.md` §8. **이 문서는 대회 결격 여부와 직결됩니다.** 제출된 웹서비스 URL은 2026.9.7 11:00 ~ 9.11 23:59 동안 접근 가능해야 하며, 접근 불가 시 결격 사유에 해당합니다.
>
> **개정 (2026-08-22 이후)**: 프론트엔드·백엔드·AI-server가 독립적으로 배포되는 3개 서비스로 분리되었습니다. **각 서비스는 그 서비스를 만든 담당자가 직접 배포하고 가동 상태를 책임집니다.** 아래는 서비스별로 정리했습니다.

## 한눈에 보기

| 서비스 | 담당 | 권장 호스팅 | 비용 | 스핀다운 리스크 |
| --- | --- | --- | --- | --- |
| 프론트엔드 | 프론트 | Vercel / Netlify / Cloudflare Pages | $0 | 없음 (정적 파일) |
| 백엔드 | 백엔드 | Render Web Service (Starter) | $7/월 | 있음 → Starter로 제거 |
| AI-server | AI | Render Web Service (Starter) | $7/월 | 있음 → Starter로 제거 |
| Supabase (백엔드 전용) | 백엔드 | Supabase 무료 플랜 + 킵얼라이브 | $0 | 7일 비활성 시 일시정지 |

총 예상 비용: **월 $14**. 비용을 아끼려고 백엔드나 AI-server를 무료 티어로 남기지 않습니다 — 스핀다운은 대회 결격 사유와 직결되어 협상 대상이 아닙니다.

---

## 1. 프론트엔드 — 정적 호스팅 (담당: 프론트)

정적 SPA는 Render Web Service보다 Vercel/Netlify/Cloudflare Pages 같은 정적 호스팅이 낫습니다. 스핀다운 개념이 없고 무료 티어로 충분합니다.

**체크리스트**
- [ ] Vercel/Netlify 등에 배포 (자동 배포 연동 권장 — main 브랜치 push 시 자동 배포)
- [ ] 백엔드 API 엔드포인트 URL을 환경변수로 관리 (하드코딩 금지 — 배포 환경마다 바뀔 수 있음)
- [ ] 백엔드와 CORS 협의 완료 (허용 origin에 프론트 배포 도메인 등록 요청)
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
- [ ] CORS 설정 — 프론트엔드 배포 도메인을 허용 origin에 등록
- [ ] `GET /actuator/health` 헬스체크 엔드포인트 구현 (킵얼라이브용)
- [ ] Supabase 킵얼라이브 워크플로 등록 (아래 참조)
- [ ] AI-server 내부 API 호출 타임아웃·재시도 설정 (`../02-architecture/internal-api-contract.md`)

## 3. AI-server — Render (담당: AI 개발자)

백엔드와 동일한 Render 제약이 적용됩니다. AI-server는 LLM 호출 자체가 지연에 민감하므로, 스핀다운으로 인한 콜드스타트가 특히 치명적입니다(LLM 응답 수 초 + 스핀업 1분 = 사용자 체감 지연 심각).

**체크리스트**
- [ ] **9월 5일까지** Render Starter 플랜 전환 ($7/월)
- [ ] `GET /internal/health` 헬스체크 엔드포인트 구현, 외부에서 접근 가능하도록 공개 (킵얼라이브 목적)
- [ ] UptimeRobot 등 외부 헬스체크 도구에 AI-server URL 등록 (5~10분 간격)
- [ ] `/internal/*` 나머지 경로는 백엔드 외 요청을 거부하도록 인증 구현 (`../02-architecture/internal-api-contract.md`)
- [ ] 오프라인 데모 모드용 사전 응답 세트 준비 (발표 당일 네트워크 장애 대비)

## 4. Supabase — 백엔드 전용 (담당: 백엔드)

AI-server는 Supabase에 접근하지 않습니다. 통계 저장은 백엔드만 수행합니다.

| 제약 | 내용 |
| --- | --- |
| **7일 비활성 일시정지** | 무료 플랜은 7일간 DB 활동이 없으면 일시정지, 수동 복구 전까지 접근 불가 |
| DB 용량 | 프로젝트당 500MB (여유) |
| 백업 | 없음 — 스키마를 코드로 관리 (`../02-architecture/data-model.md`) |

### 킵얼라이브 워크플로 (백엔드가 등록)

> PRD 원문의 YAML 들여쓰기가 깨져 있어 실행 가능한 형태로 고쳤습니다. GitHub Actions는 **UTC로 실행**되므로 KST 대비 9시간 차이를 주석으로 표시했습니다.

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

**$7×2 판단 근거**: 대회 규칙상 URL 미접근은 결격 사유입니다. 서비스가 3개로 분리되며 총 비용이 $14/월이 되었지만, 16일간 개발한 결과물이 콜드스타트 지연 때문에 무효화되는 위험 대비 여전히 명백히 합리적입니다. 이 항목은 협상 대상이 아닙니다.

## 전체 체크리스트 (심사 기간 대비)

- [ ] (프론트) 9/5까지 정적 호스팅 배포 완료
- [ ] (백엔드) 9/5까지 Render Starter 전환, CORS 설정, 킵얼라이브 워크플로 등록
- [ ] (AI) 9/5까지 Render Starter 전환, 헬스체크 공개, 외부 모니터링 등록
- [ ] (전원) 9/6 밤: 3개 서비스 전체 플로우 3회 완주 확인
- [ ] (전원) 9/7~9/11 매일 아침 3개 URL(프론트 진입점, 백엔드 헬스체크, AI-server 헬스체크) 확인 로테이션
