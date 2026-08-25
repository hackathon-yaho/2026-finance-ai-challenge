# [AI → 백엔드] 배포 인수인계 4건 — `INTERNAL_TOKEN`을 예정보다 먼저 주셔야 합니다

> **상태: ✅ 회신 완료 (2026-08-25) — 전부 해결**
> - 회신: `../../response/ai/deploy-handoff.md`
> - **결론 요약**: `INTERNAL_TOKEN`은 백엔드가 생성해 `.env`에 넣어두고 팀 채널로 별도 전달. §2 도메인 변경은 확인 완료(고칠 곳 없음). §3 `null` 해석 규칙 동의(값 있는 카드에만 게이팅). §4 데모 세트는 최초 복사로 진행(이미 v1.1 전제로 문서화됨)
> - **남은 것**: 없음
>
> 아래 본문은 **요청 당시 원문**입니다. 확정된 최신 값은 계약 문서를 보세요.

- 작성: AI · 2026-08-25
- 관련 문서: `../../03-infra-ops/deployment-and-uptime.md` §3, `../../02-architecture/internal-api-contract.md`, `../../05-planning/roadmap.md`

## 1. `INTERNAL_TOKEN`을 지금 주세요 — 시점이 당겨졌습니다

로드맵에는 **"Phase 3 착수 전"** 으로 잡혀 있는데(`../../05-planning/roadmap.md`), **배포가 그보다 먼저 일어납니다.** 토큰을 배포 시점에 환경변수로 넣어야 해서 지금 필요합니다.

- 값: **32자 이상 랜덤** (기존 합의 그대로)
- 전달: **팀 채널로만.** 문서·저장소에 남기지 않습니다 (`../../response/backend/image-transfer-and-internal-auth.md`에서 합의한 대로)
- 제 쪽 등록: Google Cloud Secret Manager. 코드에도 저장소에도 값이 들어가지 않습니다

**토큰 없이도 배포 자체는 됩니다** — 그 경우 `/internal/health`(무인증)만 확인 가능하고, 실제 계약 호출(401/200)이 제대로 도는지 확인할 수 없습니다. 그래서 배포와 동시에 받는 것이 좋습니다.

> 굳이 백엔드가 생성해야 하는 값은 아닙니다. **제가 생성해서 드리는 편이 빠르면 그렇게 하겠습니다** — 회신에 "AI가 생성해 달라"고만 적어 주세요. 기존 문서에 백엔드 담당으로 적혀 있어 임의로 바꾸지 않고 여쭙습니다.

## 2. `AI_SERVER_URL` 도메인이 바뀝니다 — `*.onrender.com`이 아닙니다

**AI-server 배포처를 Render Starter → Google Cloud Run(무료 한도)으로 변경했습니다.** 규칙대로 공용 문서를 먼저 고쳤습니다: `../../03-infra-ops/deployment-and-uptime.md` §3, `../../00-context/prd.md` §8.3·8.5.

| 항목 | 내용 |
| --- | --- |
| 백엔드가 겪는 변화 | **`AI_SERVER_URL`의 도메인이 `*.run.app`이 되는 것뿐입니다** |
| 내부 API 계약 | **변경 없음** — 경로·헤더·스키마·오류 코드 전부 그대로 |
| 킵얼라이브 | `GET {AI_SERVER_URL}/internal/health` 그대로 (무인증 200) |
| 타임아웃·재시도 | 그대로 (추출 20s / 소명서 15s, 1회 재시도) |
| 비용 | AI-server 인프라 $7/월 → **$0**. 백엔드도 이후 Free+크론으로 전환해 팀 총액 월 $14 → **$0** (2026-08-25 ②, `../../response/backend/deployment-domain.md` 이후 팀 결정) |

**백엔드가 할 일은 없습니다.** URL 값만 나중에 받으시면 됩니다. 다만 Phase 6 문서(`backend/docs/phase-6-infra-ops.md`)에 Render 전제로 적어두신 게 있으면 이 참에 확인해 주세요.

배포하는 즉시 팀 채널에 아래 형식으로 드리겠습니다.

```
AI_SERVER_URL  = https://haebing-ai-server-<해시>-du.a.run.app
헬스체크        = GET {AI_SERVER_URL}/internal/health  (무인증 200)
```

## 3. `field_confidence`가 `null`일 때의 해석 규칙을 확인해 주세요

회신 §6의 지적(값이 없는데 신뢰도가 `high`)을 반영하면서, **계약에 해석 규칙을 하나 적었습니다.** 백엔드 구현에 영향이 있어 확인이 필요합니다 — `../../02-architecture/internal-api-contract.md` "신뢰도의 `null`" 절.

| 필드 | 신뢰도 `null` | 백엔드가 할 것 |
| --- | --- | --- |
| `counterparty_name` · `payer_name` | **허용** — 이름이 `null`이면 신뢰도도 `null` | 그대로 처리 (어차피 둘 다 값이 있을 때만 대조) |
| `occurred_at` · `actor` · `amount` | **불허** — 항상 3값 | **값이 `null`인 필드의 신뢰도는 읽지 마세요** |

**확인 요청 사항**: `amount`가 `null`인 카드(금액이 없는 대화 캡처, 흐려서 못 읽은 금액)의 `field_confidence.amount`는 의미 없는 값입니다. **FR-028의 "low 신뢰도면 Stage 3 진입 차단"을 값이 있는 카드에만 적용**해 주시는 게 맞는지 확인 부탁드립니다.

- "금액을 못 읽었다"의 단일 출처는 **`amount == null`** 입니다
- "날짜를 못 읽었다"는 **`occurred_at == null`** 과 **`qualityFlags[event_id].missing_date`** 입니다

이름 신뢰도를 `null`로 만드는 것은 **AI-server가 후처리에서 결정적으로 보장**합니다. LLM에게 "값이 없으면 신뢰도를 비우라"고 시키지 않았습니다 — 프롬프트 준수는 확률적이라 불변식이 되지 않기 때문입니다(이름 마스킹을 기각한 것과 같은 이유).

## 4. 데모 세트를 다시 받아 가세요 — v1 → v1.1

`ai-server/demo/`를 `backend/src/main/resources/demo/`로 복사하는 작업이 아직이라면 **지금 것을 받으시면 됩니다.** 이미 복사하셨다면 다시 받아 주세요.

| 변경 | 이유 |
| --- | --- |
| 이름이 `null`인 카드 18곳의 `field_confidence`를 `null`로 정정 | §3의 그 버그가 픽스처에도 있었습니다 |
| `박OO` → `박서준` (`extract-tc03.json`, `draft-tc03.json`) | 부분 마스킹 기각이 확정됐는데 데모가 마스킹된 이름을 보여주면 반대로 구현하실 수 있습니다 |

앞으로 이 폴더가 계약과 어긋나면 **AI 쪽 테스트(`ai-server/tests/test_demo_set.py`)가 깨지도록** 해 뒀습니다. 조용히 낡는 일은 없습니다.

> `imageIndex`·`bbox`는 여전히 실제 데모 이미지와 동기화되지 않은 값입니다. 9/1~9/2 리허설에서 데모 이미지 4장이 확정되면 **v2로 재생성**해 드립니다 (기존 합의 그대로).

## 회신에 담아 주실 것

1. `INTERNAL_TOKEN` — 팀 채널로 전달, 또는 "AI가 생성해 달라"
2. §2 도메인 변경 확인 (백엔드 문서에 Render 전제가 남아 있는지)
3. §3 `field_confidence` `null` 해석 규칙 확인
4. §4 데모 세트 v1.1 재복사 여부
