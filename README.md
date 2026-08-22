# 해빙 (解氷)

지급정지된 계좌의 명의인이 자신의 무고함을 은행 심사역이 5영업일 안에 판단할 수 있는 형태로 조립해 주는 웹 서비스.

2026 금융 AI Challenge 제출 프로젝트 — 프론트엔드 1 · 백엔드 1 · AI 개발자 1, 총 3인 협업.

## 문서

모든 요구사항과 설계 결정의 단일 진실 공급원은 [`docs/00-context/prd.md`](docs/00-context/prd.md) 입니다. 프로젝트를 처음 본다면 [`docs/README.md`](docs/README.md) 부터 읽으세요 — 문서 지도와 역할별 읽는 순서가 정리되어 있습니다.

다른 역할에게 요청할 사항은 `docs/request/{frontend,backend,ai}/` 아래에 문서로 작성합니다.

## 저장소 구조

이 프로젝트는 3개의 독립 배포 서비스로 구성됩니다. 각자 자신이 만든 서비스를 직접 배포·운영합니다.

| 경로 | 서비스 | 담당 | 스택 |
| --- | --- | --- | --- |
| [`frontend/`](frontend/) | 정적 SPA (5단계 UI) | 프론트엔드 | React + TypeScript + Vite + Tailwind CSS |
| `backend/` | 세션·판정 API | 백엔드 | Java 17 + Spring Boot 3.x |
| `ai-server/` | 멀티모달 판독 · 소명서 생성 | AI 개발자 | AI 담당자 재량 |

세 서비스 간 계약은 [`docs/02-architecture/api-contract.md`](docs/02-architecture/api-contract.md)(프론트↔백엔드)와 [`docs/02-architecture/internal-api-contract.md`](docs/02-architecture/internal-api-contract.md)(백엔드↔AI-server)에 정의되어 있습니다.

## 핵심 설계 원칙

> **판정(Verdict)은 AI가 하지 않는다.** 금융감독원 기준(소액·이력·생계 3요건)을 그대로 구현한 결정적 규칙 엔진이 판정하며, LLM은 증거 판독과 소명서 문장 생성만 담당합니다.

자세한 배경은 [`docs/02-architecture/system-architecture.md`](docs/02-architecture/system-architecture.md) 참조.

## 개발 시작하기

### Frontend

```bash
cd frontend
npm install
npm run dev
```
