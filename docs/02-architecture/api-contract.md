# API 계약 (Frontend ↔ Backend)

> 출처: `../00-context/prd.md` §9, `../00-context/spec.md` §4. 이 문서가 프론트엔드와 백엔드 사이의 실제 계약입니다. 엔드포인트를 바꾸면 이 문서를 먼저 고치고 상대 역할에게 알리세요.
>
> 백엔드는 독립 배포되는 Spring Boot 서비스이며, AI 파이프라인(추출·소명서 생성)은 별도 배포되는 AI-server가 담당합니다(`system-architecture.md` 참조). 프론트엔드는 아래 공개 API만 호출하며, 백엔드↔AI-server 사이의 내부 API(`internal-api-contract.md`)는 직접 호출하지 않습니다.

## 엔드포인트 목록

| Method | Path | 설명 | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/session` | 세션 생성 | — | `{ sessionHash, expiresAt }` |
| POST | `/api/intake` | 문진 저장 | `{ when, dueNoticeStatus, dueNoticeDate, amount, kind, history, usage }` | `{ ok, nextStage }` |
| POST | `/api/evidence` | 이미지 판독 (메모리 통과, 서버 미저장) | `multipart[]` (최대 10장, JPG/PNG, 클라이언트에서 리사이즈·마스킹 완료된 상태) | `{ cards: [...], signals, qualityFlags }` |
| POST | `/api/evidence/confirm` | 추출 카드 확인·수정 저장 (FR-028) | `{ cardId, confirmed, corrections }` | `{ ok, confirmedCount, unconfirmedCount }` |
| POST | `/api/evidence/text` | 텍스트 대체 입력 | `{ rawText }` | `{ cards: [...] }` |
| GET | `/api/timeline` | 타임라인 조회 | — | `{ events: [...], gaps: [...] }` |
| POST | `/api/readiness` | 제출 준비도 점검 실행 | — | `{ reason, checklist, readiness, missingItems, conflicts, notices, urgentAlert }` |
| POST | `/api/draft` | 소명서 생성 | — | `{ draftText, sentences: [{ sentenceId, text, evidenceRefs: [...] }], checklist: [...] }` |
| GET | `/api/package/text` | 제출 패키지 텍스트 5종 PDF 생성 (FR-047) | — | `application/pdf` |
| DELETE | `/api/session` | 세션 즉시 파기 | — | `204` |
| GET | `/actuator/health` | 헬스체크 (킵얼라이브용, DB 활동 포함) | — | `{ status: "UP", db: "OK" }` |

세션은 쿠키 또는 헤더로 전달되는 `sessionHash`로 식별됩니다. 구체적 전달 방식(쿠키 vs 커스텀 헤더)은 FE/BE가 착수 전 확정하고 이 문서에 추가하세요. *(→ TODO: 확정 후 이 줄 삭제)*

## `/api/intake` 요청 필드 정의

문진은 6개 항목입니다(`../00-context/spec.md` F2-01).

| 필드 | 타입 | 값 | 비고 |
| --- | --- | --- | --- |
| `when` | string \| null | 지급정지일 (날짜, 모르면 null) | **FR-014 기한 계산 입력** |
| `dueNoticeStatus` | enum | `notified` \| `not_yet` \| `unknown` | 채권소멸절차 개시 공고 상태. `notified`면 `dueNoticeDate` 필요 |
| `dueNoticeDate` | string \| null | 공고일 (날짜) | **FR-014 기한 계산 입력** — 기한 = 공고일 + 2개월 |
| `amount` | number \| null | 문제 입금액 (원 단위, 모르면 null) | **사실 기재 전용.** 준비도 판정에 사용하지 않음 (`../01-product/reason-type-rules.md` §2) |
| `kind` | enum | `goods` \| `service` \| `debt` \| `unclear` | 사유유형 4종에 대응 |
| `history` | boolean | 과거 지급정지 이력 여부 | `은행기준미상` 신호의 입력값 |
| `usage` | enum | `main` \| `occasional` \| `rare` | 생계 흔적 증빙 점검 보조 |

## `/api/evidence` 응답 — 추출 카드 스키마 (FR-021, FR-028)

```json
{
  "cards": [
    {
      "event_id": "evt_001",
      "source_image_index": 2,
      "occurred_at": "2026-09-02T14:12:00+09:00",
      "actor": "self | counterparty | system",
      "summary": "물품대금 700,000원 입금",
      "amount": 700000,
      "identifiers": { "tracking_no": null, "account_last4": null },
      "field_confidence": {
        "occurred_at": "high | medium | low",
        "actor": "high | medium | low",
        "amount": "high | medium | low"
      },
      "source_region": { "x": 0.18, "y": 0.31, "w": 0.62, "h": 0.12 },
      "confirmation_status": "pending | user_confirmed | user_corrected"
    }
  ],
  "signals": {
    "threat_detected": false,
    "delivery_evidence": true,
    "life_activity": false,
    "quality_flags": { "blurry": false, "missing_date": false, "amount_mismatch": false }
  },
  "qualityFlags": {
    "evt_001": { "blurry": false, "missing_date": false, "amount_mismatch": false }
  }
}
```

`signals.threat_detected: true`가 오면 프론트엔드는 즉시 협박 대응 배너(FR-024)를 노출해야 합니다 — 사용자가 다음 단계로 넘어가길 기다리지 않습니다.

날짜 또는 금액이 `low` 신뢰도인 카드가 `confirmation_status: "pending"`으로 남아 있으면, 프론트엔드는 Stage 3(`/api/readiness`) 진입을 차단하고 확인을 요구합니다(FR-028).

## `/api/evidence/confirm` 요청

```json
{
  "cardId": "evt_001",
  "confirmed": true,
  "corrections": { "amount": 700000 }
}
```

`confirmed: true`인 카드만 `ReadinessService`와 `/api/draft`(DraftService)의 입력으로 사용됩니다. 사용자가 값을 고치면 백엔드는 해당 카드에 "사용자 수정" 표시를 남깁니다.

## `/api/readiness` 응답

```json
{
  "reason": "goods | service | debt | unclear",
  "checklist": [
    { "item": "거래 대화 내역", "status": "met | unmet | unknown" }
  ],
  "readiness": "SUBMISSION_READY | SUPPLEMENT_NEEDED | BANK_CHECK_REQUIRED",
  "missingItems": ["물품 발송 증빙"],
  "conflicts": [],
  "notices": ["최종 판단은 은행이 합니다"],
  "urgentAlert": false
}
```

- `readiness`가 `BANK_CHECK_REQUIRED`일 때 프론트엔드는 `../01-product/reason-type-rules.md` §3에 정의된 정직한 안내 문구를 그대로 노출합니다. 낙관적으로 순화하지 않습니다.
- `notices`에는 세 상태 공통으로 "최종 판단은 은행이 합니다"가 항상 포함됩니다 — 프론트엔드는 이 문구를 생략하지 않습니다.
- `urgentAlert`는 협박 감지 여부이며 `readiness`와 독립적으로 산출됩니다.

## `/api/draft` 응답 — 문장-근거 연결 (FR-046)

```json
{
  "draftText": "...",
  "sentences": [
    {
      "sentenceId": "s1",
      "text": "2026년 9월 1일 물품대금 450,000원을 입금받았습니다.",
      "evidenceRefs": [
        { "type": "evidence", "imageIndex": 2, "bbox": { "x": 0.18, "y": 0.31, "w": 0.62, "h": 0.12 } }
      ]
    }
  ],
  "checklist": [
    { "item": "거래 대화 캡처", "have": true }
  ]
}
```

`evidenceRefs`는 **이미지 파일이 아니라 참조(imageIndex, bbox)만** 담습니다. 원본 이미지는 서버에 없으므로, 프론트엔드가 자기 브라우저 메모리의 blob 배열에서 `imageIndex`로 찾아 표시하고 `bbox`가 있으면 해당 영역으로 스크롤합니다. 원본이 메모리에 없으면(새로고침 등) 배지를 회색 처리하고 "원본을 다시 올리면 확인할 수 있습니다"를 표시합니다.

## `/api/package/text` — 제출 패키지 (FR-047)

서버는 **텍스트 기반 5종**(별지 제4호서식 작성 지원본 / 사실관계 진술서 / 타임라인 / 증빙목록 / 부족자료 체크리스트)만 PDF로 생성합니다. 원본 이미지 페이지는 서버가 만들지 않습니다 — 프론트엔드가 이 응답에 브라우저 blob으로 만든 이미지 페이지를 `pdf-lib`으로 병합해 최종 6종 패키지를 완성합니다(`../00-context/spec.md` F7-06).

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
| `SESSION_EXPIRED` | TTL 30분 초과 (`410 Gone`) | 세션 재생성 후 처음부터 안내. 원본 이미지는 서버에 없었으므로 재업로드 필요 |
| `QUOTA_EXCEEDED` | LLM API 쿼터 초과 | 오프라인 데모 모드로 전환 (발표 대비, `../04-testing/test-cases-and-demo.md` 참조) |

## 변경 이력

이 문서를 수정하면 아래에 한 줄씩 남기세요.

- v1.0 (2026-08-22): PRD 기준 최초 작성
- v1.1 (2026-08-23): 새 PRD/기능명세서 기준으로 재정렬 (3서비스 독립 배포 유지). `/api/verdict` → `/api/readiness`, `/api/draft/pdf` → `/api/package/text`로 개명. `/api/evidence/confirm` 신설(FR-028). 문진 필드에 채권소멸절차 공고일 추가(FR-014)
