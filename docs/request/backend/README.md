# Backend Request

백엔드 개발자에게 요청할 사항을 문서로 정리하는 폴더입니다.

- API 신규/수정 요청, 데이터 모델 변경, 서버 로직 관련 요청 등을 이 폴더에 문서로 작성합니다.
- 요청 하나당 파일 하나로 작성하는 것을 권장합니다. (예: `user-api.md`, `transaction-schema-update.md`)

## 회신 상태 표시 규칙

요청 문서 맨 위에 상태 배너를 답니다. 형식은 [`../frontend/README.md`](../frontend/README.md) "회신 상태 표시 규칙"과 동일합니다.

## 현재 요청 목록

| 문서 | 상태 | 막고 있는 작업 |
| --- | --- | --- |
| [internal-token-delivery.md](internal-token-delivery.md) | ⏳ 회신 대기 (2026-08-26) | **백엔드↔AI 연동 확인** — `INTERNAL_TOKEN` 값 미수령 |
| [deploy-handoff.md](deploy-handoff.md) | ✅ 회신 완료 (2026-08-25) | 해소 — `INTERNAL_TOKEN` 백엔드 생성·전달 예정, 나머지 3건 확인 완료 |
| [draft-intake-input.md](draft-intake-input.md) | ✅ 회신 완료 (2026-08-25) | 해소 — `intake` 원안 수용, AI 후속 처리까지 완료 |
| [text-entry-ownership-and-masking.md](text-entry-ownership-and-masking.md) | ✅ 회신 완료 (2026-08-25) | 해소 — F3-04 담당 `B/C` 정정, 마스킹 시점 전송 전(브라우저) 확정 |
| [persistent-badge-placement.md](persistent-badge-placement.md) | ✅ 회신 완료 (2026-08-25) | 해소 — A안 채택, 명세 정정 완료 |
| [page4-ordering.md](page4-ordering.md) | ✅ 회신 완료 (2026-08-25) | 해소 — B안 채택, 텍스트 카드 "본인 서술", 원본 번호 1-base(프론트 변환) |
| [page3-and-biz-notice.md](page3-and-biz-notice.md) | ✅ 회신 완료 (2026-08-26) | 해소 — 3면도 `confirmed` 카드만(A), F10-05 트리거 단순화(A) |
| [local-integration-findings.md](local-integration-findings.md) | ✅ 회신 완료 (2026-08-26) | 해소 — 6건 전부 수정. CORS 프리플라이트 500·AI-server 미설정 400·`evt_intake_when` 계약 편입 등. **프론트가 프리플라이트 200 재확인 완료** |
| [demo-mode-fixture-ids.md](demo-mode-fixture-ids.md) | ✅ 회신 완료 (2026-08-26) | 해소 — 픽스처 반환 시 `event_id`·`source_image_index` 재발급, `evidenceRefs` 범위 초과 시 `user_text`로 하향, `AI_CONFIG_ERROR` 처리 확인 |

> **2026-08-26 기준 대기 중: `internal-token-delivery` 1건.**
