import type { EvidenceState, TimelineEvent } from "../types"

export function buildTimeline(evidence: EvidenceState): TimelineEvent[] {
  const items: TimelineEvent[] = []

  if (evidence.autopay) {
    items.push({ time: "2026.08.15 09:00", text: "통신비 54,000원 자동이체 (12개월째 유지)", gap: false })
  } else {
    items.push({ time: "—", text: "생활 반응 흔적을 찾지 못했어요", gap: true })
  }

  if (evidence.chat) {
    items.push({ time: "2026.09.01 13:40", text: '구매자 "이거 아직 판매중이에요?"', gap: false })
    items.push({ time: "2026.09.01 13:42", text: '본인 "네, 45만원에 드릴게요"', gap: false })
  }

  if (evidence.deposit) {
    items.push({ time: "2026.09.01 14:12", text: "입금 450,000원 확인", gap: false })
  }

  if (evidence.shipping) {
    items.push({ time: "2026.09.01 16:05", text: "택배 송장 등록 확인", gap: false })
  } else {
    items.push({ time: "—", text: "발송 증빙을 찾지 못했어요", gap: true })
  }

  if (evidence.threat) {
    items.push({
      time: "2026.09.02 09:10",
      text: '발신 010-****-1234 "신고 취하해드릴게요, 20만원만…"',
      gap: false,
      threat: true,
    })
  }

  return items
}
