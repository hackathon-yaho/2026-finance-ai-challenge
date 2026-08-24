# Phase 6 — 운영 · 인프라 · 발표 방어

> 목표: 심사 기간(2026.9.7 11:00 ~ 9.11 23:59) 동안 서비스가 죽지 않고, 발표 당일 네트워크가 끊겨도 데모가 완주된다.
>
> 근거: `../../docs/03-infra-ops/deployment-and-uptime.md`, `../../docs/00-context/spec.md` F11-02~04, `../../docs/04-testing/test-cases-and-demo.md`

## 6-1. 데모 모드 (F11-03) — 발표 방어

**발표는 오프라인이고 현장 네트워크는 통제할 수 없다.** LLM API 장애든 네트워크 장애든 전체 플로우가 완주돼야 한다.

- [ ] 환경변수 `DEMO_MODE=true`로 활성화
- [ ] `AiClient`가 **AI-server를 호출하지 않고** `src/main/resources/demo/`의 고정 JSON을 반환 (결정 로그 — 네트워크 경로 자체를 타지 않는다)
- [ ] 사전 저장 판독 결과 **6종** + 소명서 응답
- [ ] **`/api/session` 응답의 `demoMode` 필드**로 프론트에 알린다 (2026-08-23 계약 추가). 프론트가 "예시 데이터 사용 중 — 실제 AI 분석 결과가 아닙니다" 배지를 전 화면 상단에 고정한다
- [ ] **금지: 실제 사용자 업로드 파일과 데모 데이터를 화면 표시 없이 섞지 않는다** (F11-03)
- [ ] `QUOTA_EXCEEDED` 발생 시에도 데모 모드로 폴백 (F4-05)

> ⚠️ **미확정 — 응답 세트 JSON.** AI 담당이 만든 실제 판독 결과 파일이 필요하다. 요청: `../../docs/request/ai/demo-response-set.md`
>
> 개발 시점 주의: **마지막 날이 아니라 완성도 작업 때 함께 만든다** (F11-03).

## 6-2. 익명 통계 적재 (F11-02)

`../../docs/02-architecture/data-model.md`의 `session_stat`, `stage_event` 테이블.

- [ ] 세션 종료(또는 파기) 시 `session_stat` 적재 — Phase 2에서 남겨둔 훅에 연결
- [ ] 적재 항목: 세션 해시, 도달 단계, 사유 유형, 준비도 결과, 증거 개수, 완료 여부

### `stage_event` 수집 방식 (2026-08-23 확정)

`enter / complete / abandon`을 받을 엔드포인트가 계약에 없으므로, **백엔드가 기존 API 호출 시점으로 자동 적재한다.** 계약 변경도 프론트 작업도 없다.

| 호출 | 적재 |
| --- | --- |
| `POST /api/intake` | stage 1 `complete` |
| `POST /api/evidence` (최초) | stage 2 `complete` |
| `POST /api/readiness` | stage 3 `complete` |
| `POST /api/draft` | stage 4 `complete` |
| `POST /api/package/text` | stage 5 `complete` |
| 직전 단계 `complete` | 다음 단계 `enter`로 간주 |
| TTL 만료 | 마지막 도달 단계 `abandon` |

- [ ] 위 매핑대로 구현
- [ ] **`enter` 시각은 근사치다.** 사용자가 화면에 도달한 시각이 아니라 직전 단계를 완료한 시각이다. 이탈 지점 파악에는 충분하지만 체류 시간 분석에는 쓸 수 없다 — 이 한계를 알고 해석한다
- [ ] **미적재: 이미지, 추출 텍스트, 소명서 본문, 문진 원본 응답**
- [ ] 수용 기준: DB를 조회해도 개인 식별이 불가능하다
- [ ] 통계 적재가 실패해도 **서비스는 계속 동작한다** (`spec.md` §6 외부 연동 명세)

## 6-3. 오류 로깅 (F11-04 / NFR-08)

- [ ] 기록: 세션 해시, 엔드포인트, 오류 유형, 타임스탬프
- [ ] **금지: 이미지 내용, 추출 텍스트, 소명서 본문, 파일명**
- [ ] 이미지 내 지시문(프롬프트 인젝션) 감지 시 **발생 카운트만** 남기고 문구 자체는 기록하지 않는다 (`prd.md` §10.3)
- [ ] 전체 로그를 훑어 개인정보가 새는 지점이 없는지 직접 확인한다 (`privacy-and-safety.md` 체크리스트)

> Supabase 무료 티어 로그 보존은 1일이다. 중요 로그는 애플리케이션 레벨에서 관리한다 (F11-04).

## 6-4. 킵얼라이브 워크플로

`../../docs/03-infra-ops/deployment-and-uptime.md` §4 — **백엔드 담당이 이 파일을 등록한다.**

- [ ] `.github/workflows/keepalive.yml` 작성 (문서의 YAML 그대로)
  - Supabase REST ping / 백엔드 `/actuator/health` / AI-server `/internal/health`
  - cron `0 0 * * 0,3` (UTC 기준 일·수 00:00 = KST 09:00)
- [ ] GitHub Secrets 등록: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BACKEND_URL`, `AI_SERVER_URL`
- [ ] **`AI_SERVER_URL` 값을 AI 담당자에게 요청**한다
- [ ] 외부 크론(cron-job.org 등) 10분 주기 등록 — Render 스핀다운 방지 (F11-01)

> 목적이 두 개다. Render는 **15분** 무요청 시 스핀다운(재기동 약 1분), Supabase는 **7일** 무활동 시 일시정지. `/actuator/health`가 DB에 쓰기 때문에 한 번의 핑이 둘 다 막는다.

## 6-5. 배포 (Render + Supabase) — 이 Phase에 몰아서 한다

> **2026-08-23 팀 결정**: 배포는 Phase 1이 아니라 **로컬 테스트가 전부 끝난 뒤 여기서 한 번에** 진행한다. Phase 1~5는 docker-compose Postgres로 로컬에서만 돌린다.
>
> 대신 `../../docs/03-infra-ops/deployment-and-uptime.md` 서두의 경고를 기억한다 — 제출 URL이 **2026.9.7 11:00 ~ 9.11 23:59 접근 불가면 대회 결격**이다. 배포를 뒤로 미룬 만큼, 이 절을 심사 기간에 바짝 붙이지 않는다.

### Supabase

- [ ] Supabase 프로젝트 생성
- [ ] Phase 1에서 만든 `migration.sql`을 그대로 적용 (`session_stat`, `stage_event`, `keepalive` + 인덱스 2개)
- [ ] 연결 문자열을 Render 환경변수로 등록

### Render

- [ ] Web Service 생성, main 브랜치 자동 배포 연동
- [ ] 환경변수 등록: DB 3종, `CORS_ALLOWED_ORIGINS`, `AI_SERVER_URL`, `INTERNAL_TOKEN`, `DEMO_MODE`
- [ ] 배포 URL의 `/actuator/health`가 200 + `{"status":"UP","db":"OK"}`를 반환하는지 확인
- [ ] 한글 폰트가 컨테이너에 실제로 들어갔는지 확인 (PDF 생성 시 한글 깨짐 방지 — Phase 1에서 리소스에 포함)
- [ ] **Starter 플랜 전환** ($7/월, 스핀다운 제거). `deployment-and-uptime.md`: "스핀다운은 대회 결격 사유와 직결되어 **협상 대상이 아니다**"
- [ ] CORS 허용 origin에 프론트 **실제 배포 도메인**이 들어갔는지 최종 확인
- [ ] 배포 후 전체 플로우를 한 번 완주해 로컬과 동작이 같은지 확인 (휘발성 파일시스템·메모리 제약이 로컬과 다르다)

## 6-6. 심사 기간 운영

- [ ] 전체 플로우 3회 완주 확인 (3개 서비스 연결 상태)
- [ ] 네트워크 차단 상태에서 데모 모드 리허설 1회
- [ ] 심사 기간 매일 아침 백엔드 헬스체크 URL 확인 (로테이션 참여)

## 완료 기준

- `DEMO_MODE=true`로 켠 상태에서 네트워크를 끊어도 전체 플로우가 완주된다
- 세션 종료 후 `session_stat`에 행이 쌓이고, 그 행으로 개인 식별이 불가능하다
- 로그 어디에도 이미지 내용·추출 텍스트·소명서 본문이 없다
- 킵얼라이브 실행 후 `keepalive` 테이블 행이 증가한다
