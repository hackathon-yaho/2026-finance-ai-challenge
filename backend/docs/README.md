# 백엔드 작업 문서

> 해빙(解氷) 백엔드 서비스의 실행 계획 문서입니다. **여기 적힌 모든 항목은 루트 `docs/`의 스펙 문서에 근거가 있으며, 근거 없는 항목은 "미확정"으로 표시했습니다.**

## 이 문서를 쓰는 법

1. 작업을 시작할 때 이 파일에서 현재 Phase를 확인한다.
2. 해당 Phase 문서를 열고 체크리스트를 위에서부터 처리한다.
3. 각 항목에는 **근거 문서 위치**가 붙어 있다. 구현 중 판단이 필요하면 추론하지 말고 근거 문서를 연다.
4. 근거 문서와 다르게 구현해야 할 상황이 생기면 **근거 문서를 먼저 고치고**(문서 상단에 수정 기록) 코드를 바꾼다 — `../../docs/05-planning/role-assignment.md` "매몰 방지 원칙".
5. **API를 하나 완료하거나 수정하면 [api-spec.md](api-spec.md)를 같이 고친다** (아래 규칙).

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
| FR-034 (업무처리 기간 고정 안내) | F6-05 | 4 |
| FR-035 (근거 설명) | F6-06 | 4 |
| FR-040 (소명서 생성 중계) | F7-01 | 5 |
| FR-041~042 (체크리스트) | F7-03 | 4·5 |
| FR-043 (텍스트 5종 PDF) | F8-01 | 5 |
| FR-044 (재생성) | F7-04 | 5 |
| FR-045 (사실 검증 재시도) | F7-02 | 5 |
| FR-046 (문장-근거 참조 보관) | F7-05 | 5 |
| FR-047 (제출 패키지) | F7-06 | 5 |
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

### 미확정 — 상대 역할 회신 대기

이 항목들은 **회신 전까지 구현하지 않는다.** 호출부만 분리해 두고 다음 항목으로 넘어간다.

**회신은 `../../docs/response/backend/`에 파일로 들어온다** (2026-08-23 신설 규칙). 요청 파일과 같은 이름으로 오므로, 막힌 작업을 재개하기 전에 이 폴더를 먼저 확인한다.

| 항목 | 막히는 작업 | 요청 문서 |
| --- | --- | --- |
| 이미지 전달 방식 (A 멀티파트 / B base64) | Phase 3 `AiClient.extract()` 구현체 | `../../docs/request/ai/image-transfer-and-internal-auth.md` |
| 카드별 `source_type` 필드 | Phase 3 F5-01 동시각 tie-break, F5-03 대화 유무 판정 | `../../docs/request/ai/card-source-type.md` |
| 데모 응답 세트 JSON | Phase 6 DEMO_MODE | `../../docs/request/ai/demo-response-set.md` |
| 프론트 배포 도메인 (CORS 등록용) | Phase 6 배포 (로컬은 `localhost:5173`으로 진행 가능) | 프론트 과제, 기한 9/5 — `../../docs/response/frontend/pdf-ownership-and-open-contracts.md` §2-5 |

> **2026-08-24 해소** — 텍스트 5종 PDF 생성 주체와 F5-02 병합 승인 엔드포인트는 프론트 회신으로 확정됐습니다(위 "확정" 표). 회신: `../../docs/response/backend/pdf-ownership-and-open-contracts.md`, 처리 결과: `../../docs/response/frontend/pdf-ownership-and-open-contracts.md`.

## 스펙 문서에서 발견한 불일치

구현 전에 알고 있어야 할, 문서 간 어긋난 지점들이다.

| 지점 | 내용 | 처리 |
| --- | --- | --- |
| 문진 문항 수 | PRD FR-010·spec F2-01 모두 **6문항으로 정정 완료**(2026-08-23 백엔드 / 08-24 프론트) | 해소. **`api-contract.md`의 7개 필드를 따른다** (공고 문항 하나가 `dueNoticeStatus`+`dueNoticeDate` 2필드로 쪼개져 6문항 = 7필드) |
| F8-01 담당 | spec 총괄표는 `C`(프론트), 나머지 문서는 서버 생성 전제 | **해소 (2026-08-24)** — 총괄표를 `A`로 정정. 프론트 회신으로 서버 생성 확정 |
| TimelineService 위치 | 다이어그램은 AI-server, 총괄표 담당은 `A` | 백엔드로 확정, 다이어그램 개정함 |
| F6-06 담당 | 총괄표는 `B`(AI), **§6 외부 연동 명세도 LLM 용도로 기재**("근거 문구 다듬기"), 그런데 F6-06 본문은 "LLM 다듬기를 사용하지 않는다" — 3곳이 어긋남 | **백엔드가 고정 문구 템플릿으로 구현.** 기능 상세 본문이 우선 |
| 카드 `source_type` | PRD FR-021은 응답 최상위 필드, 이벤트 단위 아님 | 미확정 — AI 회신 대기 |
| P-03 "사업 매출" | 사유유형 4종에 없는 값 (`personas.md`, TC-03) | **사유는 문진 응답을 그대로 따름.** '사업 매출'은 계좌 사용 목적 서술로 해석 — 두 문서에 각주 추가함 |
| F3-03 진행 표시 | SSE·폴링을 요구하나 `/api/evidence`는 일괄 응답 | 1장씩 병렬 호출로 해결, 계약에 명시함 |
| `stage_event` 수집 | `enter/complete/abandon`을 받을 엔드포인트가 계약에 없음 | 기존 API 호출 시점으로 자동 적재 |
| F4-07 담당 | 총괄표는 `B`(AI)인데 처리 절차 가운데에 **"서버에서 자료 간 금액 교차 대조"** 가 끼어 있음 | **금액 교차 대조는 백엔드가 구현**(Phase 3). `amount_mismatch` → `hasConflicts` 연결이 여기서 생긴다 |
| **F7-03 근거 표기** | 사유 4종 각각에 목록을 두고 근거를 "금감원 2026.5.3"으로 적었으나 **실제 표준은 2종뿐** | **해소 (2026-08-25)** — 3단 구조로 정정. `reason-type-rules.md` §2가 단일 출처 |
| `checklist` 출처 | `/api/draft` 응답과 `/internal/draft` 응답 양쪽에 `checklist`가 있는데 F7-03 담당은 `A`(백엔드) | **백엔드 값으로 응답을 채운다.** AI가 준 `checklist`는 사용하지 않는다 (Stage 3·4가 같은 소스여야 함) |
