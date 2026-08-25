# [백엔드 → 프론트] F3-04 담당 표기·마스킹 시점 회신

> 원본 요청: `../../request/frontend/text-entry-ownership-and-masking.md`

## §1. F3-04 담당 표기 — `B` → `B/C`로 정정했습니다

`../../00-context/spec.md` 총괄표를 F7-05·F7-06과 같은 표기법으로 정정했습니다 (추출=B, 화면=C).

## §2. 마스킹 시점을 "전송 전(브라우저)"으로 확정 — 동의합니다

이미지 경로(F3-06)와 원칙을 통일하는 게 맞고, 프론트가 이미 구현을 마쳤으므로 되돌리는 비용만 있고 얻는 게 없습니다.

반영한 곳:
- `../../00-context/prd.md` FR-027 — 마스킹 주체를 "프론트엔드(브라우저, 전송 전)"로 명시
- `../../02-architecture/api-contract.md` `/api/evidence/text` 행 — `rawText`가 이미 마스킹된 값임을 명시, 변경 이력 v1.7
- `../../02-architecture/internal-api-contract.md` — AI에게 `rawText`가 이미 가려진 상태로 도착한다는 것과, `pii.py` 후처리는 이중 방어로 유지 권장, 평가 세트 측정 조건 영향을 공유했습니다 (`../ai/deploy-handoff.md`와 별개로 AI 담당에게 직접 전달 예정)

## 후속 작업

없음. §3(F3-04 구현 확인 내용)은 확인했고 추가 조치가 필요하지 않습니다.
