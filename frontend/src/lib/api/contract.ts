import type { ChecklistItem, DeliveryMethod, DueNoticeStatus, ExtractedCard, ReasonType } from "../../types"

/**
 * 공개 API 요청·응답 타입 (api-contract.md).
 *
 * **계약 문서가 단일 출처다.** 여기서 계약에 없는 필드를 새로 만들지 않는다 —
 * 필요하면 계약을 먼저 고치고 백엔드에 알린다 (매몰 방지 원칙).
 */

// ── 세션 ────────────────────────────────────────────────────────────────────

export interface SessionResponse {
  sessionHash: string
  expiresAt: string
  /** `true`면 모든 화면 상단에 "예시 데이터 사용 중" 배지를 고정 노출한다 (F11-03). */
  demoMode: boolean
}

// ── 문진 ────────────────────────────────────────────────────────────────────

export interface IntakeRequest {
  when: string | null
  dueNoticeStatus: DueNoticeStatus
  dueNoticeDate: string | null
  /** 원 단위. **사실 기재 전용** — 준비도 판정에 쓰지 않는다. */
  amount: number | null
  kind: ReasonType
  /** F2-01a. **물품 거래가 아니면 `null`** — 묻지 않은 값을 보내지 않는다. */
  deliveryMethod: DeliveryMethod | null
  history: boolean
  usage: "main" | "occasional" | "rare"
}

export interface DeadlineNotice {
  date: string | null
  daysLeft: number | null
  /** **어떤 경우에도 `null`이 아니다.** 프론트는 항상 존재한다는 전제로 그린다. */
  notice: string
}

export interface IntakeResponse {
  ok: boolean
  nextStage: number
  deadline: DeadlineNotice
}

// ── 증거 판독 ───────────────────────────────────────────────────────────────

export interface QualityFlags {
  blurry: boolean
  missing_date: boolean
  amount_mismatch: boolean
}

export interface Signals {
  /** `true`면 **즉시** 협박 대응 배너를 띄운다. 다음 단계를 기다리지 않는다 (FR-024). */
  threat_detected: boolean
  delivery_evidence: boolean
  life_activity: boolean
  quality_flags: QualityFlags
}

export interface EvidenceResponse {
  cards: ExtractedCard[]
  signals: Signals
  /** `event_id`를 키로 한 **카드별** 품질. `signals.quality_flags`(이미지 전체)와 다른 값이다. */
  qualityFlags: Record<string, QualityFlags>
}

/**
 * 카드 확인·수정·삭제가 **한 엔드포인트**다 (계약 v1.8).
 *
 * `confirmed: false`는 "확인하지 않음"이 아니라 **카드 삭제**다 — F4-06 처리 ④의 "카드 삭제"에
 * 대응하는 필드가 계약에 따로 없어 이 값으로 정해졌다. 미확인 상태로 두는 것은 아무것도
 * 보내지 않는 것이고, `corrections`는 `confirmed: true`일 때만 의미가 있다.
 *
 * 유니온으로 나눠 둔 이유는 `{ confirmed: false, corrections: {...} }`처럼 **서버가 무시할 값을
 * 실어 보내는 코드가 타입에서 걸리게** 하기 위해서다.
 */
export type ConfirmRequest =
  | { cardId: string; confirmed: true; corrections?: Record<string, unknown> }
  | { cardId: string; confirmed: false }

export interface ConfirmResponse {
  ok: boolean
  confirmedCount: number
  unconfirmedCount: number
}

// ── 타임라인 ────────────────────────────────────────────────────────────────

export interface MergeCandidate {
  groupId: string
  eventIds: string[]
  /** 사용자에게 그대로 보여줄 수 있는 문장. 설명 없이 병합을 승인받지 않는다. */
  reason: string
}

/** 증거 공백 유형 (F5-03). 화면 분기는 `type`으로, 문구는 `label`을 그대로 쓴다. */
export type GapType = "no_delivery_evidence" | "no_service_evidence" | "no_life_activity" | "no_chat_evidence"

/**
 * 증거 공백 한 건 (계약 v1.8에서 스키마 신설).
 *
 * **백엔드가 계산해 내려주는 값이다** — AI 신호(`delivery_evidence`·`life_activity`)와 문진
 * 응답을 조합한 결과라 프론트가 다시 판정하지 않는다. 직거래(`deliveryMethod: "in_person"`)면
 * `no_delivery_evidence`는 애초에 오지 않는다 (F5-03 직거래 예외).
 */
export interface EvidenceGap {
  type: GapType
  /** 그대로 노출할 문구. 프론트가 유형별 문구를 따로 갖지 않는다. */
  label: string
  /** F5-04 대체 증빙 제안. **빈 배열이 정상**이다 (`no_life_activity`) — 제안 영역을 통째로 감춘다. */
  suggestions: string[]
}

export interface TimelineResponse {
  events: ExtractedCard[]
  gaps: EvidenceGap[]
  /** **판단 결과가 아니라 제안**이다. 백엔드는 자동 병합하지 않는다. 컷되면 항상 빈 배열. */
  mergeCandidates: MergeCandidate[]
}

// ── 준비도 ──────────────────────────────────────────────────────────────────

export type Readiness = "SUBMISSION_READY" | "SUPPLEMENT_NEEDED" | "BANK_CHECK_REQUIRED"

export interface ReadinessResponse {
  reason: ReasonType
  checklist: ChecklistItem[]
  readiness: Readiness
  missingItems: string[]
  conflicts: string[]
  /** "최종 판단은 은행이 합니다"가 항상 포함된다. **생략하지 않는다.** */
  notices: string[]
  /** 판정이 아니라 정보 제공. 고정 문구이며 입금액에 따라 달라지지 않는다. */
  smallAmountNotice: string
  /** 협박 감지 여부. `readiness`와 독립적으로 산출된다. */
  urgentAlert: boolean
}

// ── 소명서 ──────────────────────────────────────────────────────────────────

/**
 * 근거 유형 3종 (FR-045). `intake`·`user_text`에는 **`imageIndex`가 없는 것이 정상**이며
 * 프론트는 이 둘에 "본인 진술" 배지를 붙인다. 원본 이동 배지를 붙이면 갈 곳이 없다.
 */
export interface EvidenceRef {
  type: "evidence" | "intake" | "user_text"
  imageIndex?: number
  /** LLM 비전이 낸 **근사 좌표**. 픽셀 단위 정밀 하이라이트를 전제하지 않는다. */
  bbox?: { x: number; y: number; w: number; h: number }
}

export interface DraftSentence {
  sentenceId: string
  text: string
  evidenceRefs: EvidenceRef[]
}

export interface DraftResponse {
  draftText: string
  sentences: DraftSentence[]
  checklist: ChecklistItem[]
}

/**
 * 미리보기에서 고친 문장 (`POST /api/draft/revise`).
 *
 * `text`와 `excluded`를 **분리한다** — 한 필드에 두 의미를 넣지 않는다. 빈 문자열로
 * 삭제를 표현하면 되돌릴 수 없고, 빈 값과 공백만 입력한 값을 구분해야 한다.
 */
export interface ReviseSentence {
  sentenceId: string
  text?: string
  excluded?: boolean
}

export interface RevisedSentence {
  sentenceId: string
  text: string
  /**
   * 편집으로 근거가 끊기면 `evidence` → `user_text`가 되고 **"본인 진술" 배지로 바뀐다.**
   * 경고 문구는 읽고 넘기지만 배지가 바뀌는 건 눈에 보인다 — 둘 다 렌더한다.
   */
  sourceType: "evidence" | "intake" | "user_text"
  evidenceRefs: EvidenceRef[]
  /** 근거와 매칭되지 않을 때 채워진다. 받은 문자열을 그대로 노출한다 */
  warning: string | null
}

/**
 * **제외한 문장은 이 배열에서 빠진다** (계약 v1.9). `excluded` 플래그가 따로 없다.
 *
 * 그래서 응답으로 `draftLines`를 통째로 갈아끼우면 안 된다 — 제외한 문장이 화면에서
 * 사라져 **되돌릴 방법이 없어진다.** 원본 텍스트는 클라이언트가 계속 들고 있고
 * (`flow.draftLines` + `flow.excludedSentences`), 응답은 **남아 있는 문장의 갱신분으로만**
 * 병합한다. 되돌리기는 같은 `sentenceId`에 `excluded: false`를 다시 보내면 된다.
 */
export interface ReviseResponse {
  sentences: RevisedSentence[]
}

/** 자가 진술 체크 (`POST /api/checklist/self-held`). 응답은 **갱신된 전체 체크리스트**다. */
export interface SelfHeldResponse {
  checklist: ChecklistItem[]
}

// ── 제출 패키지 ─────────────────────────────────────────────────────────────

export interface PackageRequest {
  /**
   * 별지 제4호서식 필드. **전부 선택이며 빈 값이어도 400을 내지 않는다** — 빈 칸은
   * 공란으로 둔 작성 지원본이 나온다.
   *
   * 11필드는 **2026-08-25 계약 반영 완료**다 (`mobile`·`email`·`holderName` 신설).
   * `spec.md` F7-06·`prd.md` §4.4·§9까지 동기화됐다.
   */
  applicant: {
    name: string
    birthDate: string
    address: string
    phone: string
    mobile: string
    email: string
  }
  account: {
    bank: string
    branch: string
    depositType: string
    accountNumber: string
    holderName: string
  }
  /**
   * 미리보기에서 사용자가 뺀 문장. 문장을 빼는 것은 새 사실을 만들지 않아 F7-02 재검증이
   * 필요 없으므로 여기 싣는다 — `/api/draft/revise`가 밀려도 이 경로는 살아남는다.
   * **2026-08-25 계약 반영 완료** (선택, 기본 `[]`).
   */
  excludedSentenceIds?: string[]
}

// ── 헬스체크 ────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string
  db?: string
}
