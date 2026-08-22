# API 계약 (Frontend ↔ Backend)

> 출처: `00-context/prd.md` §9, §4.2 FR-021. 이 문서가 프론트엔드와 백엔드 사이의 실제 계약입니다. 엔드포인트를 바꾸면 이 문서를 먼저 고치고 상대 역할에게 알리세요.

## 엔드포인트 목록

| Method | Path | 설명 | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/session` | 세션 생성 | — | `{ sessionHash, expiresAt }` |
| POST | `/api/intake` | 문진 저장 | `{ when, amount, kind, history, usage }` | `{ ok, nextStage }` |
| POST | `/api/evidence` | 이미지 업로드 + 판독 | `multipart[]` (최대 10장, JPG/PNG) | `{ extracted: [...], signals }` |
| POST | `/api/evidence/text` | 텍스트 대체 입력 | `{ rawText }` | `{ extracted: [...] }` |
| GET | `/api/timeline` | 타임라인 조회 | — | `{ events: [...], gaps: [...] }` |
| POST | `/api/verdict` | 판정 실행 | — | `{ reason, criteria, verdict, estimatedDays }` |
| POST | `/api/draft` | 소명서 생성 | — | `{ draftText, checklist: [...] }` |
| GET | `/api/draft/pdf` | PDF 내보내기 | — | `application/pdf` |
| DELETE | `/api/session` | 세션 즉시 파기 | — | `204` |
| GET | `/actuator/health` | 헬스체크 (킵얼라이브용) | — | `{ status: "UP" }` |

세션은 쿠키 또는 헤더로 전달되는 `sessionHash`로 식별됩니다. 구체적 전달 방식(쿠키 vs 커스텀 헤더)은 FE/BE가 착수 전 확정하고 이 문서에 추가하세요. *(→ TODO: 확정 후 이 줄 삭제)*

## `/api/intake` 요청 필드 정의

| 필드 | 타입 | 값 | 비고 |
| --- | --- | --- | --- |
| `when` | string | 정지 시점 (자유 형식 또는 날짜) | |
| `amount` | enum | `under_50` \| `50_to_300` \| `over_300` (단위: 만원) | `01-product/reason-type-rules.md`의 소액요건과 직결 |
| `kind` | enum | `goods` \| `service` \| `debt` \| `unknown` | 사유유형 4종에 대응 |
| `history` | boolean | 과거 지급정지 이력 여부 | 이력요건 |
| `usage` | enum | `main` \| `occasional` | 생계요건의 입력값 중 하나 |

## `/api/evidence` 응답 — 추출 이벤트 스키마 (FR-021)

```json
{
  "source_type": "chat | bank | shipping | threat | autopay | unknown",
  "events": [
    {
      "occurred_at": "2026-09-02T14:12:00+09:00",
      "occurred_at_confidence": "high | medium | low",
      "actor": "self | counterparty | system",
      "summary": "구매 문의 수신 — 물품 상태 질의",
      "amount": null,
      "identifiers": { "tracking_no": null, "account_last4": null }
    }
  ],
  "signals": {
    "threat_detected": false,
    "delivery_evidence": true,
    "life_activity": false
  }
}
```

`signals.threat_detected: true`가 오면 프론트엔드는 즉시 협박 대응 배너(FR-024)를 노출해야 합니다 — 사용자가 다음 단계로 넘어가길 기다리지 않습니다.

## `/api/verdict` 응답

```json
{
  "reason": "goods | service | debt | unclear",
  "criteria": {
    "amount": "met | unmet | unknown",
    "history": "met | unmet",
    "livelihood": "met | unmet | unknown"
  },
  "verdict": "partial_release_possible | more_evidence_needed | likely_rejected",
  "estimatedDays": "5 | 5+5 | 5+5+3 | formal_process"
}
```

`verdict`가 `likely_rejected`일 때 프론트엔드는 `01-product/reason-type-rules.md` §4에 정의된 정직한 안내 문구를 그대로 노출합니다. 낙관적으로 순화하지 않습니다.

## 공통 오류 응답

```json
{
  "error": "EXTRACTION_FAILED",
  "message": "이미지에서 내용을 읽지 못했습니다.",
  "fallback": "/api/evidence/text"
}
```

| error 코드 | 상황 | 프론트엔드 처리 |
| --- | --- | --- |
| `EXTRACTION_FAILED` | 이미지 판독 실패 | 텍스트 입력 경로(`/api/evidence/text`)로 안내 |
| `TIMEOUT` | 20초 초과 | 부분 결과 표시 + "일부 자료를 읽지 못했습니다" |
| `SESSION_EXPIRED` | TTL 30분 초과 | 세션 재생성 후 처음부터 안내 |
| `QUOTA_EXCEEDED` | LLM API 쿼터 초과 | 오프라인 데모 모드로 전환 (발표 대비, `04-testing/test-cases-and-demo.md` 참조) |

## 변경 이력

이 문서를 수정하면 아래에 한 줄씩 남기세요.

- v1.0 (2026-08-22): PRD 기준 최초 작성
