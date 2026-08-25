# [백엔드 → 프론트] Phase 3 구현 중 계약에 없던 4가지를 채웠습니다 — 확인 부탁드립니다

> **상태: ✅ 회신 완료 (2026-08-26)**
> - 회신: `../../response/backend/evidence-timeline-schema-additions.md`
> - **결론 요약**: 4건 전부 수용 — `imageIndex` 필수 인자화, `gaps` 스키마 타입 정의, 카드 삭제 `confirmed: false` 유니온, 병합 방식 확인
> - **남은 것**: **확인 1건** — `imageIndex`가 세션 누적 기준인지(두 번째 배치가 2부터 시작), 중복 인덱스 동작
>
> 아래 본문은 **요청 당시 원문**입니다.

- 작성: 백엔드 · 2026-08-26
- 관련 문서: `../../02-architecture/api-contract.md` v1.8 (2026-08-25 ④ 변경분), `../../../backend/docs/phase-3-evidence-timeline.md`

Phase 3(증거 판독·타임라인)를 구현하면서, 계약 문서(`api-contract.md`)에 **없던 부분 4가지를 백엔드가 임의로 채웠습니다.** 아무도 합의한 적 없는 값이라 프론트 확인이 꼭 필요합니다. AI 쪽에는 영향이 없어 공유하지 않았습니다 — 이유는 각 항목 끝에 적었습니다.

## 1. `POST /api/evidence`에 `imageIndex` 필드가 새로 필요합니다

**문제**: `internal-api-contract.md`가 AI-server로 보내는 `image_index`는 "프론트 blob 배열 인덱스와 일치해야 한다"고 못 박고 있는데, 프론트는 이미지를 **1장씩 병렬로(최대 4 동시) 호출**합니다. 응답이 도착하는 순서는 네트워크 사정에 따라 원래 배열 순서와 달라질 수 있어서, **백엔드가 도착 순서로 인덱스를 매기면 프론트의 blob 배열과 어긋납니다.**

**해결**: 파일을 보낼 때 그 파일의 원래 blob 배열 인덱스(0-base)를 `imageIndex` 필드로 같이 보내주세요.

```
POST /api/evidence
Content-Type: multipart/form-data

files: <이미지 바이트>
imageIndex: 2
```

- 여러 장을 한 요청에 담으면 `files`와 `imageIndex` 개수가 같아야 합니다 (순서대로 짝을 이룹니다)
- 이미 이 엔드포인트를 호출하도록 만들어 두셨다면 **이 필드만 추가**하면 됩니다

**AI 쪽에 공유하지 않은 이유**: AI-server가 받는 `image_index` 쿼리 파라미터 자체는 기존 계약 그대로입니다. 백엔드가 그 값을 어디서 받아오는지(자체 채번 vs 프론트가 알려줌)만 바뀐 것이라 AI-server 입장에서는 아무것도 달라지지 않습니다.

## 2. `gaps` 항목 스키마를 정의했습니다

**문제**: 계약에 `gaps: []`만 있고 각 항목이 어떤 모양인지 정의가 없었습니다.

**해결**:

```json
{ "type": "no_delivery_evidence", "label": "발송 증빙 없음", "suggestions": ["택배사 조회 화면", "수령 확인"] }
```

| `type` | 조건 | `label` | `suggestions` |
| --- | --- | --- | --- |
| `no_delivery_evidence` | 재화 거래인데 발송 증빙 없음 (직거래면 안 뜸) | 발송 증빙 없음 | 택배사 조회 화면 · 수령 확인 |
| `no_service_evidence` | 용역 거래인데 결과물 전달 증빙 없음 | 용역 증빙 없음 | 결과물 파일 · 전달 기록 |
| `no_life_activity` | 계좌 사용이 주 거래가 아닌데 생계 흔적 없음 | 생계 흔적 없음 | (없음) |
| `no_chat_evidence` | 대화 내역(채팅 유형 카드)이 아예 없음 | 거래 합의 증빙 없음 | 이메일 · 문자 · 통화 기록 |

`spec.md` F5-03 표시 규칙(타임라인 빈 노드 + 안내 문구 + `[추가하기]` 버튼)에 맞춰 렌더하시면 됩니다. `type`은 화면 분기용, `label`은 그대로 보여줄 문구, `suggestions`는 F5-04 대체 증빙 제안입니다.

**AI 쪽에 공유하지 않은 이유**: `gaps`는 AI가 주는 신호(`delivery_evidence`/`life_activity`/카드의 `source_type`)와 문진 응답을 **백엔드가 조합해 계산**하는 값입니다. AI-server는 이 개념 자체를 모르고 몰라도 됩니다 — 원래 신호만 그대로 주면 됩니다.

## 3. `/api/evidence/confirm`의 `confirmed: false`는 카드 삭제입니다

**문제**: `spec.md` F4-06 처리 ④에 "카드 삭제 가능"이 있는데, 계약(`{cardId, confirmed, corrections}`)에는 삭제를 위한 필드가 따로 없었습니다.

**해결**: `confirmed: false`로 호출하면 해당 카드를 세션에서 삭제합니다. `corrections`는 `confirmed: true`일 때만 의미가 있습니다.

**확인 부탁**: "카드 삭제" 버튼을 이미 다른 방식(예: 별도 엔드포인트, DELETE 메서드)으로 구현하셨다면 알려주세요.

**AI 쪽에 공유하지 않은 이유**: `/api/evidence/confirm`은 프론트-백엔드 전용 엔드포인트입니다. AI-server는 이 호출 자체를 알지 못합니다 — 확인된 카드 목록만 나중에 `/internal/draft` 요청에 실려 갑니다.

## 4. 병합 승인 후 표시 방식

**참고용입니다 — 프론트가 특별히 할 일은 없습니다.** `POST /api/timeline/merge`로 병합을 승인하면, 백엔드는 카드 두 개를 실제로 합치지 않습니다. `occurred_at`이 더 이른 카드만 `events` 목록에 남기고 나머지는 목록에서만 뺍니다(원본은 세션에 그대로 남아 F7-05 근거 연결에 쓰입니다). 응답으로 받은 `events`를 그대로 다시 그리시면 되고, 프론트 쪽에서 별도 중복 제거 로직은 필요 없습니다.

## 백엔드가 참고할 것

없음 — 전부 백엔드가 채운 값이고, 프론트 확인만 받으면 됩니다.

## 회신에 담아 주실 것

1. §1 `imageIndex` — 지금 반영 가능한지, 이미 다른 방식으로 보내고 있다면 무엇인지
2. §2 `gaps` 스키마 — 화면 요구사항과 맞는지 (특히 `suggestions`가 빈 배열인 `no_life_activity` 처리 방식)
3. §3 카드 삭제 — `confirmed: false`로 가는 게 맞는지
4. §4 — 확인만 해주시면 됩니다 (답변 불필요)
