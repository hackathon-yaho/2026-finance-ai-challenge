# Backend Request

백엔드 개발자에게 요청할 사항을 문서로 정리하는 폴더입니다.

- API 신규/수정 요청, 데이터 모델 변경, 서버 로직 관련 요청 등을 이 폴더에 문서로 작성합니다.
- 요청 하나당 파일 하나로 작성하는 것을 권장합니다. (예: `user-api.md`, `transaction-schema-update.md`)

## 회신 상태 표시 규칙

요청 문서 맨 위에 상태 배너를 답니다. 형식은 [`../frontend/README.md`](../frontend/README.md) "회신 상태 표시 규칙"과 동일합니다.

## 현재 요청 목록

| 문서 | 상태 | 막고 있는 작업 |
| --- | --- | --- |
| [deploy-handoff.md](deploy-handoff.md) | ⏳ 회신 대기 (2026-08-25) | **AI-server 배포** — `INTERNAL_TOKEN`이 예정(Phase 3 착수 전)보다 먼저 필요합니다 |
| [draft-intake-input.md](draft-intake-input.md) | ✅ 회신 완료 (2026-08-25) | 해소 — `intake` 원안 수용, AI 후속 처리까지 완료 |
| [text-entry-ownership-and-masking.md](text-entry-ownership-and-masking.md) | ⏳ 회신 대기 (2026-08-25) | 없음 — F3-04 담당 표기 정리와 **텍스트 경로 마스킹 시점** 확인 |
| [persistent-badge-placement.md](persistent-badge-placement.md) | ⏳ 회신 대기 (2026-08-25) | 없음 — 상시 배지를 전 화면 → **진입 + 판정 화면**으로 바꿈. 명세 표기 정정 판단 |
