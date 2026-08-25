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
        occurred_at: "high",
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
 * **날짜 또는 금액이 low 신뢰도인 미확인 카드**만 막는다. 그 외 미확인 카드는 통과시키고
 * "확인하지 않은 자료 n건은 문서에 포함되지 않습니다" 경고만 띄운다.
 *
 * **값이 `null`인 필드의 신뢰도는 읽지 않는다** — 금액이 없는 대화 캡처의
 * `field_confidence.amount`는 의미 없는 값이다. "금액을 못 읽었다"의 단일 출처는
 * `amount == null`이고, 저신뢰 차단은 **값이 있는 카드**에만 적용한다.
 */
export function isBlocking(card: ExtractedCard): boolean {
  if (card.confirmation_status !== "pending") return false
  const dateLow = card.occurred_at !== null && card.field_confidence.occurred_at === "low"
  const amountLow = card.amount !== null && card.field_confidence.amount === "low"
  return dateLow || amountLow
}

export function blockingCards(cards: ExtractedCard[]): ExtractedCard[] {
  return cards.filter(isBlocking)
}

export function pendingCards(cards: ExtractedCard[]): ExtractedCard[] {
  return cards.filter((card) => card.confirmation_status === "pending")
}

/** 확인된 카드만 준비도·소명서의 입력이 된다 (F6-03 · F7-01). */
export function confirmedEvidence(cards: ExtractedCard[]): EvidenceState {
  const out: EvidenceState = { autopay: false, chat: false, bank: false, shipping: false, threat: false }
  for (const card of cards) {
    if (card.confirmation_status === "pending") continue
    if (card.source_type !== "unknown") out[card.source_type] = true
  }
  return out
}
