# 해빙 (解氷) — 지급정지 계좌 소명 지원 서비스

> **수정 기록 (2026-08-23)**
> - `response/` 폴더 신설 — 요청이 반영됐는지 확인할 방법이 없다는 문제를 해결하기 위해, 요청 처리 결과를 요청자에게 회신하는 문서를 두는 곳입니다. 문서 지도와 갱신 규칙에 반영했습니다
> - 문서 지도에 `../backend/docs/*`(백엔드 실행 계획) 추가

2026 금융 AI Challenge 제출 프로젝트. 프론트엔드 1 · 백엔드 1 · AI 개발자 1, 총 3인 협업 기준으로 구성된 문서입니다.

## 이 문서를 처음 보신다면

1. **`00-context/prd.md`** 를 먼저 읽으세요. 이 프로젝트의 단일 진실 공급원(source of truth)입니다. 기능 단위의 더 상세한 명세가 필요하면 **`00-context/spec.md`**(기능명세서 전문, F1~F11)를 참조하세요. 아래 모든 문서는 이 두 문서의 해당 섹션을 각 역할이 실행하기 쉬운 단위로 재구성한 것이며, 내용이 서로 다르면 **PRD가 우선**합니다.
2. 본인 역할의 실행 문서를 확인하세요 → `request/frontend/` / `request/backend/` / `request/ai/` (내가 보낸 요청의 처리 결과는 `response/{내 역할}/`)
3. 실행 문서에서 링크하는 세부 스펙 문서(02-architecture, 01-product 등)를 필요할 때 참조하세요.

## 핵심 설계 원칙 (전원 필독)

> **제출 준비도 점검(Readiness)은 AI가 하지 않는다.** 금융감독원이 2026년 5월 발표한 기준을 그대로 구현한 **결정적 규칙 엔진**이 확인 완료 여부·필수 증빙 누락·자료 충돌만 점검하며, LLM은 증거 판독(추출)과 소명서 문장 생성만 담당한다. **이 서비스는 은행의 승인·기각을 예측하지 않는다** — 산출하는 건 "제출 서류가 갖춰졌는가"이지 "해제될 것인가"가 아니다.

이 원칙이 무너지면 심사 방어 논리 전체가 흔들립니다. 세 역할 모두 이 경계를 지켜야 합니다 — 프론트는 "AI가 판정했다"는 UI 문구를 쓰지 않고, 백엔드는 준비도 로직에 임의 스코어링을 섞지 않으며, AI는 준비도 결과를 스스로 만들어내지 않습니다.

> **서비스는 3개로 독립 배포된다.** 프론트엔드(정적 SPA) / 백엔드(Spring Boot, 준비도 점검·세션) / AI-server(멀티모달 판독·소명서 생성). **각자 자신이 만든 서비스를 직접 배포·운영합니다.** 배경은 `02-architecture/system-architecture.md`와 `05-planning/role-assignment.md`를 보세요.

## 문서 지도

| 경로 | 내용 | 주 대상 |
| --- | --- | --- |
| `00-context/prd.md` | PRD 전문 (source of truth) | 전원 |
| `00-context/spec.md` | 기능명세서 전문 (F1~F11, 50개 기능 상세) | 전원 |
| `00-context/submission-*.pdf` | 실제 대회 제출본 (기획서·기능명세서) | 전원 (참고용, 수정 금지) |
| `01-product/personas.md` | 6개 페르소나 + 기능 매핑 | 전원, 특히 FE |
| `01-product/reason-type-rules.md` | 사유유형 4종 + 제출 준비도 산출 로직 (FE/BE/AI 공통 계약) | 전원, 특히 BE/AI |
| `02-architecture/system-architecture.md` | 컴포넌트 구조와 설계 원칙 (3서비스 독립 배포) | 전원 |
| `02-architecture/api-contract.md` | 공개 API 요청/응답 명세 | FE ↔ BE 계약 |
| `02-architecture/internal-api-contract.md` | 내부 API 요청/응답 명세 | BE ↔ AI-server 계약 |
| `02-architecture/data-model.md` | Supabase 스키마, 세션 구조 | BE |
| `03-infra-ops/deployment-and-uptime.md` | 서비스별(FE/BE/AI) 배포 리스크와 대응 | 전원, 각자 자기 파트 |
| `03-infra-ops/privacy-and-safety.md` | 개인정보 무저장 원칙, 규제 리스크 | 전원 |
| `04-testing/test-cases-and-demo.md` | 테스트 케이스, 발표 데모 시나리오 | 전원 |
| `05-planning/roadmap.md` | 일정, 스코프컷 우선순위, 리스크 레지스터 | 전원 |
| `05-planning/role-assignment.md` | 역할 분담 및 배포 책임 | 전원 |
| `05-planning/git-branching.md` | Git 운영 규칙 (main 직접 커밋) | 전원 |
| `../backend/docs/*` | **백엔드 실행 계획(Phase 1~6) 및 결정 로그** | BE |
| `request/frontend/*` | 프론트엔드 담당자에게 요청할 사항 문서 | FE |
| `request/backend/*` | 백엔드 담당자에게 요청할 사항 문서 | BE |
| `request/ai/*` | AI 담당자에게 요청할 사항 문서 | AI |
| `response/frontend/*` | 프론트엔드가 보낸 요청에 대한 회신 | FE |
| `response/backend/*` | 백엔드가 보낸 요청에 대한 회신 | BE |
| `response/ai/*` | AI 담당자가 보낸 요청에 대한 회신 | AI |

## 문서 갱신 규칙

- `request/frontend/*`, `request/backend/*`, `request/ai/*`는 **다른 역할에게 보내는 요청 문서**만 담습니다(요청 하나당 파일 하나). 준비도 로직, API 스키마 같은 실제 스펙 본문을 복사해 넣지 마세요 — 스펙이 바뀌면 두 곳을 다 고쳐야 하고, 결국 어긋납니다. 스펙이 바뀌면 `01-product/`, `02-architecture/` 원본만 고치고 request는 그대로 둡니다.
- **요청을 처리했으면 `response/{요청한 사람}/`에 회신 문서를 남깁니다** (회신 하나당 파일 하나, 파일명은 원본 요청과 동일하게). `request/`와 마찬가지로 **폴더 이름이 이 문서를 읽을 사람**입니다 — 백엔드가 AI에게 보낸 요청은 `request/ai/`에, 그 회신은 `response/backend/`에 둡니다. 요청만 있고 회신이 없으면 요청자는 반영 여부를 확인할 방법이 없습니다. **반영하지 않기로 한 경우에도 이유를 적어 회신합니다.** 자세한 규칙은 `response/README.md` 참조.
- PRD·기능명세서 자체를 수정해야 하는 결정(요구사항 변경, 스코프 조정)이 생기면 `00-context/prd.md`(필요 시 `00-context/spec.md`도)를 고치고, 그 사실을 팀 채널에 공유하세요. 다른 문서들은 파생 문서이므로 필요할 때만 따라서 갱신합니다.
