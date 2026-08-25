# Phase 2 — 세션 · 문진 · 기한 계산

> 목표: 익명 세션이 발급되고, 문진 응답(계약 기준 7개 필드)이 세션에 쌓이고, 이의제기 기한이 계산되어 내려간다.
>
> 근거: `../../docs/00-context/spec.md` F1-01~F1-03·F2-01·F2-03·F2-04, `../../docs/02-architecture/api-contract.md`, `../../docs/00-context/prd.md` §4.1

## 2-1. 세션 저장소 (F1-01 ~ F1-03)

`../../docs/02-architecture/data-model.md`의 `Session` 레코드를 그대로 옮긴다. **DB에 쓰지 않는다.**

```java
record Session(
    String hash,
    Instant expiresAt,                        // 30분 TTL
    Map<String,String> intake,                // 문진
    List<ExtractedEvent> timeline,
    Signals signals,
    Readiness readiness,
    String draftText,
    Map<String,Boolean> cardConfirmed,        // FR-028
    List<SentenceEvidence> sentenceEvidence,  // FR-046 — (imageIndex, bbox) 참조만
    Map<String,QualityFlags> qualityFlags     // FR-029
) {}
```

- [ ] `SessionStore` — `ConcurrentHashMap<String, Session>`
- [ ] 해시 생성: **16자 랜덤, `SecureRandom`** (F1-01 처리 ①). 사용자 식별 정보에서 역산 불가해야 한다
- [ ] TTL 30분. 요청이 있을 때마다 만료 시각 갱신(무활동 30분 기준이므로)
- [ ] 만료 정리 스케줄러 (`data-model.md` 백엔드 체크리스트)
- [ ] 저장소 포화 시 가장 오래된 만료 세션 강제 정리 (F1-01 예외)

> **`sentenceEvidence`에 이미지 바이트를 넣지 않는다.** 몇 번째 이미지의 어느 영역인지만 담는다 — `data-model.md`.

## 2-2. 세션 API

| Method | Path | 응답 |
| --- | --- | --- |
| POST | `/api/session` | `{ sessionHash, expiresAt, demoMode }` |
| DELETE | `/api/session` | `204` |

- [ ] `POST /api/session` — 매번 다른 해시 발급 (F1-01 수용 기준)
- [ ] 응답에 **`demoMode`**(환경변수 `DEMO_MODE` 값)를 담는다 — 프론트가 전 화면 데모 배지를 띄우는 근거다 (Phase 6, `api-contract.md` v1.3)
- [ ] `DELETE /api/session` — 즉시 파기. 파기 후 동일 해시 조회 시 데이터 없음 (F1-03 수용 기준)
- [ ] **파기 트리거 3종을 모두 구현한다** (F1-03): ① 30분 무활동 ② `DELETE /api/session` ③ **5단계 완료**
- [ ] 파기 시 **클라이언트에 blob revoke 신호를 전달한다** (F1-03 처리 — 프론트가 브라우저 메모리의 원본을 해제하도록)
- [ ] 파기 직전 **익명 통계만** 적재 (F1-03 연관 → Phase 6에서 구현, 여기서는 훅만)

## 2-3. 세션 인터셉터

- [ ] 요청 헤더 `X-Session-Hash`로 세션 조회 (결정 로그 — 쿠키 아님)
- [ ] 세션 없음/만료 → **`410 Gone`** + `{"error":"SESSION_EXPIRED", ...}` (F1-02 예외, `api-contract.md` 오류표)
- [ ] `/api/session`(생성)과 `/actuator/health`는 인터셉터 제외

> 프론트는 `SESSION_EXPIRED`를 받으면 "세션 재생성 후 처음부터" 안내를 띄운다. **원본 이미지는 서버에 없었으므로 재업로드가 필요하다** — 이 사실을 오류 메시지에서 숨기지 않는다.

## 2-4. 문진 저장 (F2-01)

`POST /api/intake` — 요청 필드는 `../../docs/02-architecture/api-contract.md`의 표를 **그대로** 따른다.

| 필드 | 타입 | 값 | 용도 |
| --- | --- | --- | --- |
| `when` | string \| null | 지급정지일 | 기한 계산 |
| `dueNoticeStatus` | enum | `notified` \| `not_yet` \| `unknown` | 기한 계산 |
| `dueNoticeDate` | string \| null | 공고일 | 기한 계산 |
| `amount` | number \| null | 문제 입금액 | **사실 기재 전용** |
| `kind` | enum | `goods` \| `service` \| `debt` \| `unclear` | 사유유형 |
| `history` | boolean | 과거 지급정지 이력 | `은행기준미상` 신호 |
| `usage` | enum | `main` \| `occasional` \| `rare` | 생계 흔적 점검 보조 |
| **`deliveryMethod`** | enum \| null | `courier` \| `in_person` \| `not_applicable` \| null | **F5-03 ① 직거래 예외** (2026-08-25 신설). `kind !== "goods"`면 `null` |

- [ ] 증분 저장 허용 — 프론트가 입력 즉시 호출한다 (F2-01 처리). 일부 필드만 온 요청을 거부하지 않는다
- [ ] `dueNoticeStatus == notified`이면 `dueNoticeDate` 필수 검증
- [ ] 응답 `{ ok, nextStage, deadline }` (2-5 참조)

> **문항 수**: PRD FR-010·spec F2-01 모두 **6문항으로 정정 완료**됐다(2026-08-23 백엔드 / 08-24 프론트). 공고 문항 하나가 `dueNoticeStatus`+`dueNoticeDate` 2필드로 쪼개져 **6문항 = 7필드**다. **계약 문서인 `api-contract.md`를 따른다.**
>
> **2026-08-25 — 물품 거래일 때만 문항 하나가 늘어난다** (F2-01a). `kind == "goods"`면 거래 방식(`deliveryMethod`)을 묻고, 아니면 `null`이 온다. **용역·채권 회수에는 배송 개념이 없어** 무조건 7문항으로 늘리지 않았다.
>
> - [ ] `deliveryMethod`를 세션에 담고 **Phase 3의 F5-03 공백 탐지에 전달**한다. `in_person`이면 규칙 ①("발송 증빙 없음")을 적용하지 않는다 — 직거래는 송장이 원래 없어, 그대로 두면 **채울 방법이 없는 공백**을 띄우고 준비도를 깎는다 (TC-30)
> - [ ] `history`·`dueNotice*`는 **소명서 생성 입력(`/internal/draft`의 `intake`)에 넣지 않는다** (Phase 5-1)

> **`amount`를 준비도 판정에 절대 쓰지 않는다.** 소액 기준은 은행 내규로 비공개다 — `../../docs/00-context/prd.md` §14 OI-01.

## 2-5. 기한 계산 (FR-014)

`../../docs/00-context/prd.md` §4.1의 의사코드를 그대로 구현한다. 법 제7조 제1항 근거 — 기한은 **채권소멸절차 개시 공고일 + 2개월**이다.

```
IF 공고일 입력됨:
    기한 = 공고일 + 2개월
    표시 = "이의제기 기한까지 {n}일 남았습니다. ({기한일})"
ELIF 공고 아직 없음 / 모름:
    표시 = "아직 공고 전이라면 기한이 남아 있습니다. 공고일로부터 2개월이
            기한이므로, 금융회사에 공고 여부를 먼저 확인하세요."
ELIF 지급정지일도 확인 불가:
    표시 = "지급정지 통지서에서 날짜를 확인해 주세요. 기한이 지나면
            예금채권이 소멸할 수 있습니다."
```

- [ ] `DeadlineCalculator` 구현 (순수 함수, LLM 사용 안 함)
- [ ] 응답 형태: `deadline: { date, daysLeft, notice }` — 공고일이 없으면 `date`/`daysLeft`는 null, `notice`만 채운다
- [ ] **기한 경과가 확실해도 "불가능"이라고 단정하지 않는다.** 금융회사·전문가 확인이 필요하다고 안내한다 (§4.1 각주)
- [ ] 단위 테스트: 공고일 있음 / 공고 전 / 모름 / 지급정지일도 없음 4케이스

## 2-6. 하위 단계 무효화 (F2-03)

- [ ] 문진 응답이 바뀌면 세션의 `readiness`, `draftText`를 **초기화**한다
- [ ] 초기화 사실을 응답으로 알려 프론트가 S03 이후를 비활성화할 수 있게 한다

> **이 동작이 발표 데모의 핵심 장면이다** (F2-03 발표 활용, `../../docs/04-testing/test-cases-and-demo.md` `[1:30]`). '이력 있음'으로 바꾸면 준비도가 뒤집혀야 한다. 캐시가 남아 옛 결과가 보이면 데모가 죽는다.

## 2-7. 자료 없음 경로 (F2-04)

- [ ] 증거 0건 상태에서도 Phase 4 준비도 산출이 동작해야 한다
- [ ] 이때 신호 플래그는 전부 false, 생계 요건은 문진 `usage == main`으로만 판단
- [ ] 근거 페르소나 P-06 (고령·캡처 방법 모름) — TC-06

## 완료 기준

- 세션 발급 → 문진 저장 → 재조회 시 값이 유지된다 (F1-02 수용 기준: 5단계 왕복 이동 시 입력값 전부 유지)
- 30분 경과 후 호출 시 `410 Gone`
- 공고일을 넣으면 `deadline.daysLeft`가 정확히 계산된다
- 문진을 바꾸면 `readiness`/`draftText`가 비워진다

## 단위 테스트 (Phase 2 범위)

- `DeadlineCalculator` 4케이스
- `SessionStore` TTL 만료 · 파기 후 조회 불가
