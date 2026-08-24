# [백엔드 → AI] 내부 API 이미지 전달 방식 확정 및 인증 토큰 공유

> **상태: ⏳ 회신 대기** (요청 2026-08-23)
> 회신은 `../../response/backend/image-transfer-and-internal-auth.md`에 들어옵니다.
> **막고 있는 작업**: Phase 3 `AiClient.extract()` 본문 직렬화 (`../../../backend/docs/phase-3-evidence-timeline.md`)

- 작성: 백엔드 · 2026-08-23
- 관련 문서: `../../02-architecture/internal-api-contract.md`

## 1. 이미지 전달 방식 A/B 확정 요청 (회신 필요)

`internal-api-contract.md`의 `POST /internal/extract` 요청 절이 `[결정: TODO — A/B 중 선택 후 이 블록 갱신]` 상태입니다. 이게 정해지지 않으면 백엔드의 `AiClient.extract()` 본문 직렬화를 구현할 수 없습니다.

| 안 | 내용 |
| --- | --- |
| A | 백엔드가 받은 이미지 바이트를 그대로 멀티파트로 포워딩 |
| B | base64로 인코딩해 JSON 본문에 담아 전달 |

**백엔드 의견**: Render 512MB RAM 제약에서 base64는 본문이 약 33% 커지고 인코딩 버퍼가 한 번 더 뜹니다(이미지 10장 동시 업로드 시 부담). 다만 AI-server 스택 사정이 우선이니 편한 쪽을 알려주세요.

**회신 방법**: 정하신 안을 `internal-api-contract.md`의 해당 블록에 직접 반영하고 변경 이력에 남겨주세요.

## 2. 내부 API 인증 방식 (백엔드 결정 사항 통보)

같은 문서의 인증 절 체크박스를 다음으로 확정했습니다.

- 백엔드는 모든 `/internal/*` 호출에 헤더 **`X-Internal-Token`** 을 붙입니다. 값은 양쪽 환경변수 `INTERNAL_TOKEN`으로 공유합니다.
- **AI-server는 이 헤더가 없거나 값이 다르면 401로 거부**해 주세요.
- **예외**: `GET /internal/health`는 토큰 없이 접근 가능해야 합니다. 외부 헬스체크 도구(cron-job.org 등)가 직접 호출하는 킵얼라이브 용도이기 때문입니다 (`../../03-infra-ops/deployment-and-uptime.md` §3).

Render는 고정 아웃바운드 IP를 보장하지 않아 IP 허용목록 방식은 선택하지 않았습니다.

## 3. 참고 — 백엔드가 지키는 값

| 항목 | 값 | 근거 |
| --- | --- | --- |
| `/internal/extract` 타임아웃 | 20초 | 계약 문서 |
| `/internal/draft` 타임아웃 | 15초 | 계약 문서 |
| 재시도 | 1회, 동일 요청 재전송 | 계약 문서 |

또한 AI-server 오류 응답의 `fallback: "text_input"`은 백엔드가 프론트에 전달할 때 `"/api/evidence/text"`로 치환합니다(내부 경로 비노출).

## 4. 참고 — 백엔드가 AI 응답을 쓰지 않는 항목 2가지

시간을 아끼시라고 알려드립니다. 아래 두 값은 **AI-server가 채워 보내도 백엔드가 사용하지 않습니다.**

| 값 | 이유 |
| --- | --- |
| `/internal/draft` 응답의 `checklist` | **첨부 서류 체크리스트(F7-03)의 담당이 `A`(백엔드)** 이고 내용이 결정적(사유별 고정 목록 + 보유 여부)입니다. Stage 3 준비도 화면과 Stage 4 소명서 화면이 서로 다른 체크리스트를 보여주면 안 되므로 백엔드가 한 소스로 채웁니다. 스키마 호환을 위해 필드는 남겨두되 빈 배열로 보내셔도 됩니다 |
| `quality_flags.amount_mismatch` | **여러 자료를 함께 봐야** 알 수 있는 값이라 이미지를 1장씩 보는 AI-server가 구조적으로 판단할 수 없습니다. F4-07 처리 절차상으로도 "서버에서 자료 간 금액 교차 대조"로 되어 있어 **백엔드가 카드 간 금액을 대조해 세웁니다.** 이미지 1장 안에서 판단 가능한 `blurry` / `missing_date`는 기존대로 AI가 산출해 주세요 |

반대로 **반드시 AI가 채워주셔야 하는 값**은 `signals.threat_detected`(협박 감지 — 백엔드가 즉시 프론트로 흘립니다), `field_confidence`(게이팅 기준), `source_region`(문장-근거 연결)입니다.
