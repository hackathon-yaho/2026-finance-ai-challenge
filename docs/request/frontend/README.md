# Frontend Request

프론트엔드 개발자에게 요청할 사항을 문서로 정리하는 폴더입니다.

- 화면/컴포넌트 요구사항, API 연동 요청, UI 수정 요청 등을 이 폴더에 문서로 작성합니다.
- 요청 하나당 파일 하나로 작성하는 것을 권장합니다. (예: `login-page-ui.md`, `chart-component.md`)

## 회신 상태 표시 규칙

**요청 문서 맨 위(제목 바로 아래)에 상태 배너를 답니다.** 요청만 쌓이면 어느 게 아직 살아 있는 요청인지 알 수 없기 때문입니다.

```markdown
> **상태: ⏳ 회신 대기** (요청 YYYY-MM-DD)
> 회신은 `../../response/{요청한 사람}/{같은 파일명}.md`에 들어옵니다.
> **막고 있는 작업**: (있으면 적음)
```

**회신이 오면 배너를 아래로 바꿉니다.** 요청 본문은 그대로 둡니다 — 당시 무엇을 물었는지가 기록이기 때문입니다.

```markdown
> **상태: ✅ 회신 완료 (YYYY-MM-DD) — (전부 해결 / 일부 해결)**
> - 회신: `../../response/{요청한 사람}/{파일명}.md`
> - 처리 결과: `../../response/{상대 역할}/{파일명}.md`
> - **결론 요약**: (한두 줄)
> - **남은 것**: (없으면 "없음")
>
> 아래 본문은 **요청 당시 원문**입니다. 확정된 최신 값은 계약 문서를 보세요.
```

| 표시 | 뜻 |
| --- | --- |
| ⏳ 회신 대기 | 아직 답이 없음. 이 요청에 걸린 작업은 착수하지 않음 |
| ✅ 회신 완료 | 답이 왔고 반영됨. 본문은 과거 기록 |
| ⚠️ 일부 회신 | 일부만 답이 옴. 남은 항목을 배너에 명시 |

## 현재 요청 목록

| 문서 | 상태 | 내용 |
| --- | --- | --- |
| [pdf-ownership-and-open-contracts.md](pdf-ownership-and-open-contracts.md) | ✅ 회신 완료 (08-24) | PDF 생성 주체·미정 계약 |
| [draft-preview-and-edit.md](draft-preview-and-edit.md) | ⏳ 회신 대기 (08-24) | 다운로드 전 미리보기·수정 |
| [evidence-structure-revision.md](evidence-structure-revision.md) | ⏳ 회신 대기 (08-24) | **증빙 구조 6건** — 송금인 일치·택일구조·직거래·플랫폼·신원소명·수사자료 |
| [legal-form-and-package.md](legal-form-and-package.md) | ⏳ 회신 대기 (08-24) | **법정 서식 대조** — 필드 8→11 정정, 서명 안내, 5면 분리 |
| [honest-disclosure-fixes.md](honest-disclosure-fixes.md) | ⏳ 회신 대기 (08-24) | **고지 문구 3건** — 5영업일·3년 제한·보존 지침 |

> 프론트가 동시에 4건을 받는 상태입니다. **회신 우선순위는 `legal-form-and-package` → `honest-disclosure-fixes` → `evidence-structure-revision` → `draft-preview-and-edit`** 를 권합니다 — 앞의 둘이 확정적이고 작습니다.
