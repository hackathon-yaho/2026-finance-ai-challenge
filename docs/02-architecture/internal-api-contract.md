# 내부 API 계약 (Backend ↔ AI-server)

> **수정 기록 (2026-08-23, 백엔드)**
> - "인증 (착수 전 확정 필요)" 절 → 공유 시크릿 헤더 `X-Internal-Token` 확정 내용으로 대체. `/internal/health`는 무인증 공개 예외로 명시
> - 하단 체크리스트의 인증 항목 완료 처리, 이미지 전달 방식(A/B) 항목에 요청 문서 링크 추가
> - **이미지 전달 방식(A/B)은 여전히 미확정**입니다 — AI 담당 회신 대기

> 출처: `../00-context/prd.md` §9.1. 이 문서는 **백엔드와 AI 개발자 사이의 계약**입니다. `api-contract.md`(프론트-백엔드 공개 API)와는 별개입니다.
>
> 배경: AI 파이프라인이 백엔드에서 분리되어 독립 배포되는 별도 서버(AI-server)가 되었습니다. 프론트엔드는 이 API를 직접 호출하지 않습니다 — 항상 백엔드를 거칩니다.

## 엔드포인트

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/internal/extract` | 이미지(또는 텍스트) → 구조화된 카드(이벤트) + signals + qualityFlags |
| POST | `/internal/draft` | 타임라인 + 준비도 결과 → 소명서 초안 + 문장-근거 연결 + 사실검증 결과 |
| GET | `/internal/health` | AI-server 헬스체크 (킵얼라이브용, 외부 헬스체크 도구가 직접 호출) |

## 인증 (2026-08-23 확정)

**공유 시크릿 헤더 `X-Internal-Token`** 을 사용합니다. Render는 고정 아웃바운드 IP를 보장하지 않아 IP 허용목록 방식은 채택하지 않았습니다.

- 백엔드는 모든 `/internal/*` 호출에 헤더 `X-Internal-Token`을 부착합니다. 값은 양쪽 환경변수 `INTERNAL_TOKEN`으로 공유합니다.
- AI-server는 이 헤더가 없거나 값이 다르면 **401로 거부**합니다.
- **예외: `GET /internal/health`는 토큰 없이 접근 가능해야 합니다.** 외부 헬스체크 도구가 직접 호출하는 킵얼라이브 용도이기 때문입니다(`../03-infra-ops/deployment-and-uptime.md` §3).

- [x] 인증 방식 확정
- [ ] AI-server 측 401 검증 구현 (AI 담당)

## `POST /internal/extract`

### 요청

이미지 전달 방식은 두 가지 중 하나로 결정합니다(착수 전 백엔드·AI 협의):

- **(A) 멀티파트 포워딩**: 백엔드가 받은 이미지 바이트를 그대로 AI-server에 멀티파트로 전달 (원본은 클라이언트에서 이미 리사이즈·마스킹이 끝난 상태)
- **(B) Base64 JSON**: 이미지를 base64로 인코딩해 JSON 본문에 담아 전달

```
[결정: TODO — A/B 중 선택 후 이 블록 갱신]
```

### 응답 — 추출 카드 스키마

`api-contract.md`의 FR-021/FR-028 스키마와 동일합니다 (외부 API 응답과 내부 API 응답이 같은 형식을 씁니다 — 백엔드는 이 응답을 거의 그대로 프론트에 전달만 합니다).

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
      "confirmation_status": "pending"
    }
  ],
  "signals": {
    "threat_detected": false,
    "delivery_evidence": true,
    "life_activity": false,
    "quality_flags": { "blurry": false, "missing_date": false, "amount_mismatch": false }
  }
}
```

`signals.threat_detected: true`는 백엔드가 받는 즉시 프론트엔드에 전달되어야 하는 신호입니다 — 백엔드가 버퍼링하거나 다음 단계까지 지연시키지 않습니다.

## `POST /internal/draft`

### 요청

```json
{
  "events": [ /* 타임라인 이벤트 배열, confirmed=true 카드만 */ ],
  "reason": "goods | service | debt | unclear",
  "readiness": "SUBMISSION_READY | SUPPLEMENT_NEEDED | BANK_CHECK_REQUIRED"
}
```

`reason`, `readiness`는 백엔드의 `ReadinessService`가 이미 결정한 값을 그대로 전달합니다. **AI-server는 이 값을 재해석하거나 다시 판단하지 않습니다** — 문장 생성에만 사용합니다.

### 응답

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
  "checklist": [ { "item": "거래 대화 캡처", "have": true } ],
  "factCheckPassed": true
}
```

`evidenceRefs`는 이미지 파일이 아니라 **참조(imageIndex, bbox)만** 담습니다 — AI-server도 원본 이미지를 갖고 있지 않으므로(LLM 호출 후 즉시 폐기) 참조만 넘길 수 있습니다. `factCheckPassed: false`이면 백엔드는 이 응답을 그대로 프론트에 전달하지 않고 재시도 로직(`../00-context/prd.md` §10.3)을 따릅니다.

## 오류 응답 (공개 API와 동일한 형식 재사용)

```json
{
  "error": "EXTRACTION_FAILED",
  "message": "이미지에서 내용을 읽지 못했습니다.",
  "fallback": "text_input"
}
```

백엔드는 이 오류를 받으면 공개 API 응답의 `fallback` 필드를 `/api/evidence/text`로 바꿔서 프론트에 전달합니다 (내부 경로를 외부에 노출하지 않음).

## 타임아웃 및 재시도

| 항목 | 값 |
| --- | --- |
| `/internal/extract` 타임아웃 | 20초 (PRD NFR-01 기준) |
| `/internal/draft` 타임아웃 | 15초 |
| 백엔드의 재시도 정책 | 1회, 동일 요청 재전송. 실패 시 오류 응답을 그대로 프론트에 전달 |

## 체크리스트

- [x] 인증 방식 확정 (`X-Internal-Token`) — AI-server 측 검증 구현은 진행 중
- [ ] 이미지 전달 방식(A/B) 확정 — 요청서: `../request/ai/image-transfer-and-internal-auth.md`
- [ ] AI-server가 `/internal/*` 응답 스키마를 `api-contract.md`와 동일하게 맞췄는지 확인 — 스키마가 둘로 갈라지면 백엔드가 매번 변환 코드를 짜야 합니다
- [ ] `/internal/health`가 외부 헬스체크 도구에서 접근 가능한지 확인 (킵얼라이브 목적이므로 이 엔드포인트만은 공개되어야 함)
- [ ] AI-server도 이미지를 처리 완료 즉시 폐기하는지 확인 (원본이 AI-server에도 남지 않아야 함, `../03-infra-ops/privacy-and-safety.md` 참조)
