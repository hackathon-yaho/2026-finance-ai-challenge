# Phase 1 — 프로젝트 골격 · 로컬 구동 · 헬스체크

> 목표: **로컬에서 애플리케이션이 뜨고 DB에 붙어 있는 상태**를 만든다. 기능은 아직 없어도 된다.
>
> 근거: `../../docs/05-planning/roadmap.md` 1행(스켈레톤), `../../docs/02-architecture/data-model.md`

> **배포는 이 Phase에서 하지 않는다** (2026-08-23 팀 결정). Render 배포·환경변수 등록·Starter 전환은 **로컬 테스트가 전부 끝난 뒤 Phase 6에서 한 번에** 진행한다.
>
> 다만 `../../docs/03-infra-ops/deployment-and-uptime.md` 서두가 경고하듯, 제출 URL이 2026.9.7 11:00 ~ 9.11 23:59 동안 접근 불가하면 **대회 결격**이다. 배포를 뒤로 미루는 만큼 Phase 6를 심사 기간에 바짝 붙이지 않도록 여유를 둔다.

## 1-1. 프로젝트 생성

- [ ] Spring Boot 3.x / Java 21 / Gradle(Groovy `build.gradle`) 프로젝트를 `backend/`에 생성 — 빌드 스크립트 형식은 `good-question` 프로젝트와 맞춘다
- [ ] 베이스 패키지 `com.haebing.backend`
- [ ] 의존성: `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-validation`, `postgresql`, Lombok
- [ ] `.gitignore`에 빌드 산출물(`build/`, `.gradle/`) 추가 — 루트 `.gitignore`는 이미 `.env*`를 막고 있으므로 시크릿은 커밋되지 않는다

패키지 구조는 [README](README.md#패키지-구조-규칙)의 규칙(`good-question` 프로젝트와 동일)을 따른다. **각 Phase에서 필요해질 때 만든다 — 빈 디렉터리를 미리 만들지 않는다.**

Phase 1에서 만드는 것은 다음뿐이다.

```
com.haebing.backend
├── HaebingApplication.java
├── health/controller/  health/service/
└── common/global/      ErrorCode.java
                        dto/ErrorResponse.java
                        exception/BusinessException.java
                        handler/GlobalExceptionHandler.java
```

`ErrorCode`에는 `../../docs/02-architecture/api-contract.md` 오류표의 4종을 미리 정의해 둔다 — `EXTRACTION_FAILED`, `TIMEOUT`, `SESSION_EXPIRED`(410), `QUOTA_EXCEEDED`. 응답 형태는 계약 문서 그대로 `{ error, message, fallback }`이며, `fallback`에는 **내부 경로를 노출하지 않고** 공개 경로(`/api/evidence/text`)를 담는다(`internal-api-contract.md` 오류 절).

## 1-1b. docker-compose (로컬 인프라)

- [ ] `backend/docker-compose.yml` 작성 — Postgres 16, 볼륨, `pg_isready` 헬스체크 (`good-question` 프로젝트의 compose와 동일 형태)
- [ ] 로컬은 compose Postgres, 배포는 Supabase를 바라보도록 프로파일/환경변수 분리
- [ ] Redis는 넣지 않는다 (세션은 인메모리가 스펙)

## 1-2. DB 스키마

`../../docs/02-architecture/data-model.md`의 SQL을 **그대로** 옮긴다. 백업이 없으므로 스키마를 코드로 관리한다(같은 문서 체크리스트).

- [ ] **마이그레이션 스크립트** `src/main/resources/db/migration.sql`에 `session_stat`, `stage_event`, `keepalive` 3테이블 + 인덱스 2개 작성
- [ ] **로컬 compose Postgres에 적용**하고 애플리케이션이 붙는지 확인
- [ ] `spring.datasource.*`를 환경변수로 주입한다. **하드코딩 금지** — 로컬은 compose 값, 배포는 Supabase 값이 들어간다
- [ ] **Supabase 프로젝트에 적용하는 것은 Phase 6**다. 같은 PostgreSQL이므로 스크립트는 그대로 쓴다

> 이 3테이블 외에 어떤 테이블도 만들지 않는다. 개인 식별 가능 정보는 어느 테이블에도 저장하지 않는다 — `data-model.md` 서두.

## 1-3. 헬스체크 (F11-01)

`../../docs/00-context/spec.md` F11-01이 구현 코드까지 명시하고 있다. **단순 상태 반환이 아니라 반드시 DB에 쿼리를 날려야 한다** — Render 스핀다운과 Supabase 7일 일시정지를 동시에 막는 것이 목적이기 때문이다.

- [ ] `GET /actuator/health` 구현
  - [ ] `insert into keepalive default values`
  - [ ] `delete from keepalive where pinged_at < now() - interval '7 days'`
  - [ ] 응답 `{"status":"UP","db":"OK"}`
- [ ] 호출 후 `keepalive` 테이블 행이 증가하는지 확인 (F11-01 수용 기준)

> Spring Boot Actuator의 기본 `/actuator/health`와 경로가 겹친다. 기본 엔드포인트를 끄고 직접 매핑하거나, 커스텀 `HealthIndicator`로 DB 쓰기를 넣는다. **어느 쪽이든 "DB에 실제 쓰기가 일어난다"는 조건을 만족해야 한다.**

## 1-4. CORS

- [ ] 허용 origin을 환경변수(`CORS_ALLOWED_ORIGINS`)로 주입
- [ ] 허용 헤더에 **`X-Session-Hash` 포함** (결정 로그 참조 — 이게 빠지면 프론트의 모든 요청이 막힌다)
- [ ] 쿠키를 쓰지 않으므로 `allowCredentials`는 켜지 않는다
- [ ] 프론트 배포 도메인 확정 후 값 등록 — `../../docs/05-planning/role-assignment.md` 교차 검토 표

> **배포 환경 제약을 지금부터 지킨다.** Render는 512MB RAM / 0.1 CPU에 **파일시스템이 휘발성**이다. 배포는 Phase 6로 미루지만, 디스크에 의존하는 코드를 만들면 그때 전부 뜯어야 한다 — 세션도 이미지도 메모리로만 다룬다.

## 1-5. 한글 폰트 (Phase 5 대비)

- [ ] 나눔고딕 ttf를 `src/main/resources/fonts/`에 포함 (또는 Dockerfile을 쓴다면 `fonts-nanum` 설치)

근거: `../../docs/00-context/spec.md` F8-01 개발 주의 — **Render 컨테이너에 한글 폰트가 없으면 PDF가 전부 깨진다.** Phase 5에서 발견하면 늦으므로 골격 단계에서 넣어둔다. (PDF 생성 주체가 프론트로 확정되면 이 항목은 불필요해진다.)

## 완료 기준

- `docker compose up` 후 애플리케이션이 로컬에서 기동한다
- 로컬 `/actuator/health`가 `{"status":"UP","db":"OK"}`를 반환한다
- 호출할 때마다 `keepalive` 테이블 행이 늘어난다
- CORS 설정이 환경변수로 주입되고, 허용 헤더에 `X-Session-Hash`가 들어 있다

## 이 Phase에서 하지 않는 것

- **Render 배포·환경변수 등록·Starter 전환 (전부 Phase 6)**
- 세션·문진·판독 로직 (Phase 2~3)
- 인증·로그인 — **회원가입/로그인은 범위 외**다 (`../../docs/00-context/prd.md` §4.6)
- Redis 등 외부 세션 저장소 도입 (인메모리로 충분, `data-model.md`)
