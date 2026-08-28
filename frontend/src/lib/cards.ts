import type { CardEdits, ConfirmationStatus, EvidenceId, EvidenceState, ExtractedCard } from "../types"

/**
 * 추출 카드 (spec.md F4-06).
 *
 * **API를 붙이면 `POST /api/evidence` 응답이 이 배열을 그대로 준다.** 여기 만드는 값은
 * 계약(`api-contract.md`)의 카드 스키마와 필드명까지 같으므로 변환 코드가 필요 없다.
 * 그때까지는 목 판독 결과를 이 파일이 대신 만든다.
 *
 * 카드가 필요한 이유는 데모 장치가 아니다 — **AI가 "70만 원"을 "10만 원"으로 읽을 수 있고,
 * 확인 없이 소명서를 만들면 틀린 서류가 은행에 간다.**
 */

export interface CardState {
  status: ConfirmationStatus
  edits: CardEdits
}

const KST = "+09:00"

/** 목 판독 결과. 증거 유형 하나당 카드 하나 — 실제로는 이미지 한 장에서 여러 장이 나온다. */
function baseCards(amount: number | null): Record<EvidenceId, ExtractedCard> {
  const paid = amount ?? 450000

  return {
    autopay: {
      event_id: "evt_0_1",
      source_image_index: 0,
      source_type: "autopay",
      occurred_at: `2026-08-15T09:00:00${KST}`,
      actor: "system",
      summary: "통신비 자동이체 출금 · 12개월째",
      amount: 54000,
      counterparty_name: null,
      payer_name: null,
      identifiers: { tracking_no: null, account_last4: "4412" },
      field_confidence: {
        // 연도를 추론한 카드. 은행 앱은 올해 거래를 `08.15`처럼 월·일만 찍고, AI는 기준
        // 시점을 받아 연도를 채우되 신뢰도를 항상 `low`로 강제한다
        // (`internal-api-contract.md` "연도 없는 캡처의 연도 추론"). 실연동에서 흔한 경로라
        // 목에도 한 장 둔다 — 목에 없으면 이 문구를 백엔드 없이 볼 방법이 없다.
        occurred_at: "low",
        actor: "high",
        amount: "high",
        counterparty_name: null,
        payer_name: null,
      },
      source_region: { x: 0.08, y: 0.42, w: 0.84, h: 0.1 },
      confirmation_status: "pending",
    },
    chat: {
      event_id: "evt_1_1",
      source_image_index: 1,
      source_type: "chat",
      occurred_at: `2026-09-01T13:40:00${KST}`,
      actor: "counterparty",
      summary: "구매자가 판매 여부를 문의",
      amount: null,
      counterparty_name: "김철수",
      payer_name: null,
      field_confidence: {
        occurred_at: "high",
        actor: "high",
        // amount가 null인 카드의 신뢰도는 읽지 않는다 (계약의 해석 규칙).
        amount: "low",
        counterparty_name: "high",
        payer_name: null,
      },
      identifiers: { tracking_no: null, account_last4: null },
      source_region: { x: 0.12, y: 0.28, w: 0.66, h: 0.09 },
      confirmation_status: "pending",
    },
    bank: {
      event_id: "evt_2_1",
      source_image_index: 2,
      source_type: "bank",
      occurred_at: `2026-09-01T14:12:00${KST}`,
      actor: "system",
      summary: "물품대금 입금",
      amount: paid,
      counterparty_name: null,
      // 입금자와 대화 상대가 같은지는 백엔드가 대조한다. 프론트는 값만 보여준다.
      payer_name: "김철수",
      identifiers: { tracking_no: null, account_last4: "4412" },
      field_confidence: {
        occurred_at: "high",
        actor: "high",
        // 금액 판독 신뢰도가 낮은 카드. 확인 전에는 Stage 3으로 넘어갈 수 없다 (F4-06 게이팅).
        amount: "low",
        counterparty_name: null,
        payer_name: "medium",
      },
      source_region: { x: 0.1, y: 0.35, w: 0.8, h: 0.12 },
      confirmation_status: "pending",
    },
    shipping: {
      event_id: "evt_3_1",
      source_image_index: 3,
      source_type: "shipping",
      occurred_at: `2026-09-01T16:05:00${KST}`,
      actor: "self",
      summary: "택배 송장 접수",
      amount: null,
      counterparty_name: null,
      payer_name: null,
      // 송장 번호는 값을 옮기지 않고 존재 여부만 표기한다 (AI 프롬프트 조항 2).
      identifiers: { tracking_no: "MASKED", account_last4: null },
      field_confidence: {
        occurred_at: "medium",
        actor: "high",
        amount: "low",
        counterparty_name: null,
        payer_name: null,
      },
      source_region: { x: 0.14, y: 0.2, w: 0.72, h: 0.14 },
      confirmation_status: "pending",
    },
    threat: {
      event_id: "evt_4_1",
      source_image_index: 4,
      source_type: "threat",
      occurred_at: `2026-09-02T09:10:00${KST}`,
      actor: "counterparty",
      summary: "지급정지 해제를 조건으로 금전을 요구하는 메시지 수신",
      amount: 200000,
      counterparty_name: null,
      payer_name: null,
      identifiers: { tracking_no: null, account_last4: null },
      field_confidence: {
        occurred_at: "medium",
        actor: "medium",
        amount: "medium",
        counterparty_name: null,
        payer_name: null,
      },
      source_region: { x: 0.1, y: 0.3, w: 0.8, h: 0.16 },
      confirmation_status: "pending",
    },
  }
}

const ORDER: EvidenceId[] = ["chat", "bank", "shipping", "autopay", "threat"]

/**
 * 카드를 어느 증거 유형에서 만들었는지 되짚는다 — "이 자료 빼기"가 쓴다.
 *
 * `event_id`는 계약상 **불투명 문자열**이라 파싱해서 의미를 꺼내지 않는다. 목에서
 * 유형당 카드가 하나이므로 같은 표를 다시 만들어 대조한다. API를 붙이면 카드가 유형당
 * 여러 장이 되므로, 이 함수 대신 `event_id` 단위 삭제로 바뀐다.
 */
export function evidenceIdOf(eventId: string): EvidenceId | null {
  const base = baseCards(null)
  return ORDER.find((id) => base[id].event_id === eventId) ?? null
}

/** 사용자가 확인·수정한 값을 판독 결과 위에 덮는다. 수정하지 않은 필드는 원본 그대로 둔다. */
function applyState(card: ExtractedCard, state: CardState | undefined): ExtractedCard {
  if (!state) return card
  const { edits } = state
  return {
    ...card,
    occurred_at: edits.occurred_at !== undefined ? edits.occurred_at : card.occurred_at,
    amount: edits.amount !== undefined ? edits.amount : card.amount,
    counterparty_name:
      edits.counterparty_name !== undefined ? edits.counterparty_name : card.counterparty_name,
    payer_name: edits.payer_name !== undefined ? edits.payer_name : card.payer_name,
    confirmation_status: state.status,
  }
}

/** 텍스트 경로(F3-04)로 만든 카드에도 같은 확인·수정 상태를 입힌다. */
export function applyCardStates(cards: ExtractedCard[], states: Record<string, CardState>): ExtractedCard[] {
  return cards.map((card) => applyState(card, states[card.event_id]))
}

export function buildCards(
  evidence: EvidenceState,
  amount: number | null,
  states: Record<string, CardState>,
): ExtractedCard[] {
  const base = baseCards(amount)
  return ORDER.filter((id) => evidence[id]).map((id) => applyState(base[id], states[base[id].event_id]))
}

/**
 * Stage 3 진입을 막는 카드 (F4-06 게이팅).
 *
 * **날짜 또는 금액이 low 신뢰도이거나, 날짜를 아예 못 읽은 미확인 카드**를 막는다. 그 외
 * 미확인 카드는 통과시키고 "확인하지 않은 자료 n건은 문서에 포함되지 않습니다" 경고만 띄운다.
 *
 * **값이 `null`인 필드의 신뢰도는 읽지 않는다** — 금액이 없는 대화 캡처의
 * `field_confidence.amount`는 의미 없는 값이다. "금액을 못 읽었다"의 단일 출처는
 * `amount == null`이고, 저신뢰 차단은 **값이 있는 카드**에만 적용한다.
 *
 * **`occurred_at == null`은 예외로 차단한다** (2026-08-26 백엔드 §7 확정). 은행 캡처가
 * `08.19`처럼 연도 없이 찍히면 AI가 **연도를 지어내지 않고 `null`을 낸다** — 원칙대로
 * 동작한 것이지 판독 실패가 아니다. 그래도 시각 없는 카드가 그대로 은행에 가면 안 되니
 * 사용자가 한 번은 보게 만든다. `amount == null`은 계속 예외다 — 대화 캡처에 금액이 없는
 * 것은 정상이고, 날짜만 다르게 취급한다는 것이 백엔드
 * `EvidenceServiceImpl.hasBlockingUnconfirmedCards`와 맞춘 규칙이다.
 *
 * **이 게이팅은 "시각 미상"을 없애주지 않는다.** 사용자가 날짜를 안 채우고 "맞아요"만 눌러도
 * 차단은 풀리고 3면에는 "시각 미상"이 남는다. 채우는 것은 사용자 선택이다.
 */
export function isBlocking(card: ExtractedCard): boolean {
  if (card.confirmation_status !== "pending") return false
  const dateMissing = card.occurred_at === null
  const dateLow = card.occurred_at !== null && card.field_confidence.occurred_at === "low"
  const amountLow = card.amount !== null && card.field_confidence.amount === "low"
  return dateMissing || dateLow || amountLow
}

/**
 * 왜 막혔는지 (화면 문구용).
 *
 * 이유를 구분하지 않으면 시각을 못 읽은 카드에까지 "판독 신뢰도가 낮아요"가 붙는다.
 * 연도 없는 캡처는 신뢰도 문제가 아니라 **읽을 연도가 화면에 없던 것**이라 사용자가
 * 무엇을 해야 하는지도 달라진다.
 *
 * **`date_low`를 따로 뺀 이유** (2026-08-28, AI 연도 추론 B안 전환) — 기준 시점이 실리면
 * AI가 `08.19` 같은 캡처의 연도를 채워 보내되 신뢰도를 항상 `low`로 강제한다
 * (`internal-api-contract.md` "연도 없는 캡처의 연도 추론"). 그래서 **날짜가 값을 가진 채
 * 막히는 카드**가 흔해졌는데, 여기에 "판독 신뢰도가 낮아요"만 띄우면 사용자는 이미 화면에
 * 적힌 날짜를 놔두고 무엇을 봐야 하는지 모른다. 물어볼 값이 있으면 그 값을 그대로 묻는다.
 *
 * 연도를 추론한 카드인지 흐려서 못 읽은 카드인지는 계약에 구분이 없다 — 둘 다 값 있는 `low`다.
 * 어차피 사용자가 할 일은 같으므로(보고 맞으면 확인, 아니면 고침) 한 문구로 묶는다.
 */
export function blockingReason(
  card: ExtractedCard,
): "date_missing" | "date_low" | "amount_low" | null {
  if (!isBlocking(card)) return null
  if (card.occurred_at === null) return "date_missing"
  // 날짜와 금액이 함께 낮으면 날짜를 먼저 묻는다 — 3면 정렬과 반복 묶기가 날짜에 달려 있다.
  if (card.field_confidence.occurred_at === "low") return "date_low"
  return "amount_low"
}

export function blockingCards(cards: ExtractedCard[]): ExtractedCard[] {
  return cards.filter(isBlocking)
}

export function pendingCards(cards: ExtractedCard[]): ExtractedCard[] {
  return cards.filter((card) => card.confirmation_status === "pending")
}

/**
 * 확인된 입금 카드의 금액. 없으면 `null`.
 *
 * 문진의 "정지된 입금액"과 입금 내역 카드의 금액은 **같은 사실을 가리키는 두 값**이다.
 * 목은 카드를 문진 값으로 만들지만, 사용자가 F4-06 카드에서 금액을 고치면 둘이 갈라진다.
 * 그때 문서가 문진 값을 그대로 쓰면 **고친 값이 조용히 버려진다** — "AI가 70만 원을 10만
 * 원으로 읽을 수 있다"는 F4-06의 존재 이유가 무력해진다. 확인된 카드 값이 이긴다.
 *
 * API를 붙이면 `/api/draft`가 서버에서 확인된 카드로 문장을 만들므로 이 함수는 사라진다.
 */
export function confirmedBankAmount(cards: ExtractedCard[]): number | null {
  const card = cards.find(
    (c) => c.source_type === "bank" && c.confirmation_status !== "pending" && c.amount !== null,
  )
  return card ? card.amount : null
}

/** 확인된 카드만 준비도·소명서의 입력이 된다 (F6-03 · F7-01). */
export function confirmedEvidence(cards: ExtractedCard[]): EvidenceState {
  const out: EvidenceState = { autopay: false, chat: false, bank: false, shipping: false, threat: false }
  for (const card of cards) {
    if (card.confirmation_status === "pending") continue
    // `unknown`·`intake`는 증거 유형이 아니다 — 전자는 AI가 분류를 보류한 값이고,
    // 후자는 백엔드가 문진으로 합성한 카드라 체크리스트를 채우는 근거가 될 수 없다.
    if (card.source_type !== "unknown" && card.source_type !== "intake") out[card.source_type] = true
  }
  return out
}
