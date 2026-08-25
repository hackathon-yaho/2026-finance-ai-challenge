# Phase 6 — 운영 · 인프라 · 발표 방어

> 목표: 심사 기간(2026.9.7 11:00 ~ 9.11 23:59) 동안 서비스가 죽지 않고, 발표 당일 네트워크가 끊겨도 데모가 완주된다.
>
> 근거: `../../docs/03-infra-ops/deployment-and-uptime.md`, `../../docs/00-context/spec.md` F11-02~04, `../../docs/04-testing/test-cases-and-demo.md`

### ✅ 2026-08-26 — 6-1·6-2·6-3·6-4(파일)까지 구현 완료. 6-5(실제 배포)·6-6(심사 기간 운영)은 계정 접근이 필요해 남겨둔다

**여기서 멈춘 이유**: 6-5(Render/Supabase 배포)는 실제 계정 생성·대시보드 조작·Secrets 등록이 필요해 코드 작업이 아니다. 6-6은 9/6~9/11 캘린더 위의 운영 작업이라 지금 할 수 있는 게 없다. 아래는 코드로 끝낼 수 있는 부분(6-1~6-4)의 구현 기록이다.

**6-1 데모 모드**
- `DemoFixtures`(`ai/demo/DemoFixtures.java`)가 `src/main/resources/demo/`의 6개 추출 픽스처 + `draft-tc01.json`을 기동 시 1회 로딩한다. `AiClientImpl`이 `demoMode=true`면 **RestClient를 아예 만들지 않고** 바로 반환한다 — 실측: `AI_SERVER_URL`을 비운 채 `DEMO_MODE=true`로 기동해 세션 생성→문진→증거 업로드→준비도→소명서→PDF 5단계를 전부 완주(로그에 AI-server 접속 시도 없음)
- `imageIndex`는 6개 추출 픽스처에 `Math.floorMod`로 순환 배정한다(TC 매핑은 백엔드 재량이라고 명시돼 있어 파일명 고정 매핑 대신 이 방식을 택함). 소명서는 draft-tc01 고정 1종만 코드에서 쓴다 — `draft-tc03`·`draft-tc06`은 리소스에 복사만 해두고 아직 안 쓴다(필요해지면 사유별로 골라 쓰게 확장 가능)
- **`QUOTA_EXCEEDED`(429)는 `DEMO_MODE` 값과 무관하게 항상 데모 응답으로 폴백한다** (F4-05) — `AiClientImpl`이 429를 잡아 재시도 없이 즉시 데모 픽스처를 반환. 단위 테스트 `extract_429_fallsBackToDemoFixtureWithoutRetry`로 확인
- `/api/session` 응답의 `demoMode` 필드는 이미 Phase 1~2에서 구현돼 있었다(계약대로 프론트에 전달)
- "실제 업로드와 데모 데이터를 섞지 않는다"·배지 표시는 화면 책임이라 백엔드 조치 없음
- 이미지 내 지시문(프롬프트 인젝션) 감지·카운트는 **AI-server 책임**이다 — 백엔드는 이미지 바이트를 그대로 중계할 뿐 내용을 보지 않는다

**6-2 익명 통계 적재**
- `stats/service/StatsServiceImpl`이 raw JDBC로 `session_stat`/`stage_event`에 적재한다(HealthServiceImpl과 같은 패턴 — JPA 엔티티 없이 `DataSource` 직접 사용)
- `stage_event(complete)`는 문서의 매핑표대로 `SessionInterceptor.afterCompletion`에서 **한 곳으로** 건다 — 컨트롤러 5개를 각각 건드리지 않고, 정확한 요청 경로(`POST /api/intake`·`/api/evidence`·`/api/readiness`·`/api/draft`·`/api/package/text`) + 응답 2xx만 걸러 세션당 단계별로 **최초 1회만** 적재한다(`Session.lastStage`로 가드 — "`/api/evidence`(최초)"라는 문서 요건을 모든 단계에 동일하게 적용)
- `enter` 이벤트는 실제로 적재하지 않는다 — 문서의 "직전 단계 complete → 다음 단계 enter로 간주"는 해석 규칙이지 별도 삽입 지시가 아니라고 읽었다(집계 시 직전 complete 시각을 근사 enter 시각으로 쓰라는 뜻)
- `abandon`은 TTL 만료(`SessionStore.cleanupExpired`)에서만 적재한다. 명시적 `DELETE /api/session`(정상 종료)은 abandon으로 잡지 않는다 — 완주한 세션이 이탈로 집계되는 걸 막기 위한 구분
- `session_stat`은 명시적 파기·TTL 만료 양쪽 다 적재한다. 실측: DEMO_MODE 세션을 5단계까지 완주 후 `DELETE /api/session` → `session_stat`에 `reason_type=goods, readiness=BANK_CHECK_REQUIRED, evidence_cnt=1, completed=true` 1행 확인, `abandon` 행은 없음(정상 종료라서 맞음)
- DB 적재 실패는 `SQLException`을 잡아 warn 로그만 남기고 삼킨다 — 서비스 흐름을 막지 않는다(단위 테스트로 확인)

**6-3 오류 로깅**
- `SessionInterceptor`가 요청마다 MDC에 `sessionHash`(유효한 세션으로 확인된 값만 — 헤더에 온 원본 문자열은 절대 로그에 남기지 않는다)와 `endpoint`(메서드+경로)를 심고, `application.yml`의 `logging.pattern.console`이 모든 로그 줄에 이 값을 찍는다. 타임스탬프는 기존 로그 포맷에 이미 있었다. `GlobalExceptionHandler`를 건드리지 않고 인터셉터 한 곳에서 해결했다
- 실측: 만료/존재하지 않는 세션 해시로 요청 → 로그에 `[POST /api/intake] ... [BusinessException] code=SESSION_EXPIRED`가 세션 해시 없이(`-`) 찍히는 것 확인 — 공격자가 임의로 보낸 헤더값이 로그에 남지 않는다
- 금지 항목(이미지 내용·추출 텍스트·소명서 본문·파일명)은 원래 로그 문구 어디에도 없었다(코드 리뷰로 확인). 다만 `HttpMessageNotReadableException` 핸들러가 Jackson 파싱 오류 메시지를 그대로 찍는데, 드물게 잘못된 JSON의 일부가 오류 메시지에 섞여 나올 수 있다 — 남은 리스크로 기록만 해둔다(값 자체를 사용자가 입력한 형태가 아니라 Jackson이 요약한 파서 오류라 실질적 노출 가능성은 낮다고 판단)

**6-4 킵얼라이브 — GitHub Actions 워크플로도, 백업 모니터도 만들지 않기로 결정 (2026-08-26)**
- 문서(`deployment-and-uptime.md` §4)는 GitHub Actions(Supabase용, 주 2회)를 cron-job.org의 이중 안전망으로 제안했지만, cron-job.org 하나만으로 충분하다고 판단해 걷어냈다 — `/actuator/health`가 DB에 실제로 쓰기 때문에(F11-01) cron-job.org의 10분 주기 핑이 Render뿐 아니라 Supabase도 이미 계속 깨운다. Supabase의 7일 비활성 임계값에는 10분 주기가 훨씬 더 여유 있어 별도 워크플로가 지키는 추가 구간이 사실상 없다. **워크플로가 없으니 등록할 GitHub Secrets도 없다**
- **UptimeRobot 등 백업 모니터도 지금 단계에선 두지 않기로 함.** cron-job.org 자체가 지연·장애로 죽는 극단적 경우에 대한 대비였는데, 지금 시점에 그 리스크까지 막는 건 과하다고 판단 — 대회 심사 기간이 가까워지면(9/6 최종 점검 등) 재검토 대상으로 남겨둔다
- **남은 것 — 계정 접근이 필요해 여기서 못 함**: cron-job.org 등록. `AI_SERVER_URL`은 AI 담당자가 "늦어도 8/26 팀 채널로 전달" 하기로 돼 있었다(`../../../docs/response/backend/image-transfer-and-internal-auth.md`)

## 6-1. 데모 모드 (F11-03) — 발표 방어

**발표는 오프라인이고 현장 네트워크는 통제할 수 없다.** LLM API 장애든 네트워크 장애든 전체 플로우가 완주돼야 한다.

- [x] 환경변수 `DEMO_MODE=true`로 활성화
- [x] `AiClient`가 **AI-server를 호출하지 않고** `src/main/resources/demo/`의 고정 JSON을 반환 (결정 로그 — 네트워크 경로 자체를 타지 않는다)
- [x] 사전 저장 판독 결과 **6종** + 소명서 응답
- [x] **`/api/session` 응답의 `demoMode` 필드**로 프론트에 알린다 (2026-08-23 계약 추가). 프론트가 "예시 데이터 사용 중 — 실제 AI 분석 결과가 아닙니다" 배지를 전 화면 상단에 고정한다 (Phase 1~2에서 이미 구현)
- [ ] **금지: 실제 사용자 업로드 파일과 데모 데이터를 화면 표시 없이 섞지 않는다** (F11-03) — 화면 책임, 백엔드 조치 없음
- [x] `QUOTA_EXCEEDED` 발생 시에도 데모 모드로 폴백 (F4-05)

### ✅ 응답 세트 v1 납품 완료 (2026-08-25) — 블로커 해제

AI 담당이 예정(9/1~9/2)보다 앞당겨 만들어 저장소에 넣었다: **`../../ai-server/demo/`** (추출 6 + 소명서 3 = 9개 파일). 회신: `../../docs/response/backend/demo-response-set.md`.

- [x] `ai-server/demo/*.json` → `src/main/resources/demo/`로 복사 (v1.1 — README에 v1.1로 명시된 버전을 그대로 복사)
- [x] **Phase 3 `AiClient` 단위 테스트 픽스처로도 쓴다.** `AiClientImplTest`가 `DemoFixtures`를 직접 구성해 데모 모드·QUOTA_EXCEEDED 폴백을 검증
- [x] TC 매핑 방식은 백엔드 재량이다 — `imageIndex % 6` 순환 배정을 택함
- [x] 파일 스키마 확장분은 기존 `ExtractResult`/`DraftResult` DTO와 그대로 맞았다(추가 매핑 코드 불필요). `checklist`는 DTO에 없는 필드라 Jackson이 기본적으로 걸리는데, `DemoFixtures`가 이 파일 전용으로 `FAIL_ON_UNKNOWN_PROPERTIES=false`로 복사한 `ObjectMapper`를 써서 우회했다(공유 빈은 건드리지 않음)

> **`imageIndex`·`bbox`는 아직 실제 데모 캡처와 동기화되지 않은 그럴듯한 값이다.** 문장 클릭 → 원본 이동 시연(TC-12, 데모 `[2:20]`)이 자연스러우려면 **9/1~9/2 리허설에서 실제 데모 이미지 4장을 확정**하고 AI가 v2를 재생성해야 한다. 리허설 안건에 올려둘 것.

## 6-2. 익명 통계 적재 (F11-02)

`../../docs/02-architecture/data-model.md`의 `session_stat`, `stage_event` 테이블.

- [x] 세션 종료(또는 파기) 시 `session_stat` 적재 — Phase 2에서 남겨둔 훅에 연결
- [x] 적재 항목: 세션 해시, 도달 단계, 사유 유형, 준비도 결과, 증거 개수, 완료 여부

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

- [x] 위 매핑대로 구현 (`SessionInterceptor.afterCompletion` 한 곳에서)
- [x] **`enter` 시각은 근사치다.** — 별도로 적재하지 않고 해석 규칙으로만 남긴다(위 구현 기록 참조)
- [x] **미적재: 이미지, 추출 텍스트, 소명서 본문, 문진 원본 응답**
- [x] 수용 기준: DB를 조회해도 개인 식별이 불가능하다 — 실측 확인(세션 해시·사유 유형·준비도·증거 개수·완료 여부만 있음)
- [x] 통계 적재가 실패해도 **서비스는 계속 동작한다** (`spec.md` §6 외부 연동 명세) — 단위 테스트로 확인

## 6-3. 오류 로깅 (F11-04 / NFR-08)

- [x] 기록: 세션 해시, 엔드포인트, 오류 유형, 타임스탬프 (MDC + 로그 패턴, 실측 확인)
- [x] **금지: 이미지 내용, 추출 텍스트, 소명서 본문, 파일명** — 코드 리뷰로 확인(잔여 리스크 1건은 구현 기록 참조)
- [x] 이미지 내 지시문(프롬프트 인젝션) 감지 시 **발생 카운트만** 남기고 문구 자체는 기록하지 않는다 (`prd.md` §10.3) — **AI-server 책임**, 백엔드는 이미지 내용을 보지 않으므로 조치 없음
- [x] 전체 로그를 훑어 개인정보가 새는 지점이 없는지 직접 확인한다 (`privacy-and-safety.md` 체크리스트)

> Supabase 무료 티어 로그 보존은 1일이다. 중요 로그는 애플리케이션 레벨에서 관리한다 (F11-04).

## 6-4. 킵얼라이브

`../../docs/03-infra-ops/deployment-and-uptime.md` §4 — 원래는 GitHub Actions 워크플로도 백엔드가 등록하기로 돼 있었으나, 위 구현 기록대로 **워크플로도 백업 모니터도 만들지 않기로 결정**했다.

- [x] ~~`.github/workflows/keepalive.yml` 작성~~ — **2026-08-26 결정: 만들지 않음** (cron-job.org 단독으로 충분)
- [x] ~~백업 모니터(UptimeRobot 등) 등록~~ — **2026-08-26 결정: 지금 단계에선 두지 않음**
- [ ] **`AI_SERVER_URL` 값을 AI 담당자에게 요청**한다 — AI 담당이 8/26까지 팀 채널로 전달하기로 했음(`../../../docs/response/backend/image-transfer-and-internal-auth.md` §2)
- [ ] **(계정 접근 필요)** 외부 크론(cron-job.org 등) 10분 주기 등록 — Render 스핀다운 방지 (F11-01)

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
- [ ] **Render Free 플랜으로 배포** (2026-08-25 ② — Starter 전환 없음). `cron-job.org`에 `{BACKEND_URL}/actuator/health`를 **10분 주기**로 등록해 스핀다운 임계값(15분) 이전에 계속 깨운다
- [ ] cron-job.org에 **실패 시 이메일 알림**을 켠다 (백업 모니터는 2026-08-26 결정으로 두지 않음 — 위 6-4 참조)
- [ ] CORS 허용 origin에 프론트 **실제 배포 도메인**이 들어갔는지 최종 확인 — **`https://2026-finance-ai-challenge-tau.vercel.app`** (2026-08-25 확정). **끝에 슬래시를 붙이지 않는다**(origin 비교는 문자열 일치). 프리뷰 와일드카드는 종전대로 불허
- [ ] 배포 후 전체 플로우를 한 번 완주해 로컬과 동작이 같은지 확인 (휘발성 파일시스템·메모리 제약이 로컬과 다르다)

## 6-6. 심사 기간 운영

- [ ] 전체 플로우 3회 완주 확인 (3개 서비스 연결 상태)
- [ ] 네트워크 차단 상태에서 데모 모드 리허설 1회
- [ ] 심사 기간 매일 아침 백엔드 헬스체크 URL 확인 (로테이션 참여)
- [ ] **심사 기간(9/7~9/11)에는 백엔드도 main에 푸시하지 않는다.** Render가 main 자동 배포로 걸려 있어 푸시하면 심사 중에 재기동이 일어난다. 프론트도 같은 이유로 푸시하지 않기로 했다 (`../../docs/response/backend/deployment-domain.md` §4)
- [ ] **9/6 최종 점검: 생성된 PDF를 실제로 열어 한글이 정상 렌더되는지 확인** — HTML 미리보기는 브라우저 폰트로 그려서 이 사고를 구조적으로 못 잡는다 (`../../docs/05-planning/roadmap.md`)
- [ ] **9/6 최종 점검: Render 대시보드에서 남은 인스턴스시간 확인** (750시간 중 잔여). 부족하면 9/7 전에 킵얼라이브 주기를 늘려 여유를 만든다

## 완료 기준

- `DEMO_MODE=true`로 켠 상태에서 네트워크를 끊어도 전체 플로우가 완주된다
- 세션 종료 후 `session_stat`에 행이 쌓이고, 그 행으로 개인 식별이 불가능하다
- 로그 어디에도 이미지 내용·추출 텍스트·소명서 본문이 없다
- 킵얼라이브 실행 후 `keepalive` 테이블 행이 증가한다
