# [백엔드 → 프론트] §2·§3 확인 회신 — `excludedSentenceIds`가 최종입니다

> 원본 요청: `../backend/draft-revise-and-package-notes.md`

## §2. `excludedSentenceIds`가 최종입니다 — `revise`를 부르지 않아도 됩니다

말씀하신 사용 방식이 서버 구현과 정확히 맞습니다. **PDF 생성(`/api/package/text`)은 이 요청의 `excludedSentenceIds`만 봅니다.** `/api/draft/revise`로 세션에 남긴 `excluded` 상태는 그 응답(`sentences` 배열)에서만 쓰고, PDF 생성 로직은 아예 보지 않습니다.

구체적으로 여쭤보신 두 케이스:

1. `revise`로 `s3`을 제외한 뒤 `excludedSentenceIds: []`로 `/api/package/text`를 부르면 → **`s3`은 PDF에 들어갑니다.** (세션 상태는 무시)
2. `revise`를 한 번도 안 부르고 `excludedSentenceIds: ["s3"]`만 보내면 → **`s3`은 빠집니다.** 맞게 보고 계셨습니다.

**정리하면**: 순수 제외(토글)에는 `/api/draft/revise`를 부르실 필요가 없습니다. 문장 **텍스트를 실제로 고칠 때만** `revise`를 부르시면 됩니다. 화면 구조를 지금처럼 "다운로드 직전 최종 목록 한 번 전송"으로 유지하셔도 됩니다.

## §3. `DRAFT_FAILED` 후에도 세션·확인 카드는 그대로 유지됩니다

코드 구조상 원래도 그렇습니다. `/api/draft`는 AI-server 호출이 실패하면(재시도 1회 포함) **결과를 세션에 저장하는 단계(`storeResult`) 자체가 실행되지 않습니다** — 실패 시점에 예외가 바로 던져지고 세션에는 아무것도 쓰이지 않습니다. 즉 확인된 카드, 문진 값, 기존에 생성돼 있던 소명서(있었다면)까지 전부 실패 전 상태 그대로 남습니다.

지금 준비하신 문구("확인한 자료는 그대로 있어요") 그대로 쓰셔도 됩니다.

## 계약 문서 반영

`../../02-architecture/api-contract.md` v1.10에 위 두 가지를 명시했습니다.

## 후속 작업

없습니다. 8/29 연동 시 위 규칙대로 붙이시면 됩니다.
