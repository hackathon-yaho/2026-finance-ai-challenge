export type IntakeField = "when" | "amount" | "kind" | "history" | "usage"

export interface IntakeAnswers {
  when: string | null
  amount: string | null
  kind: string | null
  history: string | null
  usage: string | null
}

export type EvidenceId = "chat" | "deposit" | "shipping" | "autopay" | "threat"

export type EvidenceState = Record<EvidenceId, boolean>

export interface TimelineEvent {
  time: string
  text: string
  gap: boolean
  threat?: boolean
}

export interface CriterionResult {
  name: string
  ok: boolean
  desc: string
}

export type VerdictKind = "approve" | "more" | "reject"
export type VerdictColor = "blue" | "orange" | "red"

export interface VerdictResult {
  verdict: VerdictKind
  label: string
  colorKey: VerdictColor
  days: string
  note: string
  criteria: CriterionResult[]
}

export interface ChecklistItem {
  label: string
  have: boolean
}
