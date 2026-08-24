import { CHECK_LABELS } from "../data"
import { getAmountInfo } from "./amount"
import type { ChecklistItem, DraftLine, EvidenceState, IntakeAnswers } from "../types"

export function buildDraftLines(intake: IntakeAnswers, evidence: EvidenceState, bankConfirmed: boolean): DraftLine[] {
  const amountInfo = getAmountInfo(intake.amount)
  const kind = intake.kind && intake.kind !== "잘 모르겠어요" ? intake.kind : "거래"
  const lines: DraftLine[] = []

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

  return lines
}

export function buildChecklist(intake: IntakeAnswers, evidence: EvidenceState, bankConfirmed: boolean): ChecklistItem[] {
  const kind = intake.kind || "잘 모르겠어요"
  const items = CHECK_LABELS[kind] ?? CHECK_LABELS["잘 모르겠어요"]
  const withThreat: [typeof items[number][0] | "threat", string][] = [...items, ["threat", "협박 메시지 (해당 시)"]]

  return withThreat.map(([id, label]) => {
    if (id === "threat") {
      return { id: "threat", label, have: evidence.threat }
    }
    const have = evidence[id] && (id !== "bank" || bankConfirmed)
    return { id, label, have }
  })
}
