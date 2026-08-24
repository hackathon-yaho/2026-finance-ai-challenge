import { getAmountInfo } from "./amount"
import type { EvidenceState, TimelineEvent } from "../types"

export function buildTimeline(evidence: EvidenceState, amount: number | null, bankConfirmed: boolean): TimelineEvent[] {
  const amountInfo = getAmountInfo(amount)
  const out: TimelineEvent[] = []

  if (evidence.autopay) {
    out.push({ time: "2026.08.15 09:00", text: "통신비 54,000원 자동이체 · 12개월째" })
  } else {
    out.push({ time: "기간 미상", text: "생계 흔적을 찾지 못했어요", gap: true, action: "자동이체 내역 넣기", srcToggle: "autopay" })
  }

  if (evidence.chat) {
    out.push({ time: "2026.09.01 13:40", text: '구매자 "이거 아직 판매중이에요?"' })
    out.push({ time: "2026.09.01 13:42", text: `본인 "네, ${amountInfo.short}에 드릴게요"` })
  } else {
    out.push({ time: "시각 미상", text: "거래 합의 증빙을 찾지 못했어요", gap: true, action: "대화 캡처 넣기", srcToggle: "chat" })
  }

  if (evidence.bank) {
    out.push({
      time: "2026.09.01 14:12",
      text: `입금 ${amountInfo.formatted}${bankConfirmed ? "" : " · 확인 필요"}`,
    })
  }

  if (evidence.shipping) {
    out.push({ time: "2026.09.01 16:05", text: "택배 송장 등록" })
  } else {
    out.push({ time: "시각 미상", text: "발송 증빙을 찾지 못했어요", gap: true, action: "송장 캡처 넣기", srcToggle: "shipping" })
  }

  if (evidence.threat) {
    out.push({
      time: "2026.09.02 09:10",
      text: '발신 010-****-1234 "20만원 보내면 신고 취하해드릴게요"',
      threat: true,
    })
  }

  return out
}
