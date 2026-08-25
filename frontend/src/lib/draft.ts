import { getAmountInfo } from "./amount"
import type { DraftLine, EvidenceState, ExtractedCard, IntakeAnswers } from "../types"

/**
 * `amount`는 **확인된 입금 카드의 금액**이다 (없으면 문진 응답). 사용자가 F4-06에서 고친
 * 값이 문서에 반영되지 않으면 확인 절차 자체가 무의미해진다 — `lib/cards.ts`의
 * `confirmedBankAmount` 주석 참고.
 */
export function buildDraftLines(
  intake: IntakeAnswers,
  evidence: EvidenceState,
  bankConfirmed: boolean,
  amount: number | null = intake.amount,
): DraftLine[] {
  const amountInfo = getAmountInfo(amount)
  const kind = intake.kind && intake.kind !== "잘 모르겠어요" ? intake.kind : "거래"
  const lines: Omit<DraftLine, "id">[] = []

  // 본인 진술 문장은 문진 응답이 근거다. 입금액을 "모름"으로 두었으면 숫자를 임의로 채우지
  // 않고 미상으로 남긴다 (FR-028 — 확인 불가한 값은 미상으로 유지).
  const amountPhrase = amountInfo.known ? `${amountInfo.formatted}을 입금받았습니다` : "입금을 받았습니다(입금액 미상)"

  lines.push({
    text:
      `본인은 이 계좌를 ${intake.usage === "주 거래 계좌예요" ? "주 거래 계좌로 사용해 왔으며" : "보유해 왔으며"}, ` +
      `2026년 9월 1일 ${kind} 목적으로 ${amountPhrase}.`,
    badge: "본인 진술",
    ref: null,
  })

  if (evidence.chat) {
    lines.push({
      text: `2026년 9월 1일 13시 40분 구매자로부터 판매 여부를 확인하는 메시지를 받고, 같은 날 13시 42분 ${amountInfo.short}에 판매하겠다고 답신했습니다.`,
      badge: "근거 · 대화 캡처",
      ref: "chat",
      note: "이 문장은 13:40 · 13:42 대화 두 건에서 나왔어요.",
    })
  }
  if (evidence.bank && bankConfirmed) {
    lines.push({
      text: `2026년 9월 1일 14시 12분 위 대금 ${amountInfo.formatted}이 본인 계좌로 입금되었습니다.`,
      badge: "근거 · 입금 내역",
      ref: "bank",
      note: "이 문장은 9월 1일 14:12 입금 행에서 나왔어요.",
    })
  }
  if (evidence.shipping) {
    lines.push({
      text: "2026년 9월 1일 16시 5분 해당 물품의 택배 송장이 등록되었습니다.",
      badge: "근거 · 택배 송장",
      ref: "shipping",
      note: "이 문장은 접수일시 항목에서 나왔어요.",
    })
  }
  if (evidence.autopay) {
    lines.push({
      text: "본인은 이 계좌로 12개월간 통신비를 자동이체해 왔습니다.",
      badge: "근거 · 자동이체 내역",
      ref: "bank",
      note: "이 문장은 8월 15일 자동이체 행에서 나왔어요.",
    })
  }
  if (evidence.threat) {
    lines.push({
      text: "2026년 9월 2일 발신자 불명의 번호로부터 지급정지 해제를 조건으로 금전을 요구하는 메시지를 수신한 사실이 있어 별첨으로 제출합니다.",
      badge: "근거 · 문자 캡처",
      ref: "threat",
      note: "수신 사실만 적었어요. 판단은 은행이 해요.",
    })
  }

  lines.push({
    text: "본 진술은 제출된 자료에 근거한 사실 서술이며, 법률적 판단이나 주장을 포함하지 않습니다.",
    badge: null,
    ref: null,
  })

  // 문장 id는 계약과 같은 형식(s1, s2…)으로 매긴다. 제외·근거 연결이 이 값을 쓴다.
  return lines.map((line, i) => ({ ...line, id: `s${i + 1}` }))
}

/**
 * 텍스트 직접 입력(F3-04) 경로의 초안.
 *
 * **이미지 경로의 `buildDraftLines`를 쓰면 안 된다.** 그쪽은 목 시나리오라 "14시 12분",
 * "2026년 9월 1일" 같은 값이 문장에 박혀 있는데, 텍스트 경로 사용자는 그런 말을 한 적이
 * 없다. 실제로 "9월 1일쯤"이라고만 쓴 사용자의 소명서에 14시 12분이 찍혀 나갔다.
 * F3-04의 "말하지 않은 시각을 만들지 않음"은 카드 화면만이 아니라 **문서까지** 가는 규칙이다.
 *
 * 그래서 문장을 짓지 않고 **사용자가 쓴 요약을 그대로** 싣고, 날짜는 카드가 가진 만큼만
 * 적는다 (`occurred_at`에 시각이 없으면 날짜만, 아예 없으면 날짜를 쓰지 않는다).
 */
export function buildDraftLinesFromCards(
  intake: IntakeAnswers,
  cards: ExtractedCard[],
  amount: number | null = intake.amount,
): DraftLine[] {
  const amountInfo = getAmountInfo(amount)
  const kind = intake.kind && intake.kind !== "잘 모르겠어요" ? intake.kind : "거래"
  const amountPhrase = amountInfo.known ? `${amountInfo.formatted}을 입금받았습니다` : "입금을 받았습니다(입금액 미상)"
  const lines: Omit<DraftLine, "id">[] = []

  // 첫 문장에 날짜를 넣지 않는다 — 문진은 정지 시점만 묻지 거래일을 묻지 않는다.
  lines.push({
    text:
      `본인은 이 계좌를 ${intake.usage === "주 거래 계좌예요" ? "주 거래 계좌로 사용해 왔으며" : "보유해 왔으며"}, ` +
      `${kind} 목적으로 ${amountPhrase}.`,
    badge: "본인 진술",
    ref: null,
  })

  for (const card of cards) {
    const when = card.occurred_at
      ? card.occurred_at.includes("T")
        ? `${card.occurred_at.slice(0, 10).replace(/-/g, ".")} ${card.occurred_at.slice(11, 16)}`
        : card.occurred_at.slice(0, 10).replace(/-/g, ".")
      : null
    lines.push({
      text: when ? `${when} — ${card.summary}` : card.summary,
      badge: "본인 진술",
      ref: null,
      note: "직접 적어주신 내용이에요. 저희가 문장을 만들지 않았어요.",
    })
  }

  lines.push({
    text: "본 진술은 제출된 자료에 근거한 사실 서술이며, 법률적 판단이나 주장을 포함하지 않습니다.",
    badge: null,
    ref: null,
  })

  return lines.map((line, i) => ({ ...line, id: `s${i + 1}` }))
}
