# AI-server 실행 계획

> 작성: AI · 2026-08-25. 팀 로드맵(`../../docs/05-planning/roadmap.md`)의 구간에 AI-server 작업을 매핑한 체크리스트다. 설계 근거는 [design.md](design.md), 계약은 `../../docs/02-architecture/internal-api-contract.md`가 단일 출처.
>
> 백엔드 플랜(`../../backend/docs/README.md`)과 같은 규칙을 따른다: 판단이 필요하면 추론하지 말고 근거 문서를 열고, 계약이 걸린 변경은 **문서 먼저** 고친다.

## Phase A1 — 스켈레톤 (8/25, 로드맵 "킥오프·스켈레톤" 잔여일)

- [ ] FastAPI 프로젝트 골격 + `requirements.txt` + Dockerfile (design.md §2 구조)
- [x] `GET /internal/health` (무인증) — `{"status":"UP"}`
- [x] `X-Internal-Token` 검증 dependency (401, 상수 시간 비교) — 계약 체크리스트 "AI-server 측 401 검증 구현" 해소
- [x] pydantic 스키마: 카드·신호·draft 요청/응답 (계약 = 코드)
- [x] 배포 플랫폼 확정 — **Google Cloud Run (무료 한도, $0)** (2026-08-25). 공용 문서(`../../docs/03-infra-ops/deployment-and-uptime.md` §3, PRD §8.3) 먼저 수정 완료
- [x] 배포 준비 — `.gcloudignore` / `.dockerignore` / `deployment.md` (명령어까지). Dockerfile은 수정 불필요(`${PORT}` 그대로 동작)
- [ ] **실제 배포 → `AI_SERVER_URL` 백엔드 전달** (킵얼라이브 Secrets) — 백엔드가 대기 중(`../../docs/05-planning/roadmap.md`). 필요한 것: 결제 계정 연결된 GCP 프로젝트, `gcloud` CLI, 백엔드가 공유할 `INTERNAL_TOKEN`
- [ ] 10MB 요청이 통과하는지 실측 (Cloud Run HTTP/1 상한 32 MiB — 여유 있어야 정상)
- [ ] 콜드스타트 지연 실측
- [ ] 외부 헬스 모니터링 등록 (5~10분 간격 — 콜드스타트 방지 겸용)
- [ ] 예산 알림 설정 ($1 임계값)

## Phase A2 — 추출 (8/25~8/28, 로드맵 "코어 기능")

- [x] `POST /internal/extract` 이미지 경로: raw body 수신 → LLM 판독 → 카드 응답 (design.md §3-3, §4)
- [x] structured outputs 스키마 + 시스템 프롬프트 (§4의 11개 조항)
- [x] `source_type` / `counterparty_name` / `payer_name` / `field_confidence` / `source_region` 산출 — **이름이 `null`이면 신뢰도도 `null`** 로 덮어쓰는 불변식 포함 (2026-08-25 회신 §6)
- [x] `signals` 산출: `threat_detected` / `delivery_evidence` / `life_activity` / `blurry` / `missing_date` (`amount_mismatch`는 항상 false)
- [x] 텍스트 경로 (`application/json`, rawText) — `occurred_at` confidence 전부 `low` 강제
- [x] PII 후처리 검증 (`pii.py`) + 단위 테스트
- [x] 실패 처리: 재시도 1회·타임아웃·QUOTA_EXCEEDED·refusal 폴백 (§7)
- [x] 이미지 참조 즉시 해제 확인 (디스크·로그에 흔적 없음 — `privacy-and-safety.md` AI 체크리스트)
- [x] 샘플 캡처로 인젝션 방어 검증 (TC-10) — 평가 세트 3건, 지시 미이행 + 정상 추출 확인
- [x] **이름 추출 정확도 실측 완료** (8/28 약속보다 앞당김) → `../../docs/response/backend/payer-name-extraction.md`에 수치·편차·방어 추가
- [x] 제3자 이름 미추출 검증 — `ev-chat-03`(대화 중 언급된 제3자) 통과. summary 원문 복사 문제도 함께 수정

## Phase A3 — 소명서 (8/29~8/31, 로드맵 "문서 생성")

- [x] `POST /internal/draft`: 사실 목록 직렬화 → LLM 문장 생성 (basis 포함) (design.md §5-1)
- [x] FactChecker 결정적 검증기 + 단위 테스트 (LLM 없이): 근거 매칭·날짜/금액 대조·금지 표현 차단·본인 진술 태깅·factCheckPassed 판정 (§5-2)
- [x] 협박 수신 사실 문단 고정 템플릿 삽입 (F10-04, §5-3)
- [x] 제목·메타·서명란 결정적 템플릿 조립
- [x] `evidenceRefs` 산출 (evidence/intake/user_text), `checklist: []`
- [x] `intake` 입력 반영 — **2026-08-25 확정** (`../../docs/response/ai/draft-intake-input.md`, 원안 수용)
- [x] 금칙어에 과거 이력(TC-29)·금액 평가(OI-01)·이름 대조 판정(TC-25) 계열 추가 (회신 §1 요청)
- [x] TC-06·TC-08 회귀 테스트 (`tests/test_api.py`, `tests/test_factcheck.py`)
- [x] 실 LLM 소명서 육안 검증 — ISO 일시·영문 enum이 본문에 새던 문제 수정(직렬화 한국어화)

## Phase A4 — 완성도·품질 (9/1~9/2, 로드맵 "완성도")

- [x] 평가 세트 구축: 합성 캡처 **27건** + 기대값 + 러너 (`../evals/`, design.md §9)
- [x] **안전 지표 실측 완료** (LLM 불필요 — 책임 주체가 결정적 FactChecker): 위반 문장 차단 15/15, 근거 연결률 100%, 근거 없는 문장 비율 0%
- [x] 평가 세트가 찾아낸 실제 결함 1건 수정: 예측·낙관 일반형("인용될 가능성이 높습니다")이 금칙어를 통과하던 문제 → 회귀 테스트 고정
- [x] **추출 지표 실측 완료 — PRD §1.4 목표 전부 충족(2회 연속)**: 날짜 96.2% / 금액 90.5~100% / 협박 재현율 100%·오탐 0 / 확인 전 오류 차단 위반 0 / p95 5.8~5.9초
- [x] 미달 지표 조정·재실측 — 결함 5건 수정(ISO 형식·이름 오염·summary 복사·amount 부호·흐림 신뢰도)
- [ ] **데모 응답 세트 v2**: 확정된 실제 데모 이미지 4장을 파이프라인에 통과시켜 재생성 (`demo/`, imageIndex·bbox 동기화) → 백엔드에 전달
- [x] 실사용 신고 대응 4건 — LLM 공급자 불일치·소명서 타임아웃·반복 중복·연도 추론 (전부 회신·구현·실측 완료)
- [ ] 품질 검사 안내와의 정합 확인 (quality_flags → 백엔드 안내 문구 매핑이 실제로 뜨는지 백엔드와 합동 확인)

## Phase A5 — 인프라 확정 (9/5, 로드맵 "인프라 확정")

- [ ] **9/5까지 배포 완료 + 무료 한도 내 동작 확인** — 유료 전환은 불필요하다(Cloud Run Always Free). 대신 킵얼라이브가 실제로 인스턴스를 살려 두는지 확인한다
- [ ] 헬스체크·킵얼라이브 동작 확인 (스핀다운 없는 상태 검증)
- [ ] 동시 4 요청 부하 확인 (10장 업로드 시나리오 3회)
- [x] 키 등록 경로 구축 — `scripts/set_key.py`(CLI 입력 → `.env`) + `load_dotenv`로 SDK 연결, 회귀 테스트 6건
- [ ] 환경변수 최종 점검 (`INTERNAL_TOKEN` 일치, 키 유효기간)

## Phase A6 — 최종 점검·심사 기간 (9/6~9/11)

- [ ] 9/6: 3서비스 전체 플로우 3회 완주 합동 확인
- [ ] 9/7~9/11: 매일 아침 `/internal/health` 확인 로테이션 참여

## 공용 문서가 바뀌면 이 폴더를 확인한다 (역방향 규칙)

`docs/05-planning/role-assignment.md` "파생 문서 동기화 원칙"(2026-08-25 신설)의 AI 쪽 대응표다. **루트 `../../docs/`의 스펙·계약 문서를 고쳤으면 같은 작업 안에서 아래 문서를 열어 반영할 것이 있는지 확인한다.** 없으면 없는 대로 넘어가되, 확인은 건너뛰지 않는다.

| 루트 문서 | 확인할 AI 문서·코드 |
| --- | --- |
| `spec.md` F3-04 (텍스트 입력) · F4 (판독·품질검사) | [design.md](design.md) §3-3·§4 + `app/services/extraction.py`·`app/llm/prompts.py` |
| `spec.md` F7-01·02·05 (소명서·검증·근거 연결) · F10-02·04 (협박) | [design.md](design.md) §5 + `app/services/drafting.py`·`factcheck.py` |
| `spec.md` F11-03 (데모) · F11-05 (평가) | `demo/` + [design.md](design.md) §9 + `evals/` |
| `01-product/reason-type-rules.md` (§0 절대 원칙 · §4 금지 문구) | [design.md](design.md) §0·§5-2 (FactChecker 블록리스트) + [plan.md](plan.md) 절대 원칙 |
| `02-architecture/internal-api-contract.md` | [design.md](design.md) §3 + `app/schemas/` (계약=코드) + `demo/` 파일 |
| `02-architecture/api-contract.md` 카드·draft 스키마 | 위와 동일 (내부·외부 응답은 같은 형식이어야 함) |
| `03-infra-ops/privacy-and-safety.md` | [design.md](design.md) §6 + `app/pii.py` |
| `03-infra-ops/deployment-and-uptime.md` | [design.md](design.md) §10 + Phase A5 |
| `04-testing/test-cases-and-demo.md` | `demo/`·`evals/` + 해당 Phase 체크리스트 |
| `00-context/prd.md` §10 (AI 파이프라인) | [design.md](design.md) §4·§5·§7 전체 |

## 절대 원칙 (구현 중 어떤 경우에도 깨지 않는다)

1. **준비도를 판단하지 않는다.** `readiness`는 받은 값 그대로, 문장 톤 제어에만 쓴다. — `reason-type-rules.md` §0
2. **승인·기각·해제 가능성을 언급하는 출력을 만들지 않는다.** 금지 어휘는 FactChecker 블록리스트로도 이중 차단한다.
3. **이미지를 디스크에 쓰지 않는다. 무상태를 유지한다.** — `privacy-and-safety.md`
4. **로그에 이미지 내용·추출 텍스트·이름·소명서 본문을 남기지 않는다.**
5. **없는 값은 추측하지 않는다.** null + confidence/quality_flags로 정직하게 표기한다.
6. **응답 스키마는 계약 문서와 항상 동일하게.** 스키마를 바꿔야 하면 계약 문서 먼저.
