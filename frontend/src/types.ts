export type IntakeField = "when" | "notice" | "amount" | "kind" | "delivery" | "history" | "usage"

/**
 * 거래 방식 (spec.md F2-01a). `/api/intake`의 `deliveryMethod`.
 *
 * **직거래는 송장이 원래 없다.** F5-03의 공백 탐지가 이걸 모르면 직거래 사용자에게
 * **채울 방법이 없는 "발송 증빙 없음"** 을 영원히 띄우고 준비도를 깎는다.
 */
export type DeliveryMethod = "courier" | "in_person" | "not_applicable"

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
  /** 물품 거래일 때만 묻는다. `kind !== "goods"`면 서버로 `null`을 보낸다 (F2-01a). */
  delivery: string | null
  history: string | null
  usage: string | null
}

export type EvidenceId = "autopay" | "chat" | "bank" | "shipping" | "threat"

// ── 추출 카드 (api-contract.md `/api/evidence` 응답 스키마) ──────────────────
// 필드명을 계약 그대로(snake_case) 둔다. API를 붙일 때 변환 코드를 짜지 않기 위해서다.

export type Confidence = "high" | "medium" | "low"

/** 6종. `unknown`은 **정상 값**이다 — AI가 추측하지 않고 내린 값이므로 오류로 처리하지 않는다. */
/**
 * 카드 유형 7종 (계약 v1.10).
 *
 * `unknown`은 **정상 값**이다 — AI가 추측하지 않고 내린 값이라 오류로 다루지 않는다.
 * `intake`는 **AI가 아니라 백엔드가 문진 응답(지급정지일)으로 합성한 카드**다
 * (`event_id: "evt_intake_when"`, `source_image_index: null`). 증빙자료가 아니므로
 * 타임라인(3면)에는 있지만 **증빙자료 목록(4면)에는 없다.**
 *
 * `intake` 카드의 `confirmation_status`는 **항상 `user_confirmed`다** (계약 v1.11).
 * 세션 타임라인에 저장되지 않고 조회할 때마다 새로 합성되므로 확인·게이팅 대상이 될 수
 * 없다 — `pending`으로 오면 사용자가 확인할 화면이 없는데 F4-06 게이팅에 걸린다.
 */
export type SourceType = "chat" | "bank" | "shipping" | "threat" | "autopay" | "unknown" | "intake"

export type CardActor = "self" | "counterparty" | "system"

export type ConfirmationStatus = "pending" | "user_confirmed" | "user_corrected"

/**
 * 이름 2종은 `null`을 허용한다 — 값이 없는데 신뢰도가 "high"인 조합은 성립하지 않는다.
 * `occurred_at`·`actor`·`amount`는 3값 고정 (프론트가 배지로 항상 렌더하는 값).
 */
export interface FieldConfidence {
  occurred_at: Confidence
  actor: Confidence
  amount: Confidence
  counterparty_name: Confidence | null
  payer_name: Confidence | null
}

/** 0~1 정규화 좌표. LLM 비전이 낸 **근사 좌표**라 정밀 하이라이트를 전제하지 않는다. */
export interface SourceRegion {
  x: number
  y: number
  w: number
  h: number
}

export interface ExtractedCard {
  /** 불투명 문자열. 형식(`evt_{n}_{m}`)을 파싱해 의미를 꺼내 쓰지 않는다. */
  event_id: string
  source_image_index: number | null
  source_type: SourceType
  occurred_at: string | null
  actor: CardActor
  summary: string
  amount: number | null
  /** 대화 상대 표시명. `null`이 흔하다 — 잘린 캡처·마스킹. "읽기 실패"로 표시하지 않는다 */
  counterparty_name: string | null
  /** 입금 내역의 입금자 표기. 위와 같음 */
  payer_name: string | null
  identifiers: { tracking_no: string | null; account_last4: string | null }
  field_confidence: FieldConfidence
  source_region: SourceRegion | null
  confirmation_status: ConfirmationStatus
}

/** 사용자가 인라인 수정할 수 있는 필드만. 확인 불가한 값은 임의로 채우지 않고 미상으로 둔다. */
export interface CardEdits {
  occurred_at?: string | null
  amount?: number | null
  counterparty_name?: string | null
  payer_name?: string | null
}

export type EvidenceState = Record<EvidenceId, boolean>

export type ViewerId = "chat" | "bank" | "shipping" | "threat"

export interface TimelineEvent {
  time: string
  text: string
  gap?: boolean
  threat?: boolean
  action?: string
  srcToggle?: EvidenceId
  /**
   * 눌렀을 때 **업로드 화면으로 보낼 것**인지 (F5-03 `[추가하기]`).
   *
   * 목은 증거 유형 토글(`srcToggle`)로 공백을 메우는 시늉을 했지만, 서버 공백은 실제로
   * 자료를 더 올리는 것 말고 메울 방법이 없다.
   */
  toUpload?: boolean
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
  /** `/api/draft` 응답의 `sentenceId`와 같은 자리. 문장 제외가 이 값을 키로 쓴다. */
  id: string
  text: string
  badge: string | null
  ref: ViewerId | null
  note?: string
  /**
   * 이 문장의 근거가 된 **원본 이미지 인덱스** (F7-05, 계약의 `evidenceRefs[].imageIndex`).
   *
   * 0-base이고 브라우저 메모리의 업로드 배열 위치와 같다. `null`이면 이미지 근거가 없는
   * 문장이다(문진·본인 진술) — **없는 것이 정상이므로 오류로 다루지 않는다.**
   */
  imageIndex?: number | null
}

/** api-contract의 `reason` 4종. 문진의 한국어 선택지는 REASON_BY_KIND로 여기에 매핑한다. */
export type ReasonType = "goods" | "service" | "debt" | "unclear"

/**
 * 소명자료의 네 층 (reason-type-rules.md §2). **근거가 어디서 나왔는지**를 나타낸다.
 * 화면 묶음과 문구 톤이 이 값으로 갈린다.
 *
 * legal      ① 법정 첨부서류 — 시행령 제7조
 * fss        ② 금감원 표준 — 물품 거래·용역/급여 2종만 존재한다
 * common     ③ 공통 최소 자료 — 근거 문서 없음. 참고 안내
 * supporting ④ 보강 자료 — 실무 관행. 법령·금감원 근거 없음
 */
export type EvidenceTier = "legal" | "fss" | "common" | "supporting"

/**
 * 이 항목을 **누가 채우는가**.
 *
 * upload  — 서비스에 올리는 캡처
 * self    — 서비스에 올리지 않고 사용자가 은행에 직접 첨부 (신분증·재직증명서 등)
 * derived — 올린 자료에서 서버가 뽑아 채운다 (구매자–송금인 대조). 사용자가 갖다 낼 것이 없다
 */
export type FulfillBy = "upload" | "self" | "derived"

/**
 * 미보유일 때 무슨 일이 일어나는가. **tier와 독립된 축이다** — 같은 ②라도 항목마다 다르다.
 *
 * blocks — 준비도의 `필수증빙누락` 신호에 포함 (SUPPLEMENT_NEEDED)
 * notice — "미보유 — 보완 요청 사유가 될 수 있어요" 문구만. 준비도를 깎지 않는다
 * silent — 아무 표시도 하지 않는다
 *
 * `blocks`는 **사용자가 실제로 채울 수 있는 항목에만** 붙인다 — 이미 존재하거나 즉시 발급받을
 * 수 있는 자료다. 사후에 만들어야 하는 자료에 붙이면 서비스가 증거 조작을 유도하는 셈이 된다.
 */
export type MissingEffect = "blocks" | "notice" | "silent"

/**
 * met                — 충족
 * unmet              — 미보유
 * unknown            — 확인 불가 (대조할 값 한쪽이 없음 등). **불일치가 아니다**
 * needs_explanation  — 값은 나왔으나 소명서에 설명이 필요함 (구매자–송금인 불일치)
 *                      **위험 신호가 아니다.** 준비도를 깎지 않고 경고색으로 칠하지 않는다
 */
export type ChecklistStatus = "met" | "unmet" | "unknown" | "needs_explanation"

/** 택일(OR) 그룹의 선택지. 하나만 충족되면 그룹 전체가 met이다. */
export interface ChecklistOption {
  id: string
  label: string
  /** upload 선택지를 채우는 업로드 자료 */
  sources?: EvidenceId[]
}

/** 카탈로그 정의 — 사유유형별로 무엇을 묻는지. data.ts의 EVIDENCE_CATALOG가 값을 갖는다. */
export interface ChecklistEntry {
  id: string
  label: string
  tier: EvidenceTier
  fulfillBy: FulfillBy
  whenMissing: MissingEffect
  /** 있으면 택일 그룹. 없으면 단일 항목 */
  anyOf?: ChecklistOption[]
  /** 단일 upload 항목을 채우는 업로드 자료 */
  sources?: EvidenceId[]
  /** 화면에 그대로 노출하는 보조 문구 */
  note?: string
}

/**
 * 판정 결과. `/api/readiness`·`/api/draft`의 `checklist` 배열 원소와 **같은 모양이다.**
 *
 * **`sources`를 상속하지 않는다.** 그 값은 목이 `status`를 계산하려고 쓰는 입력이고,
 * 실제로는 **서버가 확인된 카드로 `status`를 계산해서 내려준다.** 응답 타입에 남겨두면
 * API를 붙였을 때 `undefined`가 되는데, 지금은 목에 값이 있어서 문제가 드러나지 않는다.
 * (백엔드 회신 `docs/response/frontend/evidence-structure-revision.md` 말미 지적)
 */
export interface ChecklistItem extends Omit<ChecklistEntry, "anyOf" | "sources"> {
  status: ChecklistStatus
  options?: (ChecklistOption & { status: ChecklistStatus })[]
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
