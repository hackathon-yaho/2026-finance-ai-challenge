# 내부 API 계약 (Backend ↔ AI-server)

> 출처: `../00-context/prd.md` §9.1. 이 문서는 **백엔드와 AI 개발자 사이의 계약**입니다. `api-contract.md`(프론트-백엔드 공개 API)와는 별개입니다.
>
> 배경: AI 파이프라인이 백엔드에서 분리되어 독립 배포되는 별도 서버(AI-server)가 되었습니다. 프론트엔드는 이 API를 직접 호출하지 않습니다 — 항상 백엔드를 거칩니다.

## 엔드포인트

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/internal/extract` | 이미지(또는 텍스트) → 구조화된 이벤트 + signals |
| POST | `/internal/draft` | 타임라인 + 판정 결과 → 소명서 초안 + 사실검증 결과 |
| GET | `/internal/health` | AI-server 헬스체크 (킵얼라이브용, 외부 헬스체크 도구가 직접 호출) |

## 인증 (착수 전 확정 필요)

- [ ] 공유 시크릿 헤더(예: `X-Internal-Token`) 또는 네트워크 레벨 차단(허용 IP만) 중 방식 결정
- [ ] AI-server가 인터넷에 공개되어 있다면, `/internal/*` 경로는 백엔드 외 요청을 거부하도록 구현
- [ ] 결정된 방식을 이 문서에 추가

## `POST /internal/extract`

### 요청

이미지 전달 방식은 두 가지 중 하나로 결정합니다(착수 전 백엔드·AI 협의):

- **(A) 멀티파트 포워딩**: 백엔드가 받은 이미지 바이트를 그대로 AI-server에 멀티파트로 전달
- **(B) Base64 JSON**: 이미지를 base64로 인코딩해 JSON 본문에 담아 전달

```
[결정: TODO — A/B 중 선택 후 이 블록 갱신]
```

### 응답 — 추출 이벤트 스키마

`api-contract.md`의 FR-021 스키마와 동일합니다 (외부 API 응답과 내부 API 응답이 같은 형식을 씁니다 — 백엔드는 이 응답을 거의 그대로 프론트에 전달만 합니다).

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

`signals.threat_detected: true`는 백엔드가 받는 즉시 프론트엔드에 전달되어야 하는 신호입니다 — 백엔드가 버퍼링하거나 다음 단계까지 지연시키지 않습니다.

## `POST /internal/draft`

### 요청

```json
{
  "events": [ /* 타임라인 이벤트 배열 */ ],
  "reason": "goods | service | debt | unclear",
  "criteria": { "amount": "met|unmet|unknown", "history": "met|unmet", "livelihood": "met|unmet|unknown" },
  "verdict": "partial_release_possible | more_evidence_needed | likely_rejected"
}
```

`reason`, `criteria`, `verdict`는 백엔드의 `VerdictService`가 이미 결정한 값을 그대로 전달합니다. **AI-server는 이 값을 재해석하거나 다시 판단하지 않습니다** — 문장 생성에만 사용합니다.

### 응답

```json
{
  "draftText": "...",
  "checklist": [ { "item": "거래 대화 캡처", "present": true }, ... ],
  "factCheckPassed": true
}
```

`factCheckPassed: false`이면 백엔드는 이 응답을 그대로 프론트에 전달하지 않고 재시도 로직(`../00-context/prd.md` §10.3)을 따릅니다.

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

- [ ] 인증 방식 확정 및 구현 (백엔드·AI 양쪽)
- [ ] 이미지 전달 방식(A/B) 확정
- [ ] AI-server가 `/internal/*` 응답 스키마를 `api-contract.md`와 동일하게 맞췄는지 확인 — 스키마가 둘로 갈라지면 백엔드가 매번 변환 코드를 짜야 합니다
- [ ] `/internal/health`가 외부 헬스체크 도구에서 접근 가능한지 확인 (킵얼라이브 목적이므로 이 엔드포인트만은 공개되어야 함)
