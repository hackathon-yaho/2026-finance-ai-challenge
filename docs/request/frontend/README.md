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

> **회신 전 개정은 예외입니다.** 아직 회신이 오지 않은 요청에서 전제가 틀린 것을 발견하면 **본문을 고칩니다.** 잘못된 전제 위에서 회신을 받으면 두 번 일하게 되기 때문입니다. 이때는 상태 배너에 `· **YYYY-MM-DD 개정**`을 덧붙이고, 무엇이 왜 바뀌었는지 배너 안에 적습니다.

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
| [draft-preview-and-edit.md](draft-preview-and-edit.md) | ✅ **완결** (08-25 ③ 회신 / 백엔드 답변 완료) | 다운로드 전 미리보기·수정 — **전부 8/29~31**. 확인 3건 답변: 4면=**A**, `/api/draft/revise` **8/29~31 가능**, 면별 기준 **정의 완료**. PRD FR-045 ③ 개정 |
| [evidence-structure-revision.md](evidence-structure-revision.md) | ✅ **완결** (08-25 회신 / 백엔드 답변 완료) | **증빙 구조 8건 전부** — 자료구조·업로드 안내·수사자료 구현 완료, 직거래 A안. **§4는 B안 채택**(계약 유지 + 문구만). `필수증빙누락` 정의 좁힘, `self-held` 엔드포인트 신설 |
| [legal-form-and-package.md](legal-form-and-package.md) | ✅ **완결** (08-25 ② 회신 / 백엔드 답변 완료) | **법정 서식 대조** — 11필드 수용, 서명 안내 구현. **부족자료 체크리스트 제출본 제외 + 표지 채택**. 4면은 **A(올린 자료 목차)** 로 확정 |
| [honest-disclosure-fixes.md](honest-disclosure-fixes.md) | ✅ **완결** (08-25 회신 / 백엔드 답변 완료) | **고지 문구 3건** — 전부 반영·구현. **"최대 3년"은 1차 출처 확보 실패 → 숫자 없이 확정** (2차 출처끼리 최대/최소가 엇갈림) |
| [image-delivery-spec.md](image-delivery-spec.md) | ✅ 회신 완료 (08-25) | 전송 이미지 해상도·포맷 — **738×1600 · PNG · 약 135KB**, 1600px 리사이즈 적용됨 |
| [evidence-timeline-schema-additions.md](evidence-timeline-schema-additions.md) | ✅ **완결** (08-26 회신 / 백엔드 답변 완료) | Phase 3 계약 보완 4건 — **전부 수용**. `imageIndex`는 **세션 누적 기준 맞음**(백엔드는 값을 그대로 통과시킬 뿐). 중복 인덱스는 막지 않음 |
| [readiness-checklist-catalog-diffs.md](readiness-checklist-catalog-diffs.md) | ✅ 회신 완료 (08-26) | Phase 4 체크리스트 차이 2건 — **둘 다 문서가 맞음**. 목 카탈로그 정정 완료, 화면 변경 불필요 |
| [draft-revise-and-package-notes.md](draft-revise-and-package-notes.md) | ✅ **완결** (08-26 ② 회신 / 백엔드 답변 완료) | Phase 5 — 배열에서 빼는 방식 수용, `DRAFT_FAILED` 반영. **`excludedSentenceIds`가 최종 확정**(순수 제외엔 `revise` 불필요) + `DRAFT_FAILED` 후 세션·확인 카드 유지 확정 |
| [local-integration-findings.md](local-integration-findings.md) | ✅ **완결** (08-26 회신 / 백엔드 답변 완료) | **로컬 연동 버그 6건 전부 수정.** CORS 프리플라이트 500(연동 차단 블로커)·기한 경과 문구·문진 재전송 병합·`evt_intake_when`(`source_type: intake` 신설, 3면 포함·4면 제외)·AI-server 미설정 400→502·`gradlew` 실행 권한 |

> **2026-08-26 기준 대기 중인 요청이 없습니다.** 10건 전부 회신을 마쳤고, 프론트가 물어둔 확인 3건에도 전부 답했습니다.
