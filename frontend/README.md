# 해빙 (解氷) — Frontend

지급정지된 계좌의 명의인이 문진에 답하고 증거 자료를 올리면, 시간순 타임라인과 사실 진술서 초안까지 조립해주는 6단계(시작 → 상황 접수 → 증거 정리 → 준비도 확인 → 소명서 작성 → 접수 안내) 정적 SPA입니다.

전체 프로젝트 배경, 요구사항, 3개 서비스(프론트엔드/백엔드/AI-server) 구조는 저장소 루트의 [`../docs/00-context/prd.md`](../docs/00-context/prd.md)를 참고하세요.

## 기술 스택

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, `src/index.css`의 `@theme` 블록에 디자인 토큰 정의)
- `pdf-lib` — 제출 패키지 PDF 병합 (F7-06 프론트 몫)
- `pdfjs-dist` — 내려받기 전 실제 문서 미리보기
- oxlint (린터)

`pdf-lib`·`pdfjs-dist`는 **지연 로딩**합니다. 마지막 단계에서만 쓰는 코드라 첫 화면 번들에 넣지 않습니다.

## 현재 상태

**백엔드 API 연동 전 단계입니다.** 백엔드가 공개 API를 아직 구현하지 않아, 화면은 목(mock)
데이터로 동작합니다. 목을 만드는 곳은 `src/lib/`의 순수 함수들(`cards`, `checklist`,
`readiness`, `timeline`, `draft`)이며, **API가 열리면 이 함수들의 반환값을 응답으로
갈아끼우는 것이 연동 작업**입니다.

이미 실제로 동작하는 것 (목이 아닌 것):

| 기능 | 위치 |
| --- | --- |
| 이미지 리사이즈·마스킹 (canvas, 장변 1600px) | `lib/mask.ts` · `components/MaskingSheet.tsx` |
| 텍스트 경로의 개인정보 마스킹 (전송 전, 정규식) | `lib/textEntry.ts` |
| 형사 전환 신호 안내 (F9-02) — 해당자만 스스로 선택 | `components/stages/RoutesStage.tsx` |
| 제출 패키지 PDF 병합·다운로드 | `lib/pdf.ts` |
| 실제 문서 미리보기 (pdf.js 렌더) | `lib/pdfRender.ts` · `components/PdfPreview.tsx` |
| 공개 API 클라이언트 (세션 헤더·오류 매핑·동시 4 상한) | `lib/api/` — **아직 화면에 연결하지 않음** |

원본 이미지는 브라우저 메모리에만 있고 서버로 전송되지 않습니다.

### API 연결하기

`VITE_API_BASE_URL`이 비어 있으면 `lib/api`의 `isApiConfigured()`가 `false`이고 화면은 목으로
동작합니다. 설정 방법은 [`.env.example`](.env.example) 참조.

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
│   ├── stages/          # 6단계 화면 (Intro, Intake, Evidence, Readiness, Draft, Routes)
│   ├── ConfirmCard.tsx  # 추출 카드 확인·수정 (F4-06)
│   ├── ChecklistPanel.tsx  # 첨부 서류 체크리스트 — 4개 층·택일 그룹 (F7-03)
│   ├── EvidenceGuide.tsx   # 사유별 업로드 안내 (F3-07)
│   ├── TextEntryPanel.tsx  # 텍스트 직접 입력 (S02-1 · F3-04)
│   ├── PreviewSheet.tsx    # 제출 패키지 미리보기 (S04-2) — 표지+1~4면
│   ├── LegalFormSheet.tsx  # 별지 제4호서식 11필드 입력 (S04-1)
│   ├── PdfPreview.tsx      # 그 안의 "실제 문서" 보기
│   └── *.tsx               # 공통 UI (TopBar, BottomCta, MaskingSheet, ViewerSheet 등)
├── hooks/
│   ├── useHaebingFlow.ts   # 전체 플로우 상태와 액션을 관리하는 중앙 훅
│   └── useViewportWidth.ts
├── lib/
│   ├── api/             # 공개 API 클라이언트 (계약 타입·오류·동시 상한)
│   ├── cards.ts         # 추출 카드와 확인 게이팅
│   ├── checklist.ts     # 소명자료 판정 (층 · 택일 · 직접 첨부)
│   ├── readiness.ts     # 제출 준비도 산출
│   ├── legalForm.ts     # 서식 11필드 검증
│   ├── textEntry.ts     # 서술 → 카드 · 전송 전 개인정보 마스킹
│   ├── mask.ts          # 리사이즈·마스킹 (실제 canvas 처리)
│   ├── pdf.ts           # 패키지 PDF 병합
│   ├── pdfRender.ts     # PDF 화면 렌더
│   └── *.ts             # 타임라인·소명서·날짜·금액 등 순수 로직
├── data.ts              # 문진 문항 · 소명자료 카탈로그 · 정적 데이터
├── types.ts
└── App.tsx              # 단계 전환 및 레이아웃 루트
```

### 손대기 전에 알아둘 것

- **소명자료 카탈로그**(`data.ts`의 `EVIDENCE_CATALOG`)는 층(`tier`)과 미보유 효과
  (`whenMissing`)를 **독립된 두 축**으로 둡니다. 같은 금감원 표준이라도 즉시 발급받을 수
  있는 자료는 `blocks`, 발급 자체가 불가능할 수 있는 자료는 `silent`입니다. 단일 출처는
  [`../docs/01-product/reason-type-rules.md`](../docs/01-product/reason-type-rules.md) §2입니다
- **준비도·체크리스트 판정은 백엔드가 최종 소유**합니다. `lib/`의 함수들은 API를 붙이기
  전까지 같은 규칙을 대신 계산할 뿐이며, 규칙을 바꿔야 하면 위 문서를 먼저 고칩니다
- **제출본에 "못 갖춘 것"을 적지 않습니다** (`spec.md` F8-01). 미리보기 3면은 증거 공백(`gap`)을
  빼고, 4면은 **파일명을 쓰지 않습니다**(`카톡_김철수_20260901.png`처럼 개인정보가 섞입니다).
  표지에도 부족 자료를 적지 않습니다 — 부족자료 체크리스트를 제출본에서 뺀 이유가 되살아납니다
- **없는 값을 만들어 보여주지 않습니다.** 텍스트 직접 입력(F3-04)은 사용자가 "9월 1일쯤"이라고만
  하면 시각을 만들지 않습니다. 날짜만 있는 값에 `new Date()`를 쓰면 자정이 09:00으로 찍히므로
  주의하세요 — 실제로 한 번 새어나갔던 자리입니다
- **승인·기각을 예측하는 문구를 쓰지 않습니다.** 세 상태 모두에 "최종 판단은 은행이 합니다"를
  병기합니다. **판정이 나오는 화면은 각자 자기 고지 문구를 갖습니다** — 준비도는 "최종 판단은
  은행이 합니다", 소명서는 "최종 판단은 금융회사", 접수는 본문 끝의 배지 문구. 진입 화면(S00)
  상단에도 같은 배지를 둡니다. **이 문구를 화면에서 빼려면 대체 문구가 있는지 먼저 확인하세요**
  — PRD §11 오안내 책임 대응 항목입니다 (`docs/request/backend/persistent-badge-placement.md`)
- **누르는 요소는 44px 이상**(NFR-04)입니다. 스텝퍼·토글처럼 보이는 모양이 작은 컨트롤은
  **모양은 그대로 두고 히트 영역만** 넓혔습니다. 새 버튼을 만들 때도 같은 방식을 쓰세요

## 백엔드/AI 연동 관련 요청

프론트엔드에서 필요한 API나 데이터 형식 변경은 코드로 직접 구현하지 않고, [`../docs/request/backend/`](../docs/request/backend/) 또는 [`../docs/request/ai/`](../docs/request/ai/)에 문서로 정리합니다.
