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

**백엔드에 연결돼 있습니다.** `VITE_API_BASE_URL`이 설정돼 있으면 화면이 실제 API를
호출하고, 비어 있으면 목(mock)으로 동작합니다. 이 갈림은 `useHaebingFlow`의 `live`
하나로 정해지고, **화면 컴포넌트는 어느 쪽인지 모릅니다** — `lib/api/adapt.ts`가 서버
응답을 목이 만들던 것과 같은 모양으로 옮기기 때문입니다.

**목을 지우지 않은 이유**: 배포본이 백엔드보다 먼저 뜨는 구간이 있고, 데모에서 백엔드가
죽어도 화면은 끝까지 돌아야 합니다. 연결되지 않은 상태에서 빈 화면을 보여주는 것보다
목이 낫습니다. 다만 **연결된 뒤에는 목으로 되돌아가지 않습니다** — 자료를 하나도 올리지
않았으면 카드도 0장이고, 목 카드 5장이 나오지 않습니다.

| 단계 | 호출 |
| --- | --- |
| 진입 | `POST /api/session` (한 번, 실패해도 화면을 막지 않음) |
| 처음으로 | `DELETE /api/session` → 새 세션. **5단계 완료 시 자동 파기는 구현되지 않기로 결정**돼(2026-08-26) 여기서 지우지 않으면 앞사람 카드가 서버에 30분 남는다 |
| 문진 | `POST /api/intake` — **다 답한 뒤 답이 바뀔 때마다.** 기한(FR-014)은 서버가 단일 소스 |
| 업로드 | `POST /api/evidence` — 동시 4, **아직 안 보낸 파일만**, `imageIndex`는 세션 누적 위치 |
| 텍스트 입력 | `POST /api/evidence/text` — **가린 뒤** 보냄 |
| 카드 확인·수정 | `POST /api/evidence/confirm` (낙관적 갱신). 삭제는 `confirmed: false` |
| 자료 조립 | `GET /api/timeline` — 이벤트 + `gaps` |
| 준비도 | `POST /api/readiness` — Stage 3 진입 시. **저신뢰 또는 시각 미상** 미확인이 남으면 서버가 409 |
| 자가 진술 | `POST /api/checklist/self-held` — 응답은 갱신된 전체 체크리스트 |
| 소명서 | `POST /api/draft` |
| 문장 수정 | `POST /api/draft/revise` — **고칠 때만.** 제외는 부르지 않는다(아래) |
| 제출 패키지 | `POST /api/package/text` → 브라우저가 원본 이미지 면을 붙여 병합 |

이미 실제로 동작하는 것 (목이 아닌 것):

| 기능 | 위치 |
| --- | --- |
| 이미지 리사이즈·마스킹 (canvas, 장변 1600px) | `lib/mask.ts` · `components/MaskingSheet.tsx` |
| 텍스트 경로의 개인정보 마스킹 (전송 전, 정규식) | `lib/textEntry.ts` |
| 형사 전환 신호 안내 (F9-02) — 해당자만 스스로 선택 | `components/stages/RoutesStage.tsx` |
| 제출 패키지 PDF 병합·다운로드 | `lib/pdf.ts` |
| 실제 문서 미리보기 (pdf.js 렌더) | `lib/pdfRender.ts` · `components/PdfPreview.tsx` |
| 공개 API 클라이언트 (세션 헤더·오류 매핑·동시 4 상한) | `lib/api/` — 화면에 연결됨 |
| 서버 응답 → 화면 모양 변환 | `lib/api/adapt.ts` |

원본 이미지는 브라우저 메모리에만 있고 서버로 전송되지 않습니다.

**F7-05 문장-근거 원본 연결이 실제로 동작합니다.** 카드의 `[원본 보기]`와 소명서 문장을
누르면 **사용자가 올린 그 이미지**가 열립니다 — `source_image_index`/`evidenceRefs.imageIndex`로
브라우저 메모리의 업로드 배열에서 찾습니다. 원본이 메모리에 없으면(새로고침 등) 배지를
회색으로 두고 "원본을 다시 올리면 확인할 수 있어요"를 붙입니다(F7-05 예외).

목 모드에서는 카드의 인덱스가 실제 업로드와 무관해서, 찾지 못하면 `ViewerSheet`의 재현
화면으로 떨어집니다. **연결된 상태에서는 인덱스가 실제 배열 위치라 항상 진짜 원본이 열립니다.**

그래서 **이미 판독을 보낸 파일은 업로드 목록에서 뺄 수 없습니다.** `imageIndex`가 곧 배열
위치라, 가운데를 빼면 뒤가 당겨져 서버 카드가 다른 이미지를 가리키게 됩니다. 자료를 빼려면
카드의 `[이 자료 빼기]`를 씁니다 — 그건 서버에서도 지웁니다.

### 백엔드를 로컬에서 붙여 보기

`docker` 없이 됩니다. 실제로 6단계를 전부 돌려 검증한 조합입니다 (2026-08-26).

```bash
brew install openjdk@21 postgresql@16
LC_ALL=en_US.UTF-8 pg_ctl -D /opt/homebrew/var/postgresql@16 start
psql -d postgres -c "CREATE ROLE haebing LOGIN PASSWORD 'haebing' SUPERUSER;"
createdb -O haebing haebing
psql -U haebing -d haebing -f ../backend/src/main/resources/db/migration.sql
```

백엔드는 `DEMO_MODE=true`로 띄우면 **AI 서버도 API 키도 필요 없습니다** — 고정 픽스처를
돌려주고 LLM을 호출하지 않습니다(과금 없음). `SPRING_DATASOURCE_*`와
`CORS_ALLOWED_ORIGINS=http://localhost:5173`을 주고 `sh gradlew bootRun`.

프론트는 `frontend/.env.local`에 `VITE_API_BASE_URL=http://localhost:8080`을 넣습니다
(`*.local`은 gitignore).

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
- **인쇄는 미리보기 하나만 찍습니다** (F8-02, PDF 생성 실패 시의 대체 경로). `.print-doc`만
  남기고 화면 장치(`.no-print`)는 뺍니다 — 헤더·탭·`[고치기]`·`[빼기]`가 종이에 찍히면
  은행에 낼 수 없는 서류가 됩니다. 면마다 `break-after: page`를 걸고, **5면 원본 이미지는
  인쇄에만** 붙입니다(`.print-only`). 원본이 빠지면 "대체 경로"가 대체가 되지 않습니다
- **제출본에 "못 갖춘 것"을 적지 않습니다** (`spec.md` F8-01). 미리보기 3면은 증거 공백(`gap`)을
  빼고, 4면은 **파일명을 쓰지 않습니다**(`카톡_김철수_20260901.png`처럼 개인정보가 섞입니다).
  표지에도 부족 자료를 적지 않습니다 — 부족자료 체크리스트를 제출본에서 뺀 이유가 되살아납니다
- **`source_type`은 7종이고 그중 둘은 증거가 아닙니다.** `unknown`은 AI가 분류를 보류한
  정상 값이고, `intake`는 **백엔드가 문진 지급정지일로 합성한 카드**입니다(계약 v1.10).
  `intake`는 3면 타임라인에는 남지만 **4면 증빙자료 목록에서는 걸러내고**, 체크리스트 판정의
  근거로도 쓰지 않습니다. 거를 때 `event_id` 문자열을 파싱하지 마세요 — 계약상 불투명 값입니다
- **4면은 원본(첨부) 단위 목차**이고 5면은 이미지입니다. 한때 카드 단위였는데, 캡처 한 장에서
  카드가 여러 개 나오면 3면과 열 구성만 다른 같은 표가 되어 목차 구실을 못 했습니다
  (2026-08-26 백엔드 재정정). **`source_image_index`가 같은 카드끼리 한 줄로 묶고**, 일시는
  아는 값만 모아 범위로(`A ~ B`, 일부만 모르면 `(시각 미상 N건 포함)`), 요약은 한 장이면
  그 카드 요약 그대로·여러 장이면 "N건 확인됨"만 적습니다 — 개별 사실은 이미 3면에 있습니다.
  **계약값은 0-base인데 표시는 1-base**라 렌더링할 때 `+1` 합니다 — 백엔드 PDF도 같은 규칙입니다.
  이미지가 없는 카드(F3-04)는 `null`끼리 묶어 맨 뒤에 "본인 서술" 한 줄로 둡니다
  (`spec.md` F8-01 표기 규칙 표). **서버 PDF가 단일 출처**라 규칙이 바뀌면 여기도 같이 고칩니다
- **문장 제외와 문장 수정은 경로가 다릅니다.** 제외는 서버를 부르지 않고 내려받을 때
  `excludedSentenceIds`로 한 번에 보냅니다 — 체크박스에 가까워서 토글마다 왕복하면 느리고
  실패 처리만 늘어납니다(백엔드가 "이 값이 최종"이라고 확정했습니다). **수정은 `revise`를
  부릅니다** — 근거 재검증이 필요하고, 끊기면 배지가 "본인 진술"로 바뀝니다
- **고친 문장을 지우지 않습니다.** 근거와 매칭되지 않아도 경고만 띄우고 문장은 살립니다.
  자동 삭제는 LLM 출력에 적용하는 규칙이지, 사람이 자기 사실을 적은 문장에 쓸 규칙이
  아닙니다 (FR-045 ③ 개정)
- **`recurrence`는 아직 계약에 없는 선택 필드입니다.** AI-server가 반복 거래를 카드 한 장으로
  묶으면서 내보내지만, 백엔드 `ExtractedEvent`에 필드가 없어 **조용히 버려집니다**(실측 확인).
  그래서 `ExtractedCard.recurrence`를 **옵셔널**로 두고 있을 때만 그립니다 — 확인 카드에
  "매월 · 12회" 배지, 금액 라벨을 "금액 (1회분)", 기간 한 줄. **`amount`가 1회분이라는 게
  핵심입니다** — 이 표기가 없으면 12개월 자동이체가 6만 원짜리 1회 거래로 보이고, 사용자는
  그걸 확인하고 넘어갑니다. **3면·4면은 아직 안 그립니다** — 서버 PDF와 문구를 맞춰야 하는
  자리라 답을 기다립니다 (`docs/request/backend/recurrence-not-reaching-frontend.md`)
- **진행을 막는 카드는 세 가지입니다** (F4-06, `lib/cards.ts`의 `isBlocking`): 날짜가 저신뢰,
  금액이 저신뢰, **날짜를 아예 못 읽은 것**(`occurred_at == null`). 마지막 것은 은행 캡처가
  `08.19`처럼 연도 없이 찍힌 경우로, AI가 **연도를 지어내지 않고** `null`을 낸 정상 동작입니다
  (2026-08-26 확정). **`amount == null`은 막지 않습니다** — 대화 캡처에 금액이 없는 건 정상이라
  날짜만 다르게 취급합니다. 백엔드 `hasBlockingUnconfirmedCards`와 같은 규칙이라, 한쪽만 고치면
  화면은 통과시키는데 서버가 409로 막는 상태가 됩니다. **막혔다고 날짜를 꼭 채워야 하는 건
  아닙니다** — 보고 "맞아요"만 눌러도 풀리고, 그때는 3면에 "시각 미상"으로 남습니다
- **확인·수정한 카드 값이 문서를 이깁니다.** 사용자가 F4-06 카드에서 금액을 고치면 문진
  응답이 아니라 그 값이 소명서·타임라인에 나갑니다 (`lib/cards.ts`의 `confirmedBankAmount`).
  고친 값이 조용히 버려지면 확인 절차 자체가 무의미해집니다
- **제출본에는 확인된 카드만 싣습니다.** 화면 타임라인(`flow.timeline`)과 제출본 3면
  (`flow.submitTimeline`)이 다른 배열인 이유입니다. 2면·4면이 미확인 카드를 빼는데 3면만
  다 실으면 같은 묶음 안에서 어긋납니다. `spec.md` F8-01에 명시된 규칙입니다
  (2026-08-26 확정, [page3-and-biz-notice.md](../docs/response/frontend/page3-and-biz-notice.md))
- **없는 값을 만들어 보여주지 않습니다.** 텍스트 직접 입력(F3-04)은 사용자가 "9월 1일쯤"이라고만
  하면 시각을 만들지 않습니다. 날짜만 있는 값에 `new Date()`를 쓰면 자정이 09:00으로 찍히므로
  주의하세요 — 실제로 한 번 새어나갔던 자리입니다
- **아이콘은 글리프가 아니라 SVG입니다** (`components/icons.tsx`). `‹` `✕` `✓` `＋` `▾`를
  쓰면 폰트마다 굵기·중심이 달라 같은 `font-size`를 줘도 자리마다 다르게 앉고, 한글 폰트가
  이 문자들을 다 갖고 있지도 않습니다. 새 아이콘은 이 파일에 추가하세요 — `currentColor`,
  끝을 둥글린 얇은 선, `aria-hidden`(의미는 옆 글자나 `aria-label`이 집니다)
- **협박 배너는 한 번 켜지면 내리지 않습니다** (F10-02·F10-03). `signals.threat_detected`가
  오면 상단에 고정합니다 — 협박을 받는 사용자는 5단계까지 가지 않을 수 있고(PRD P-03),
  **가장 먼저 지우는 것이 가장 중요한 자료**라는 역설이 이 배너의 존재 이유입니다.
  `/api/evidence/text`는 `signals`를 주지 않으므로 카드의 `source_type`도 함께 봅니다
- **승인·기각을 예측하는 문구를 쓰지 않습니다.** 세 상태 모두에 "최종 판단은 은행이 합니다"를
  병기합니다. **판정이 나오는 화면은 각자 자기 고지 문구를 갖습니다** — 준비도는 "최종 판단은
  은행이 합니다", 소명서는 "최종 판단은 금융회사", 접수는 본문 끝의 배지 문구. 진입 화면(S00)
  상단에도 같은 배지를 둡니다. **이 문구를 화면에서 빼려면 대체 문구가 있는지 먼저 확인하세요**
  — PRD §11 오안내 책임 대응 항목입니다 (`docs/request/backend/persistent-badge-placement.md`)
- **누르는 요소는 44px 이상**(NFR-04)입니다. 스텝퍼·토글처럼 보이는 모양이 작은 컨트롤은
  **모양은 그대로 두고 히트 영역만** 넓혔습니다. 새 버튼을 만들 때도 같은 방식을 쓰세요

## 백엔드/AI 연동 관련 요청

프론트엔드에서 필요한 API나 데이터 형식 변경은 코드로 직접 구현하지 않고, [`../docs/request/backend/`](../docs/request/backend/) 또는 [`../docs/request/ai/`](../docs/request/ai/)에 문서로 정리합니다.
