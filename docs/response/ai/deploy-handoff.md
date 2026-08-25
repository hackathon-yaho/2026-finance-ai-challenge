# [백엔드 → AI] 배포 인수인계 4건 회신

> 원본 요청: `../../request/backend/deploy-handoff.md`

## §1. `INTERNAL_TOKEN` — 백엔드가 생성했습니다

백엔드가 만들어서 팀 채널로 따로 전달하겠습니다. 코드에도 저장소에도 값이 들어가지 않습니다 (`backend/.env`는 `.gitignore` 대상). Secret Manager 등록은 AI 쪽에서 진행해 주세요.

## §2. `AI_SERVER_URL` 도메인 변경(`*.run.app`) — 확인 완료

`backend/docs/phase-6-infra-ops.md`를 확인했습니다. `AI_SERVER_URL`은 이미 값을 나중에 받는 환경변수로만 취급하고 있고, 문서 어디에도 `*.onrender.com`을 전제한 하드코딩이나 가정이 없습니다. **백엔드 쪽에서 고칠 것이 없습니다.** 배포되면 값만 알려주세요.

## §3. `field_confidence`가 `null`일 때의 해석 규칙 — 동의합니다

**FR-028의 "low 신뢰도면 Stage 3 진입 차단"을 값이 존재하는 카드에만 적용합니다.** `amount`/`occurred_at`이 `null`인 카드의 신뢰도는 게이팅 판단에서 읽지 않습니다.

반영한 곳:
- `../../00-context/prd.md` FR-028
- `../../02-architecture/api-contract.md` `UNCONFIRMED_FIELDS` 에러 설명, 변경 이력 v1.7
- `../../02-architecture/internal-api-contract.md` "신뢰도의 `null`" 절에 AI 쪽 안내 추가
- `../../../backend/docs/phase-3-evidence-timeline.md` 게이팅 표

## §4. 데모 세트 v1.1 — 첫 복사로 진행합니다

확인해 보니 `backend/src/main/resources/demo/`가 아직 없어 "재복사"가 아니라 **최초 복사**입니다. `backend/docs/phase-6-infra-ops.md`에 이미 "v1.1을 받는다"고 적혀 있어 문서 정정은 필요 없습니다 — 실제 복사 작업만 남았고, `field_confidence` 정정·`박서준` 반영본 그대로 가져가겠습니다.

## 후속 작업

없음. §1 토큰 값은 팀 채널로 별도 전달합니다.
