import type { ChecklistItem, EvidenceState, IntakeAnswers, VerdictResult } from "../types"
import { buildTimeline } from "./timeline"

export function buildDraft(intake: IntakeAnswers, evidence: EvidenceState, verdict: VerdictResult): string[] {
  const kind = intake.kind || "거래"
  const amount = intake.amount || "미확인 금액"
  const facts = buildTimeline(evidence)
    .filter((event) => !event.gap)
    .map((event) => `- ${event.time} ${event.text}`)
    .join("\n")

  return [
    `본인은 2026년 9월 1일 ${kind} 목적으로 ${amount} 상당의 금액을 입금받았습니다. 해당 거래는 아래와 같은 사실관계로 확인됩니다.`,
    facts,
    `위 사실관계에 따라 ${verdict.criteria.map((c) => `${c.name} ${c.ok ? "충족" : "미충족"}`).join(", ")}으로 확인됩니다.`,
    "본 진술은 제출된 자료에 근거한 사실 서술이며, 법률적 판단이나 주장을 포함하지 않습니다.",
  ]
}

export function buildChecklist(intake: IntakeAnswers, evidence: EvidenceState): ChecklistItem[] {
  const { kind } = intake

  if (kind === "중고 물건 판매") {
    return [
      { label: "거래 채팅 캡처", have: evidence.chat },
      { label: "입금 내역 캡처", have: evidence.deposit },
      { label: "택배 송장 또는 발송 확인", have: evidence.shipping },
      { label: "통신비 등 생활 자동이체 내역", have: evidence.autopay },
    ]
  }
  if (kind === "용역·알바 대가") {
    return [
      { label: "업무 요청·완료 대화 또는 이메일", have: evidence.chat },
      { label: "입금 내역 캡처", have: evidence.deposit },
      { label: "작업 결과물 또는 계약 관련 자료", have: evidence.shipping },
      { label: "생활 자동이체 내역", have: evidence.autopay },
    ]
  }
  if (kind === "빌려준 돈 회수") {
    return [
      { label: "이체 기록 또는 대여 관련 대화", have: evidence.chat },
      { label: "입금 내역 캡처", have: evidence.deposit },
      { label: "차용증 (있는 경우)", have: evidence.shipping },
      { label: "생활 자동이체 내역", have: evidence.autopay },
    ]
  }
  return [
    { label: "거래 관련 대화 또는 문서", have: evidence.chat },
    { label: "입금 내역 캡처", have: evidence.deposit },
    { label: "기타 증빙 자료", have: evidence.shipping },
  ]
}
