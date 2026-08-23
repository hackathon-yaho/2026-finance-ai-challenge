# 해빙 (解氷) — Frontend

지급정지된 계좌의 명의인이 문진에 답하고 증거 자료를 올리면, 시간순 타임라인과 사실 진술서 초안까지 조립해주는 6단계(시작 → 상황 접수 → 증거 정리 → 준비도 확인 → 소명서 작성 → 접수 안내) 정적 SPA입니다.

전체 프로젝트 배경, 요구사항, 3개 서비스(프론트엔드/백엔드/AI-server) 구조는 저장소 루트의 [`../docs/00-context/prd.md`](../docs/00-context/prd.md)를 참고하세요.

## 기술 스택

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, `src/index.css`의 `@theme` 블록에 디자인 토큰 정의)
- oxlint (린터)

## 현재 상태

백엔드·AI-server 연동 전 단계의 UI 프로토타입입니다. 문진 응답, 증거 판독, 타임라인, 소명서 초안은 모두 `src/hooks/useHaebingFlow.ts`가 클라이언트에서 생성한 목(mock) 데이터로 동작합니다. 이미지 마스킹만 실제 `<canvas>` 처리이며, 마스킹된 이미지는 브라우저 메모리에만 존재하고 서버로 전송되지 않습니다.

## 시작하기

```bash
npm install
npm run dev
```

기본적으로 `http://localhost:5173`에서 열립니다.

## 주요 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 (HMR) |
| `npm run build` | 타입 체크 후 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과물 로컬 미리보기 |
| `npm run lint` | oxlint 실행 |

## 디렉터리 구조

```
src/
├── components/
│   ├── stages/        # 6단계 화면 (Intro, Intake, Evidence, Readiness, Draft, Routes)
│   └── *.tsx           # 공통 UI (TopBar, BottomCta, MaskingSheet, ViewerSheet 등)
├── hooks/
│   ├── useHaebingFlow.ts    # 전체 플로우 상태와 액션을 관리하는 중앙 훅
│   └── useViewportWidth.ts
├── lib/                # 판정/타임라인/소명서 생성 등 순수 로직
├── data.ts             # 문진 문항, 통계 등 정적 데이터
├── types.ts
└── App.tsx             # 단계 전환 및 레이아웃 루트
```

## 백엔드/AI 연동 관련 요청

프론트엔드에서 필요한 API나 데이터 형식 변경은 코드로 직접 구현하지 않고, [`../docs/request/backend/`](../docs/request/backend/) 또는 [`../docs/request/ai/`](../docs/request/ai/)에 문서로 정리합니다.
