# 해빙 (解氷)

지급정지된 계좌의 명의인이 자신의 무고함을 은행 심사역이 5영업일 안에 판단할 수 있는 형태로 조립해 주는 웹 서비스.

2026 금융 AI Challenge 제출 프로젝트 — 프론트엔드 1 · 백엔드 1 · AI 개발자 1, 총 3인 협업.

## 문서

모든 요구사항과 설계 결정의 단일 진실 공급원은 [`docs/00-context/prd.md`](docs/00-context/prd.md) 입니다. 프로젝트를 처음 본다면 [`docs/README.md`](docs/README.md) 부터 읽으세요 — 문서 지도와 역할별 읽는 순서가 정리되어 있습니다.

다른 역할에게 요청할 사항은 `docs/request/{frontend,backend,ai}/` 아래에 문서로 작성하고, **처리한 뒤에는 `docs/response/{요청한 사람}/`에 어떻게 반영했는지 회신 문서를 남깁니다.** 두 폴더 모두 **폴더 이름이 그 문서를 읽을 사람**입니다.

## 저장소 구조

이 프로젝트는 3개의 독립 배포 서비스로 구성됩니다. 각자 자신이 만든 서비스를 직접 배포·운영합니다.

| 경로 | 서비스 | 담당 | 스택 |
| --- | --- | --- | --- |
| [`frontend/`](frontend/) | 정적 SPA (5단계 UI) | 프론트엔드 | React + TypeScript + Vite + Tailwind CSS |
| `backend/` | 세션·준비도 점검 API | 백엔드 | Java 21 + Spring Boot 3.x |
| `ai-server/` | 멀티모달 판독 · 소명서 생성 | AI 개발자 | AI 담당자 재량 |

세 서비스 간 계약은 [`docs/02-architecture/api-contract.md`](docs/02-architecture/api-contract.md)(프론트↔백엔드)와 [`docs/02-architecture/internal-api-contract.md`](docs/02-architecture/internal-api-contract.md)(백엔드↔AI-server)에 정의되어 있습니다.

## 핵심 설계 원칙

> **제출 준비도 점검(Readiness)은 AI가 하지 않는다.** 금융감독원 기준을 그대로 구현한 결정적 규칙 엔진이 확인 완료 여부·필수 증빙 누락·자료 충돌만 점검하며, LLM은 증거 판독과 소명서 문장 생성만 담당합니다. 이 서비스는 은행의 승인·기각을 예측하지 않습니다.

자세한 배경은 [`docs/02-architecture/system-architecture.md`](docs/02-architecture/system-architecture.md) 참조.

## 개발 시작하기

### Frontend

```bash
cd frontend
npm install
npm run dev
```
