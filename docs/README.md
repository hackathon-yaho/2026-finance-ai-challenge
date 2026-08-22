# 해빙 (解氷) — 지급정지 계좌 소명 지원 서비스

2026 금융 AI Challenge 제출 프로젝트. 프론트엔드 1 · 백엔드 1 · AI 개발자 1, 총 3인 협업 기준으로 구성된 문서입니다.

## 이 문서를 처음 보신다면

1. **`00-context/prd.md`** 를 먼저 읽으세요. 이 프로젝트의 단일 진실 공급원(source of truth)입니다. 아래 모든 문서는 PRD의 해당 섹션을 각 역할이 실행하기 쉬운 단위로 재구성한 것이며, 내용이 서로 다르면 **PRD가 우선**합니다.
2. 본인 역할의 실행 문서를 확인하세요 → `request/frontend/` / `request/backend/` / `request/ai/`
3. 실행 문서에서 링크하는 세부 스펙 문서(02-architecture, 01-product 등)를 필요할 때 참조하세요.

## 핵심 설계 원칙 (전원 필독)

> **판정(Verdict)은 AI가 하지 않는다.** 금융감독원이 2026년 5월 발표한 기준(소액·이력·생계 3요건)을 그대로 구현한 **결정적 규칙 엔진**이 판정하며, LLM은 증거 판독(추출)과 소명서 문장 생성만 담당한다.

이 원칙이 무너지면 심사 방어 논리 전체가 흔들립니다. 세 역할 모두 이 경계를 지켜야 합니다 — 프론트는 "AI가 판정했다"는 UI 문구를 쓰지 않고, 백엔드는 판정 로직에 임의 스코어링을 섞지 않으며, AI는 판정 결과를 스스로 만들어내지 않습니다.

> **서비스는 3개로 독립 배포된다.** 프론트엔드(정적 SPA) / 백엔드(Spring Boot, 판정·세션) / AI-server(멀티모달 판독·소명서 생성). **각자 자신이 만든 서비스를 직접 배포·운영합니다.** 배경은 `02-architecture/system-architecture.md`와 `05-planning/role-assignment.md`의 "개정" 표시 문단을 보세요.

## 문서 지도

| 경로 | 내용 | 주 대상 |
| --- | --- | --- |
| `00-context/prd.md` | PRD 전문 (source of truth) | 전원 |
| `00-context/submission-*.pdf` | 실제 대회 제출본 (기획서·기능명세서) | 전원 (참고용, 수정 금지) |
| `01-product/personas.md` | 6개 페르소나 + 기능 매핑 | 전원, 특히 FE |
| `01-product/reason-type-rules.md` | 사유유형 4종 + 3요건 판정 로직 (FE/BE/AI 공통 계약) | 전원, 특히 BE/AI |
| `02-architecture/system-architecture.md` | 컴포넌트 구조와 설계 원칙 (3서비스 독립 배포) | 전원 |
| `02-architecture/api-contract.md` | 공개 API 요청/응답 명세 | FE ↔ BE 계약 |
| `02-architecture/internal-api-contract.md` | 내부 API 요청/응답 명세 | BE ↔ AI-server 계약 |
| `02-architecture/data-model.md` | Supabase 스키마, 세션 구조 | BE |
| `03-infra-ops/deployment-and-uptime.md` | 서비스별(FE/BE/AI) 배포 리스크와 대응 | 전원, 각자 자기 파트 |
| `03-infra-ops/privacy-and-safety.md` | 개인정보 무저장 원칙, 규제 리스크 | 전원 |
| `04-testing/test-cases-and-demo.md` | 테스트 케이스, 발표 데모 시나리오 | 전원 |
| `05-planning/roadmap.md` | 일정, 스코프컷 우선순위, 리스크 레지스터 | 전원 |
| `05-planning/role-assignment.md` | 역할 분담 및 배포 책임 | 전원 |
| `05-planning/git-branching.md` | Git 브랜치 전략 (모노레포 협업 규칙) | 전원 |
| `request/frontend/*` | 프론트엔드 담당자에게 요청할 사항 문서 | FE |
| `request/backend/*` | 백엔드 담당자에게 요청할 사항 문서 | BE |
| `request/ai/*` | AI 담당자에게 요청할 사항 문서 | AI |

## 문서 갱신 규칙

- `request/frontend/*`, `request/backend/*`, `request/ai/*`는 **다른 역할에게 보내는 요청 문서**만 담습니다(요청 하나당 파일 하나). 판정 로직, API 스키마 같은 실제 스펙 본문을 복사해 넣지 마세요 — 스펙이 바뀌면 두 곳을 다 고쳐야 하고, 결국 어긋납니다. 스펙이 바뀌면 `01-product/`, `02-architecture/` 원본만 고치고 request는 그대로 둡니다.
- PRD 자체를 수정해야 하는 결정(요구사항 변경, 스코프 조정)이 생기면 `00-context/prd.md`를 고치고, 그 사실을 팀 채널에 공유하세요. 다른 문서들은 파생 문서이므로 필요할 때만 따라서 갱신합니다.
