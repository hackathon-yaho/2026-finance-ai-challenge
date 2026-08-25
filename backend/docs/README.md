# 백엔드 작업 문서

> 해빙(解氷) 백엔드 서비스의 실행 계획 문서입니다. **여기 적힌 모든 항목은 루트 `docs/`의 스펙 문서에 근거가 있으며, 근거 없는 항목은 "미확정"으로 표시했습니다.**

## 이 문서를 쓰는 법

1. 작업을 시작할 때 이 파일에서 현재 Phase를 확인한다.
2. 해당 Phase 문서를 열고 체크리스트를 위에서부터 처리한다.
3. 각 항목에는 **근거 문서 위치**가 붙어 있다. 구현 중 판단이 필요하면 추론하지 말고 근거 문서를 연다.
4. 근거 문서와 다르게 구현해야 할 상황이 생기면 **근거 문서를 먼저 고치고**(문서 상단에 수정 기록) 코드를 바꾼다 — `../../docs/05-planning/role-assignment.md` "매몰 방지 원칙".
5. **API를 하나 완료하거나 수정하면 [api-spec.md](api-spec.md)를 같이 고친다** (아래 규칙).
6. **루트 `../../docs/`를 고쳤으면 이 폴더에 반영할 것이 있는지 확인한다** (아래 "역방향 규칙").

## API 작업 규칙 — `api-spec.md`를 항상 최신으로

[api-spec.md](api-spec.md)는 **프론트엔드 개발자가 보고 바로 붙이는 명세서**다. 코드만 바뀌고 이 문서가 그대로면 프론트는 그 변경을 알 방법이 없다.

> **API를 하나 완료하거나 수정할 때마다 `api-spec.md`를 같이 고친다.** 커밋 하나에 코드와 문서가 같이 들어간다.

고칠 때 세 곳을 함께 본다.

1. **해당 엔드포인트 절** — 요청·응답 필드 표, 예시, 상태 코드, 프론트가 처리해야 할 것
2. **상단 "구현 현황" 표** — `미구현` → `구현 완료` (계약이 바뀌었으면 `구현 완료 (YYYY-MM-DD 개정)`)
3. **부록 변경 이력** — 한 줄 추가

### 계약 문서와의 관계 (헷갈리지 말 것)

| 문서 | 성격 | 고치는 시점 |
| --- | --- | --- |
| `../../docs/02-architecture/api-contract.md` | **계약** — 프론트와 합의한 내용 | 상대 역할과 **합의 후**, 구현 **전** |
| `api-spec.md` | **구현 명세** — 실제로 동작하는 것 | **구현할 때** |

**두 문서가 다르면 `api-contract.md`가 우선이다.** 계약이 먼저 바뀌고 구현이 따라온다. `api-spec.md`에서 계약에 없는 값을 새로 정하지 않는다 — 정해야 하면 계약을 먼저 고치고, 프론트에 영향이 있으면 `../../docs/request/frontend/`로 요청을 보낸다.

> **결정 근거는 여기에 적지 않는다.** "왜 그렇게 정했는지"는 `../../docs/request/*` ↔ `../../docs/response/*` 왕복 문서에 이미 남는다. 아래 결정 로그는 그 결론과 근거 문서 위치만 가리킨다.

## 공용 문서가 바뀌면 이 폴더를 확인한다 (역방향 규칙)

위 규칙이 **"코드 → 문서"** 방향이라면, 이건 **"공용 문서 → 백엔드 문서"** 방향이다. 둘 다 없으면 한쪽이 조용히 낡는다.

> **루트 `../../docs/`의 스펙·계약 문서를 고쳤으면, 같은 작업 안에서 이 폴더의 해당 Phase 문서를 열어 반영할 것이 있는지 확인한다.** 없으면 없는 대로 넘어가되, **확인은 건너뛰지 않는다.**

실제로 2026-08-25에 이 규칙이 없어서 백엔드 문서 6개가 하루치 변경분만큼 낡았다. Phase 5 체크리스트가 Phase 4와 다른 구조를 전제하게 되어, 그대로 구현했으면 **Stage 3과 Stage 4에서 서로 다른 체크리스트**가 나올 뻔했다.

### 어느 문서를 고치면 어디를 봐야 하나

| 루트 문서 | 확인할 백엔드 문서 |
| --- | --- |
| `spec.md` F1·F2 (세션·문진) | `phase-2-session-intake.md` |
| `spec.md` F3·F4·F5 (업로드·판독·타임라인) | `phase-3-evidence-timeline.md` |
| `spec.md` F6 (준비도) | `phase-4-readiness.md` |
| `spec.md` F7·F8 (소명서·PDF) | `phase-5-draft-package.md` |
| `spec.md` F11 (데모·통계·로깅) | `phase-6-infra-ops.md` |
| `01-product/reason-type-rules.md` | `phase-4` (준비도 규칙) + `phase-5` (체크리스트) |
| `02-architecture/api-contract.md` | **`api-spec.md`** + 해당 엔드포인트의 Phase 문서 |
| `02-architecture/data-model.md` | `phase-1` (스키마) · `phase-2` (세션 구조) |
| `02-architecture/internal-api-contract.md` | `phase-3` (AiClient) · `phase-5` (draft 호출) |
| `03-infra-ops/privacy-and-safety.md` | `phase-3` (이미지 폐기) · `phase-6` (로깅) |
| `03-infra-ops/deployment-and-uptime.md` | `phase-1` (골격 설정) · `phase-6` (배포) |
| `04-testing/test-cases-and-demo.md` | `phase-4` 완료 기준 (TC 표) |
| 새 결정·확정 사항 | **이 파일의 결정 로그** (근거 문서 위치까지) |

### 회신 대기 항목은 Phase 문서에도 표시한다

요청을 보내놓고 회신을 기다리는 동안, **그 항목이 막는 Phase 문서에 `⚠️ 회신 대기` 표시를 남긴다.** 표시가 없으면 구현할 때 그냥 지금 규칙대로 짜고 넘어가게 된다 — 나중에 회신이 와도 이미 짠 코드를 다시 뜯어야 한다.

## 문서 목록

| 문서 | 내용 | 언제 보나 |
| --- | --- | --- |
| 이 파일 | 작업 규칙, 스택·패키지 구조, 추적 매트릭스, 절대 원칙, 결정 로그 | 작업 시작할 때 |
| [api-spec.md](api-spec.md) | **프론트엔드용 API 명세서** (구현 현황 포함) | **API를 완료·수정할 때마다 갱신** |
| `phase-1~6-*.md` | Phase별 실행 체크리스트 | 다음에 뭘 할지 정할 때 |

## Phase 목록

| Phase | 문서 | 내용 |
| --- | --- | --- |
| 1 | [phase-1-skeleton.md](phase-1-skeleton.md) | 프로젝트 골격, docker-compose 로컬 구동, DB 스키마, 헬스체크, CORS |
| 2 | [phase-2-session-intake.md](phase-2-session-intake.md) | 세션 저장소·TTL, `/api/session`, `/api/intake`, 기한 계산(FR-014) |
| 3 | [phase-3-evidence-timeline.md](phase-3-evidence-timeline.md) | `/api/evidence` 오케스트레이션, AiClient, 카드 확인, 타임라인 조립 |
| 4 | [phase-4-readiness.md](phase-4-readiness.md) | ReadinessService(결정적 규칙 엔진), 체크리스트, 고정 안내 문구 |
| 5 | [phase-5-draft-package.md](phase-5-draft-package.md) | `/api/draft`, 사실검증 재시도, 제출 패키지 PDF |
| 6 | [phase-6-infra-ops.md](phase-6-infra-ops.md) | DEMO_MODE, 익명 통계, 로깅, **배포(Render·Supabase)**, 킵얼라이브, Starter 전환 |

**배포는 Phase 6에 몰려 있다** (2026-08-23 팀 결정). Phase 1~5는 docker-compose Postgres로 로컬에서만 돌리고, Render·Supabase 연결은 로컬 테스트가 전부 끝난 뒤 한 번에 한다.

Phase 순서는 의존 관계 순서다. Phase 3은 Phase 2의 세션이, Phase 4는 Phase 3의 확인된 카드가, Phase 5는 Phase 4의 준비도 결과가 있어야 동작한다.

일정이 밀릴 때 버리는 순서는 `../../docs/00-context/spec.md` 부록(스코프 컷 순서)을 단일 기준으로 삼는다. 백엔드가 임의로 순서를 바꾸지 않는다.

## 스택

| 항목 | 값 | 근거 |
| --- | --- | --- |
| 언어 | Java 21 | 팀 결정 (2026-08-23) — 스펙 문서의 Java 17 표기를 함께 개정함 |
| 프레임워크 | Spring Boot 3.x | `../../docs/00-context/prd.md` §6 |
| 빌드 | Gradle (Groovy `build.gradle`) | 팀 결정 (2026-08-23) — `good-question` 프로젝트와 동일 형식 |
| 베이스 패키지 | `com.haebing.backend` | 팀 결정 (2026-08-23) |
| 패키지 구조 | `good-question` 프로젝트 규칙을 따름 (아래) | 팀 결정 (2026-08-23) |
| 로컬 인프라 | docker-compose (Postgres 16) | 팀 결정 (2026-08-23) |
| DB | Supabase PostgreSQL (익명 통계 전용) | `../../docs/02-architecture/data-model.md` |
| 배포 | Render Web Service | `../../docs/03-infra-ops/deployment-and-uptime.md` |

### 패키지 구조 규칙

`C:/workspaces/good-question/backend/src/main/java/com/goodquestion/backend` 의 구조를 그대로 따른다 — **도메인별 최상위 패키지 + 도메인 안에 계층**.

```
com.haebing.backend
├── session/       ← 도메인
│   ├── controller/
│   ├── dto/request/  dto/response/
│   ├── entity/       (영속 대상이 있을 때만)
│   ├── enums/
│   ├── repository/   (영속 대상이 있을 때만)
│   └── service/      Xxx.java (interface) + XxxImpl.java
├── intake/
├── evidence/
├── timeline/
├── readiness/
├── draft/
├── ai/            ← AI-server 호출 클라이언트
├── health/
├── stat/
└── common/
    ├── enums/
    └── global/    ErrorCode.java, dto/ErrorResponse.java,
                   exception/BusinessException.java, handler/GlobalExceptionHandler.java
```

- 서비스는 **인터페이스 + `Impl`** 쌍으로 만든다 (참조 프로젝트 규칙).
- 오류 응답은 `common/global`의 `ErrorCode` + `GlobalExceptionHandler`로 일원화한다. `../../docs/02-architecture/api-contract.md`의 오류 코드(`EXTRACTION_FAILED`, `TIMEOUT`, `SESSION_EXPIRED`, `QUOTA_EXCEEDED`)를 `ErrorCode` enum으로 정의한다.
- **`entity`/`repository`는 Supabase 3테이블(익명 통계)에만 존재한다.** 세션·타임라인·소명서는 인메모리이므로 엔티티를 만들지 않는다 — `../../docs/02-architecture/data-model.md`.

### 로컬 실행 인프라

DB·캐시 등 인프라는 전부 `docker-compose.yml`로 띄운다. 로컬 개발은 compose의 Postgres를, 배포는 Supabase를 바라본다(같은 PostgreSQL이므로 스키마는 동일).

- Postgres 16 컨테이너 + `pgdata` 볼륨 + `pg_isready` 헬스체크
- **Redis는 현재 사용하지 않는다.** 세션은 인메모리 `Map`이 스펙이다(`data-model.md`). 필요해지면 compose에 서비스를 추가하되 **TTL을 반드시 건다**(같은 문서).

## 요구사항 추적 매트릭스 (백엔드 소관만)

`../../docs/00-context/spec.md` §8 추적 매트릭스의 백엔드 몫을 Phase에 매핑한 것이다. 이 표에 없는 FR/NFR은 프론트 또는 AI 담당이다.

| 요구사항 | 기능 ID | Phase |
| --- | --- | --- |
| FR-010~013 (문진·세션 보관·변경 무효화) | F2-01, F2-03, F2-04, F1-02 | 2 |
| **FR-014 (이의제기 기한)** | F2-01 | 2 |
| FR-020 (업로드 수신·검증) | F3-01, F3-02 | 3 |
| FR-021 (판독 오케스트레이션) | F4-01~05 (AI 호출) | 3 |
| FR-022 (타임라인 재구성) | F5-01 | 3 |
| FR-023 (대체 증빙 제안) | F5-04 | 3 |
| FR-024 (협박 신호 전달) | F10-02 (신호 중계) | 3 |
| FR-025 (공백 지목) | F5-03 | 3 |
| FR-026 (텍스트 대체 경로) | F3-04 (중계) | 3 |
| FR-027 (서버 무저장) | §7 처리 흐름 | 3 |
| **FR-028 (카드 확인·게이팅)** | F4-06 | 3 |
| FR-029 (품질 검사 — 금액 교차 대조) | F4-07 (서버 몫) | 3 |
| FR-030~033 (사유·증빙·준비도) | F6-01~04 | 4 |
| (자가 진술 수신) | F7-03 보조 — `POST /api/checklist/self-held` | 4 |
| FR-034 (업무처리 기간 고정 안내) | F6-05 | 4 |
| FR-035 (근거 설명) | F6-06 | 4 |
| FR-040 (소명서 생성 중계) | F7-01 | 5 |
| FR-041~042 (체크리스트) | F7-03 | 4·5 |
| FR-043 (텍스트 면 PDF) | F8-01 | 5 |
| FR-044 (재생성) | F7-04 | 5 |
| FR-045 (사실 검증 재시도) | F7-02 | 5 |
| FR-046 (문장-근거 참조 보관) | F7-05 | 5 |
| FR-047 (제출 패키지) | F7-06 | 5 |
| **FR-048 (미리보기·문장 수정)** | **F7-08** | **5** |
| NFR-01 (성능·측정 구간) | — | 3 |
| NFR-02 (가용성) | F11-01 | 1·6 |
| NFR-03 (무저장) | §7 | 3 |
| NFR-07 (오류 시 텍스트 경로) | F4-05 | 3 |
| NFR-08 (로깅) | F11-04 | 6 |

FR-050~053, NFR-04·05·06·09는 프론트 소관이라 이 플랜에 없다.

## 절대 원칙 (구현 중 어떤 경우에도 깨지 않는다)

1. **제출 준비도 점검에 LLM을 쓰지 않는다.** `ReadinessService`는 결정적 규칙 엔진이며 임의 스코어링을 섞지 않는다. — `../../docs/01-product/reason-type-rules.md` §0
2. **은행의 승인·기각을 예측하지 않는다.** 산출물은 "제출 서류가 갖춰졌는가"이지 "해제될 것인가"가 아니다.
3. **이미지를 디스크·DB·Storage에 쓰지 않는다.** 메모리로 받아 AI-server로 넘기고 응답 수신 즉시 폐기한다. — `../../docs/03-infra-ops/privacy-and-safety.md`
4. **로그에 개인정보를 남기지 않는다.** 이미지 내용·추출 텍스트·소명서 본문·파일명 금지. — `../../docs/00-context/spec.md` F11-04
5. **입금액으로 소액 여부를 판정하지 않는다.** 금액은 사실 기재 전용. — `../../docs/00-context/prd.md` §14 OI-01

## 결정 로그

착수 전 확정이 필요하다고 스펙 문서가 표시했던 항목들의 결론이다.

### 확정

| 항목 | 결정 | 반영한 문서 | 근거 (왜 이렇게 정했나) |
| --- | --- | --- | --- |
| 세션 식별자 전달 | 커스텀 헤더 `X-Session-Hash` (쿠키 아님) | `api-contract.md`, `spec.md` F1-01 | 도메인 분리로 `SameSite=None` 리스크 — `request/frontend/pdf-ownership-and-open-contracts.md` §3-1 |
| 내부 API 인증 | 공유 시크릿 헤더 `X-Internal-Token`. `/internal/health`만 무인증 공개 | `internal-api-contract.md` | `request/ai/image-transfer-and-internal-auth.md` |
| FR-014 기한 계산 주체 | 백엔드. `/api/intake` 응답에 `deadline` 추가 | `api-contract.md` | 법 제7조 근거 문구라 서버가 단일 소스 — 같은 요청 §3-2 |
| 타임라인 F5-01/02/03 | 백엔드 구현 (규칙이 전부 결정적) | `system-architecture.md` | 같은 문서 2026-08-23 수정 기록 |
| DEMO_MODE | 백엔드 리소스에 응답 세트 탑재, AI-server 미호출 | 이 문서 / Phase 6 | `spec.md` F11-03 |
| 테스트 범위 | 규칙 단위 테스트 우선, 계약 확정 후 통합 테스트 추가 | 각 Phase 문서 | 팀 결정 (2026-08-23) |
| FR-028 게이팅 | 프론트 차단에 더해 **백엔드도 `409 UNCONFIRMED_FIELDS`로 거부** | `api-contract.md` | 틀린 금액으로 산출된 서류가 은행에 감 — `request/frontend/...` §3-3 |
| F3-03 진행 표시 | 프론트가 이미지를 **1장씩 병렬 호출**. SSE·폴링 미도입 | `api-contract.md` | SSE 인프라 신설 회피 — 같은 요청 §3-4 |
| `stage_event` 수집 | 기존 API 호출 시점으로 백엔드가 자동 적재 (`enter`는 근사치) | Phase 6 | 계약에 수집 엔드포인트 없음 |
| 계약 신규 필드 | `/api/session`에 `demoMode`, `/api/readiness`에 `smallAmountNotice` | `api-contract.md` | 프론트가 값을 알 경로가 계약에 없었음 |
| **F8-01 PDF 생성 주체** | **서버(백엔드)**. 총괄표의 `C` 표기는 오타 → `A`로 정정 | `spec.md` 총괄표·F7-06·F8-01, `api-contract.md` | 나머지 6개 지점이 전부 서버 생성 전제 — `response/backend/pdf-ownership-and-open-contracts.md` §1 |
| **`/api/package/text` 메서드** | `GET` → **`POST`**. 별지 제4호서식 8필드를 바디로 받음 | `api-contract.md`, `prd.md` §9 | 서식 값이 "서비스 미저장"이라 쿼리에 실을 수 없음 — 같은 회신 §1-1 |
| **서식 8필드 필수 여부** | **전부 선택.** 빈 값이면 공란 PDF + 부족자료 체크리스트 표시 | `api-contract.md`, `spec.md` F7-06 | 계좌번호를 모르는 사용자가 실제로 있음. 작성 지원본이지 완성본이 아님 |
| **F5-02 승인 엔드포인트** | `POST /api/timeline/merge` + `GET /api/timeline`에 `mergeCandidates` | `api-contract.md`, `spec.md` F5-02 | 같은 회신 §2 |
| **동시 요청 상한** | 프론트 → 백엔드 **4** (거부선 아님, 발신 상한) | `api-contract.md` | AI 구간이 이미 4 동시 + Render 512MB — 같은 회신 §3-4 |
| **multipart 크기** | 파일당·요청당 **10MB** (기본값 1MB면 정상 이미지가 400) | `api-contract.md`, `deployment-and-uptime.md` | 1600px 리사이즈 후 장당 300KB~1MB — 같은 회신 §3-4 |
| **파일 검증 주체** | 클라이언트·서버 **양쪽**. 매직바이트는 서버가 최종 방어선 | `spec.md` F3-02 | 드래그앤드롭은 `accept`를 우회 — 같은 회신 §5 |
| **CORS 허용 범위** | `localhost:5173` + 프로덕션 도메인 1개. **프리뷰 와일드카드 불허** | `api-contract.md` CORS 절 | 임의 브랜치·포크 배포에서 API 호출 가능해짐 — 같은 회신 §4 |
| **API 명세서 운영** | `api-spec.md`를 프론트용 단일 명세로 두고 **API 완료·수정 시마다 갱신** | 이 문서 "API 작업 규칙" | 계약(합의)과 구현(현황)의 역할을 분리 |
| **소명자료 3단 구조** | ① 법정 첨부서류(필수) / ② 금감원 표준(**물품·용역 2종만**) / ③ 공통 최소(참고) / ④ 보강(선택)로 분리 | `reason-type-rules.md` §2, `spec.md` F7-03, Phase 4-3 | **금감원 표준은 4유형이 아니라 2유형뿐**이었고, 채권 회수·미확정 목록은 근거 없이 만든 것이었다 (2026-08-25 조사) |
| **②를 관문으로 쓰지 않음** | 금감원 표준 미충족만으로 `SUPPLEMENT_NEEDED`를 내지 않는다 | 같은 문서 / TC-21~23 | 금감원 표준은 **부담 경감** 기준이지 요건이 아니다. 개인 중고거래자는 사업자등록증을 발급받을 수 없는데 법정 요건(자유 형식)은 충족 가능하다 |
| **업로드 안내 시점** | 업로드 화면(S02)에서 **사유별 자료 목록을 먼저** 보여준다 (F3-07 신설) | `spec.md` F3-07 | F7-03이 Stage 4에 있어 **다 올린 뒤에야** 뭐가 필요했는지 알게 되는 구조였다 |
| **내부 API 이미지 전달** | **A 계열 raw body.** 멀티파트 봉투·base64 모두 미사용. `POST /internal/extract?image_index={n}` + `Content-Type: image/png` | `internal-api-contract.md`, Phase 3-1 | 멀티파트 파서가 큰 파트를 **디스크에 스풀링**해 무저장 원칙이 프레임워크 기본 동작으로 깨질 수 있음 — `response/backend/image-transfer-and-internal-auth.md` §1 |
| **`source_type` 단위** | **이벤트(카드) 단위.** 이미지 단위 역매핑 기각 | `internal-api-contract.md`, `api-contract.md`, `spec.md` F4-02 | 대화 캡처 안의 송금 알림처럼 **한 이미지에 유형이 섞이는 경우가 흔함** — `response/backend/card-source-type.md` |
| **`event_id` 중복 처리** | 채번은 AI(`evt_{idx}_{n}`), **세션 내 중복 대체는 백엔드** | Phase 3-5 | AI-server는 무상태라 세션을 모름. 같은 인덱스 재추출 시 ID가 충돌 |
| **거래 당사자 이름 추출** | **화면 표시명 원문 추출.** 부분 마스킹(`김O수`) 기각. 소명서 본문에도 원문 | `privacy-and-safety.md` 예외 절, `spec.md` F4-03·F3-06, 양 계약 문서 | ① 동성·동돌림자 오탐 ② **마스킹 규칙을 LLM에 시키면 비결정적** → 결정적 대조 로직의 전제가 깨짐. 이 이름은 부수 식별자가 아니라 **거래 사실 자체** — `response/backend/payer-name-extraction.md` §2 |
| **이름 불일치 취급** | 준비도 신호 4종에 **넣지 않는다.** 체크리스트 항목 상태로만 반영 | Phase 4-4, `reason-type-rules.md` §2-1 | 통장협박·삼각사기 피해자는 **원래 불일치**. 감점으로 다루면 서비스가 피해자를 의심하는 도구가 됨 |
| **`/internal/draft`에 `intake` 추가** | 문진 4필드(`when`·`amount`·`kind`·`usage`) 전달. `history`·`dueNotice*`는 **제외** | `internal-api-contract.md`, Phase 5-1 | **TC-06(자료 0건)이 현행 스키마로 불가능**했음. 이력 제외는 불리한 정보를 사용자가 스스로 제출하게 만들지 않기 위함 — `response/ai/draft-intake-input.md` |
| **지급정지일 합성 이벤트** | `/internal/draft`의 `events`에 **넣지 않는다.** 타임라인 표시·공백 탐지에서는 그대로 사용 | Phase 5-1, `internal-api-contract.md` | 섞이면 AI가 `evidence` 근거로 오인해 "근거 있는 사실"처럼 서술함 |
| **`evidenceRefs.type`** | **3종 확정** — `evidence` / `intake` / `user_text`. 뒤 둘은 "본인 진술" 배지 | `api-contract.md`, `api-spec.md`, Phase 5-1 | FR-045 근거 유형과 1:1. `imageIndex` 부재가 정상인 경우가 생김 |
| **AI가 채우지 않는 값** | `checklist`는 항상 `[]`, `quality_flags.amount_mismatch`는 항상 `false` | `internal-api-contract.md` | 단일 출처가 백엔드. 이미지 1장만 보는 AI는 카드 간 교차 대조를 할 수 없음 |
| **`필수증빙누락` 정의** | "체크리스트에 미보유 항목이 있음" → **"`whenMissing: blocks`인 항목 중 `met`이 아닌 것이 있음"** | `reason-type-rules.md` §3·§3-1, Phase 4 | 종전 정의 그대로 구현하면 **TC-21·TC-22가 깨짐** — 채울 수 없는 항목 때문에 사용자가 영원히 "보완 필요"에 갇힘 |
| **층과 미보유 효과 분리** | `tier`(근거 출처)와 `whenMissing`(못 채우면 어떻게 되나)을 **독립된 두 축**으로 | 같은 문서 §3-1·§3-2 | 같은 ② 금감원 표준인데 TC-21(사업자등록증)과 TC-02(재직 증빙)의 기대 결과가 반대. 가르는 기준은 **"사용자가 실제로 채울 수 있는가"** — `blocks`는 이미 있거나 즉시 발급 가능한 자료에만 (사후에 만들면 **증거 조작**) |
| **`checklist` 스키마** | `{ item, status }` → **8필드**(`id`·`label`·`tier`·`fulfillBy`·`whenMissing`·`status`·`note`·`options`) | `api-contract.md`, `api-spec.md`, Phase 4-3a | 택일(OR) 표현과 미보유 효과 구분이 2필드 구조로는 불가능. 프론트가 형태 확정 + 참조 구현(TC 8건 통과) — `response/backend/evidence-structure-revision.md` §2 |
| **자가 진술 저장** | **`POST /api/checklist/self-held`** 신설 (readiness 바디에 싣지 않음) | `api-contract.md`, Phase 4-3a | 체크리스트를 쓰는 화면이 **Stage 3·4 둘**. 요청 바디에만 실으면 서버에 안 남아 두 화면이 다른 상태를 보임 |
| **직거래 경로** | `/api/intake`에 **`deliveryMethod`** (물품 거래 조건부) + F5-03 ① 예외 | `spec.md` F2-01a·F5-03, `api-contract.md` | **직거래는 송장이 원래 없다.** 그대로 두면 채울 방법이 없는 공백을 띄우고 준비도를 깎음. B안(증거 유형 추가)은 **자료를 올린 뒤에야** 직거래인 걸 알게 되어 F3-07이 풀려던 문제가 남음 |
| **플랫폼 거래 유형** | **추가하지 않음.** 업로드 안내 문구에만 명시 | `spec.md` F3-07 | `EvidenceId`는 프론트 목 전용 타입이고 실제 유형은 AI의 `source_type` 6종 고정 — **프론트만 고치면 죽은 코드**. 얻는 건 배지 문구뿐이고 판독 내용은 `chat`으로도 그대로 추출됨 |
| **제출본 면 구성** | **부족자료 체크리스트 제외**(화면 유지), **표지 신설**, **4면 = 올린 자료의 목차** | `spec.md` F8-01·F7-06, `prd.md` FR-047, Phase 5-4 | 화면에서 `silent`로 감춘 미보유 항목이 **PDF에서 되살아남** — 사용자가 스스로 불리한 목록을 은행에 건네는 구조. 4면 출처가 `checklist`로 적혀 있어 5면만 빼면 반쪽이었음 |
| **면별 항목·정렬 기준** | `spec.md` F8-01에 정의, **PDF가 단일 출처** | 같은 문서, Phase 5-4 | **같은 면을 백엔드(PDF)와 프론트(미리보기)가 각자 그림.** 기준이 없으면 미리 본 것과 받는 것이 어긋남. 금지 3건: 3면 `gaps` 금지 / 4면 파일명 금지(개인정보) / 4면 보유여부 금지 |
| **서식 8 → 11필드** | `mobile`·`email`·`holderName` 추가 | `api-contract.md`, `spec.md` F7-06, `prd.md` §4.4 | 종전 8필드가 서식의 11개 기재란과 맞지 않았음 |
| **문장 수정·제외** | **`POST /api/draft/revise`** 신설 (8/29~8/31) + `excludedSentenceIds` | `api-contract.md`, `prd.md` FR-045 ③·FR-048, `spec.md` F7-08 | **"있는 사실을 틀리게 쓴 문장"은 근거와 매칭되어 F7-02가 못 잡음.** 읽기 전용만 두면 사용자가 발견만 하고 못 고침 |
| **FR-045 ③ 적용 범위** | 자동 삭제는 **LLM 출력에만**. 사용자 수정 문장은 `user_text`로 유지 + `warning` | `prd.md` FR-045 ③ (**PRD 개정**) | 사람이 자기 사실을 적은 문장에 LLM용 규칙을 쓰면 성격이 다름. ⑤가 이미 `user_text`에 "본인 진술"을 규정하고 있어, 삭제가 오히려 규정에 어긋남 |
| **"사용자 확인 완료" 표기** | **미리보기를 거친 뒤에만**. PDF `{시각}` = **다운로드 시각** | `spec.md` F8-01·F7-08 | 초안 생성 직후 붙으면 사용자는 아무것도 확인하지 않은 상태 — "낙관적으로 순화하지 않는다"를 내세우는 이상 우리 화면의 표기부터 사실이어야 함 |
| **F6-05 문구 분리** | "심사 결과 통보"와 "지급정지 해제"를 **분리해 서술** (법 제8조 제2항) | `spec.md` F6-05, `reason-type-rules.md` §4-1, Phase 4-7 | 종전 문구는 **왜 5영업일이 지나도 안 풀리는지**를 설명 못 함. 사용자는 "심사가 끝났는데 왜 계좌가 그대로냐"에서 서비스를 불신 |
| **기간 수치 금지** | **"최대 3년"을 쓰지 않음.** "한동안" + 해제 경로 병기 | `spec.md` F9-03, `reason-type-rules.md` §4-1 | 1차 출처(은행연합회 규약·금융위·금감원 자료·법령) 미확인. **소액 기준을 추정하지 않기로 한 서비스**(OI-01)가 여기서만 후기 근거로 단정하면 앞뒤가 안 맞음 |
| **`notices` 단일 소스** | **서버가 문자열로 내려주고 프론트는 순화 없이 노출** | `api-contract.md`, Phase 4-5 | 법 조문 근거 문구라 서버가 단일 소스여야 함 (FR-014 `deadline.notice`와 같은 구조) |
| **CORS 프론트 도메인** | `https://2026-finance-ai-challenge-tau.vercel.app` (**슬래시 없이**) | `api-contract.md` CORS 절, Phase 6-5 | origin 비교는 문자열 일치. 프리뷰 와일드카드는 종전대로 불허 |

### 상대 역할 회신 — ✅ 2026-08-25 전부 도착

**회신은 `../../docs/response/backend/`에 파일로 들어온다** (2026-08-23 신설 규칙). 요청 파일과 같은 이름으로 오므로, 막힌 작업을 재개하기 전에 이 폴더를 먼저 확인한다.

> 새 요청을 보내면 **회신 전까지 구현하지 않는다** — 호출부만 분리해 두고 다음 항목으로 넘어간다. 그리고 그 항목이 막는 Phase 문서에 `⚠️ 회신 대기` 표시를 남긴다(위 "회신 대기 항목은 Phase 문서에도 표시한다").

**2026-08-25 현재 — 백엔드를 막는 회신 대기 항목은 없다.** AI 4건·프론트 5건이 전부 도착했다. 남은 것은 구현뿐이며, 착수 순서는 `../../docs/05-planning/roadmap.md`의 백엔드 확정 작업 표(1~19번)를 따른다.

| 항목 | 결과 | 회신 |
| --- | --- | --- |
| 증빙 구조 8건 | **전부 회신.** 4건 구현 완료, 플랫폼 유형만 이견 → **B안(문구만) 채택** | `../../docs/response/backend/evidence-structure-revision.md` |
| 서식 11필드·서명 안내·면 구성 | 3건 수용. 서명 안내 구현 완료 | `../../docs/response/backend/legal-form-and-package.md` |
| 정직 고지 3건 | 전부 구현 완료. **"최대 3년"은 1차 출처 미확인으로 뺌** | `../../docs/response/backend/honest-disclosure-fixes.md` |
| 미리보기·수정 단계 | 전부 수용. **자유 편집을 8/29~8/31로 앞당김** → 백엔드 수용 | `../../docs/response/backend/draft-preview-and-edit.md` |
| 프론트 배포 도메인 | **확정** — `https://2026-finance-ai-challenge-tau.vercel.app` (기한 9/5보다 앞당김) | `../../docs/response/backend/deployment-domain.md` |

> **2026-08-25 해소 — AI 회신 4건으로 Phase 3·5 블로커가 전부 풀렸습니다.** 이미지 전달 방식(raw body), 카드 `source_type`, 데모 응답 세트(v1 납품 완료 — `../../ai-server/demo/`), 이름 필드까지 확정됐고, AI가 보낸 `/internal/draft` `intake` 요청도 회신 완료입니다. 결론은 위 "확정" 표, 근거는 `../../docs/response/backend/` 4건과 `../../docs/response/ai/draft-intake-input.md`.
>
> **2026-08-24 해소** — 텍스트 5종 PDF 생성 주체와 F5-02 병합 승인 엔드포인트는 프론트 회신으로 확정됐습니다(위 "확정" 표). 회신: `../../docs/response/backend/pdf-ownership-and-open-contracts.md`, 처리 결과: `../../docs/response/frontend/pdf-ownership-and-open-contracts.md`.

## 스펙 문서에서 발견한 불일치

구현 전에 알고 있어야 할, 문서 간 어긋난 지점들이다.

| 지점 | 내용 | 처리 |
| --- | --- | --- |
| 문진 문항 수 | PRD FR-010·spec F2-01 모두 **6문항으로 정정 완료**(2026-08-23 백엔드 / 08-24 프론트) | 해소. **`api-contract.md`의 7개 필드를 따른다** (공고 문항 하나가 `dueNoticeStatus`+`dueNoticeDate` 2필드로 쪼개져 6문항 = 7필드) |
| F8-01 담당 | spec 총괄표는 `C`(프론트), 나머지 문서는 서버 생성 전제 | **해소 (2026-08-24)** — 총괄표를 `A`로 정정. 프론트 회신으로 서버 생성 확정 |
| TimelineService 위치 | 다이어그램은 AI-server, 총괄표 담당은 `A` | 백엔드로 확정, 다이어그램 개정함 |
| F6-06 담당 | 총괄표는 `B`(AI), **§6 외부 연동 명세도 LLM 용도로 기재**("근거 문구 다듬기"), 그런데 F6-06 본문은 "LLM 다듬기를 사용하지 않는다" — 3곳이 어긋남 | **백엔드가 고정 문구 템플릿으로 구현.** 기능 상세 본문이 우선 |
| 카드 `source_type` | PRD FR-021은 응답 최상위 필드, 이벤트 단위 아님 | **해소 (2026-08-25)** — **이벤트 단위로 확정.** 최상위 필드는 두지 않는다(중복). 한 이미지에 유형이 섞이는 경우가 흔해 이미지 단위로는 판정할 수 없다 |
| **F4-03 "실명" 마스킹** | 마스킹 대상에 "실명"이 있는데, 금감원 표준의 **구매자–송금인 일치 확인**은 이름 없이 불가능 | **해소 (2026-08-25)** — **거래 당사자 표시명만 예외**로 원문 추출. 제3자는 종전대로 미추출. 단일 출처는 `privacy-and-safety.md` 예외 절 |
| **`qualityFlags` 누락** | `api-contract.md`에는 카드별 `qualityFlags`가 있는데 `internal-api-contract.md`에는 없었다 (AI 구현 코드에는 있음) | **해소 (2026-08-25)** — 내부 계약 문서가 낡았던 것. `internal-api-contract.md`에 추가하고 `signals.quality_flags`(이미지 전체)와 다른 값임을 명시 |
| P-03 "사업 매출" | 사유유형 4종에 없는 값 (`personas.md`, TC-03) | **사유는 문진 응답을 그대로 따름.** '사업 매출'은 계좌 사용 목적 서술로 해석 — 두 문서에 각주 추가함 |
| F3-03 진행 표시 | SSE·폴링을 요구하나 `/api/evidence`는 일괄 응답 | 1장씩 병렬 호출로 해결, 계약에 명시함 |
| `stage_event` 수집 | `enter/complete/abandon`을 받을 엔드포인트가 계약에 없음 | 기존 API 호출 시점으로 자동 적재 |
| F4-07 담당 | 총괄표는 `B`(AI)인데 처리 절차 가운데에 **"서버에서 자료 간 금액 교차 대조"** 가 끼어 있음 | **금액 교차 대조는 백엔드가 구현**(Phase 3). `amount_mismatch` → `hasConflicts` 연결이 여기서 생긴다 |
| **F7-03 근거 표기** | 사유 4종 각각에 목록을 두고 근거를 "금감원 2026.5.3"으로 적었으나 **실제 표준은 2종뿐** | **해소 (2026-08-25)** — 3단 구조로 정정. `reason-type-rules.md` §2가 단일 출처 |
| `checklist` 출처 | `/api/draft` 응답과 `/internal/draft` 응답 양쪽에 `checklist`가 있는데 F7-03 담당은 `A`(백엔드) | **백엔드 값으로 응답을 채운다.** AI가 준 `checklist`는 사용하지 않는다 (Stage 3·4가 같은 소스여야 함) |
