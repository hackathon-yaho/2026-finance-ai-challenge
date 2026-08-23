export type IntakeField = "when" | "notice" | "amount" | "kind" | "history" | "usage"

export interface IntakeAnswers {
  when: string | null
  notice: string | null
  amount: string | null
  kind: string | null
  history: string | null
  usage: string | null
}

export type EvidenceId = "autopay" | "chat" | "bank" | "shipping" | "threat"

export type EvidenceState = Record<EvidenceId, boolean>

export type ViewerId = "chat" | "bank" | "shipping" | "threat"

export interface TimelineEvent {
  time: string
  text: string
  gap?: boolean
  threat?: boolean
  action?: string
  srcToggle?: EvidenceId
}

export interface Criterion {
  name: string
  ok: boolean
  desc: string
}

export type ReadinessKey = "ready" | "supplement" | "bankcheck"

export interface ReadinessResult {
  key: ReadinessKey
  label: string
  criteria: Criterion[]
}

export interface DraftLine {
  text: string
  badge: string | null
  ref: ViewerId | null
  note?: string
}

export interface ChecklistItem {
  id: EvidenceId
  label: string
  have: boolean
}

export interface AmountInfo {
  known: boolean
  short: string
  formatted: string
}

export interface MaskBox {
  x: number
  y: number
  w: number
  h: number
}

export interface UploadedFile {
  id: string
  name: string
  dataUrl: string
  masked: boolean
}

export interface PendingUpload {
  id: string
  name: string
  dataUrl: string
}
