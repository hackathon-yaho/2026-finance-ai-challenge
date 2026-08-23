# Git 브랜치 전략

> PRD에는 없는 팀 운영 규칙입니다. 모노레포(`frontend/`, `backend/`, `ai-server/`)를 3인이 각자 독립된 디렉터리·독립 배포로 나눠 담당하므로, 사람 간 코드 충돌 가능성이 낮다는 전제로 가볍게 운영합니다.

## 원칙

1. **`main` 하나만 항상 배포 가능한 상태로 유지한다.** 별도의 `develop`, `release` 브랜치는 두지 않는다.
2. **브랜치명은 소속 서비스를 접두어로 사용한다.**
   - `frontend/작업내용` — 프론트엔드
   - `backend/작업내용` — 백엔드
   - `ai/작업내용` — AI 개발자
3. **작업이 끝나면 PR로 `main`에 바로 머지한다.** 리뷰는 필수로 두지 않는다 — 각자 자신의 디렉터리·서비스를 책임지고 작업하므로, 병목 없이 빠르게 머지한다.

## 참고

- CI/배포 파이프라인은 서비스별로 담당자가 각자 구성한다 (`../03-infra-ops/deployment-and-uptime.md` 참조).
- API 계약(`../02-architecture/api-contract.md`, `../02-architecture/internal-api-contract.md`)이 걸린 변경은 머지 전에 문서를 먼저 고치고 상대 역할에게 공유한다 (`role-assignment.md`의 "매몰 방지 원칙" 참조).
