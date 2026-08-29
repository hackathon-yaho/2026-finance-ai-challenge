# Backend Request

백엔드 개발자에게 요청할 사항을 문서로 정리하는 폴더입니다.

- API 신규/수정 요청, 데이터 모델 변경, 서버 로직 관련 요청 등을 이 폴더에 문서로 작성합니다.
- 요청 하나당 파일 하나로 작성하는 것을 권장합니다. (예: `user-api.md`, `transaction-schema-update.md`)

## 회신 상태 표시 규칙

요청 문서 맨 위에 상태 배너를 답니다. 형식은 [`../frontend/README.md`](../frontend/README.md) "회신 상태 표시 규칙"과 동일합니다.

## 현재 요청 목록

| 문서 | 상태 | 막고 있는 작업 |
| --- | --- | --- |
| [internal-token-delivery.md](internal-token-delivery.md) | ✅ 해소 (2026-08-26) | 전달·수령·등록 완료 |
| [deploy-handoff.md](deploy-handoff.md) | ✅ 회신 완료 (2026-08-25) | 해소 — `INTERNAL_TOKEN` 백엔드 생성·전달 예정, 나머지 3건 확인 완료 |
| [draft-intake-input.md](draft-intake-input.md) | ✅ 회신 완료 (2026-08-25) | 해소 — `intake` 원안 수용, AI 후속 처리까지 완료 |
| [text-entry-ownership-and-masking.md](text-entry-ownership-and-masking.md) | ✅ 회신 완료 (2026-08-25) | 해소 — F3-04 담당 `B/C` 정정, 마스킹 시점 전송 전(브라우저) 확정 |
| [persistent-badge-placement.md](persistent-badge-placement.md) | ✅ 회신 완료 (2026-08-25) | 해소 — A안 채택, 명세 정정 완료 |
| [page4-ordering.md](page4-ordering.md) | ✅ 회신 완료 (2026-08-25) | 해소 — B안 채택, 텍스트 카드 "본인 서술", 원본 번호 1-base(프론트 변환) |
| [page3-and-biz-notice.md](page3-and-biz-notice.md) | ✅ 회신 완료 (2026-08-26) | 해소 — 3면도 `confirmed` 카드만(A), F10-05 트리거 단순화(A) |
| [local-integration-findings.md](local-integration-findings.md) | ✅ 회신 완료 (2026-08-26) | 해소 — 6건 전부 수정. CORS 프리플라이트 500·AI-server 미설정 400·`evt_intake_when` 계약 편입 등. **프론트가 프리플라이트 200 재확인 완료** |
| [demo-mode-fixture-ids.md](demo-mode-fixture-ids.md) | ✅ 회신 완료 (2026-08-26) | 해소 — 픽스처 반환 시 `event_id`·`source_image_index` 재발급, `evidenceRefs` 범위 초과 시 `user_text`로 하향, `AI_CONFIG_ERROR` 처리 확인 |
| [h2c-upgrade-breaks-ai-call.md](h2c-upgrade-breaks-ai-call.md) | ✅ 회신 완료 (2026-08-26) | 해소 — `AiServerConfig`가 JDK HttpClient를 HTTP/1.1로 고정. **프론트가 프록시 걷어내고 실연동 200 확인 완료** |
| [repeated-events-and-irrelevant-cards.md](repeated-events-and-irrelevant-cards.md) | ✅ **완결** (2026-08-27) | §2 현행 유지(무관 거래 필터링 안 함, F5-04 생계 흔적과 겹침). §7 `occurred_at == null` 게이팅 **백엔드·프론트 양쪽 구현 완료**. §4는 AI가 A안으로 구현 완료(카드 12장 → 1장, 10.4초 → 5.1초). 남아 있던 `recurrence` 전달 경로는 갈라 낸 요청이 **8/27 완결**되면서 함께 해소 |
| [recurrence-not-reaching-frontend.md](recurrence-not-reaching-frontend.md) | ✅ **완결** (2026-08-27 회신 / 프론트 확인 완료) | 해소 — `api-contract.md`에 `recurrence` 반영, `ExtractedEvent`·`DemoFixtures` 통과 경로 수정, 서버 PDF 3면·4면에 반복 표기. **프론트도 미리보기 3·4면을 같은 문구로 맞춤** (3면에 주체·금액 열이 빠져 있던 것도 같이 고침) |
| [legal-form-original-pdf.md](legal-form-original-pdf.md) | ✅ 회신 완료 (2026-08-26) | 해소 — A안(원본 위 덧그리기)으로 구현·검증 완료. 별지 원본 사용, `src/main/resources/forms/`로 이동 |
| [cross-image-duplicates-and-extract-anchor.md](cross-image-duplicates-and-extract-anchor.md) | ✅ 회신 완료 (2026-08-27) | 해소 — §1 `MERGE_WINDOW`는 유지, "반복 포함" 규칙 신설(연도 없는 카드는 여전히 미대상). §2 `/internal/extract`에 `reference_date`·`intake_when` 쿼리 파라미터 신설. **재현 케이스 자체는 AI `duplicate-cards-and-year-inference.md` §2 회신 대기 중** |
