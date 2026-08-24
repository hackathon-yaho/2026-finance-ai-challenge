export type IntakeField = "when" | "notice" | "amount" | "kind" | "history" | "usage"

/** api-contract의 `dueNoticeStatus`. 채권소멸절차 개시 공고를 받았는지. */
export type DueNoticeStatus = "notified" | "not_yet" | "unknown"

/** 날짜·금액을 직접 입력받는 문항이 있어 필드마다 형식이 다르다 (spec.md F2-01). */
export interface IntakeAnswers {
  /** 지급정지일 "YYYY-MM-DD". null은 미응답 또는 "모름"이며, 구분은 whenUnknown이 한다. */
  when: string | null
  /** 사용자가 "모름"을 눌렀는지. 서버로는 when과 함께 null로 나가지만, 화면에서는
   *  "아직 답하지 않음"과 "모른다고 답함"을 구분해야 다음 버튼 활성화를 판단할 수 있다. */
  whenUnknown: boolean
  noticeStatus: DueNoticeStatus | null
  /** 공고일. noticeStatus가 "notified"일 때만 값을 갖는다. 기한 = 이 날짜 + 2개월. */
  noticeDate: string | null
  /** 문제 입금액(원 단위). 소명서 사실 기재 전용 — 준비도 판정에 쓰지 않는다. */
  amount: number | null
  amountUnknown: boolean
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
  /** Object URL of the masked, resized Blob. Must be revoked when the file goes away. */
  url: string
  masked: boolean
}

export interface PendingUpload {
  id: string
  name: string
  /** Object URL of the raw picked File, alive only until masking is confirmed or cancelled. */
  url: string
}
