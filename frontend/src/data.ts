import type {
  ChecklistEntry,
  DeliveryMethod,
  DueNoticeStatus,
  EvidenceId,
  EvidenceTier,
  IntakeField,
  ReasonType,
  ViewerId,
} from "./types"

export const STEP_LABELS = ["상황 접수", "증거 정리", "준비도", "소명서", "접수"]

/**
 * 문항별 입력 형식 (spec.md F2-01 "날짜 선택 / 금액 직접 입력 / 단일 선택 칩").
 * `notice`는 상태 칩 + 통지받은 경우의 공고일 입력이 한 문항으로 묶인 형태다.
 */
export type IntakeInput = "date" | "notice" | "amount" | "chips"

export const QUESTIONS: {
  id: IntakeField
  label: string
  short: string
  input: IntakeInput
  hint?: string
  options?: string[]
}[] = [
  {
    id: "when",
    label: "계좌가 언제 정지됐나요?",
    short: "정지 시점",
    input: "date",
    hint: "지급정지 통지서에 적힌 날짜예요.",
  },
  {
    id: "notice",
    label: "채권소멸절차 개시 공고를 받았나요?",
    short: "공고",
    input: "notice",
  },
  {
    id: "amount",
    label: "정지된 입금액은 얼마인가요?",
    short: "입금액",
    input: "amount",
    hint: "소명서에 사실로 적기만 해요. 금액으로 준비도를 판정하지 않아요.",
  },
  {
    id: "kind",
    label: "이 입금은 어떤 거래였나요?",
    short: "거래 성격",
    input: "chips",
    options: ["중고 물건 판매", "용역·알바 대가", "빌려준 돈 회수", "잘 모르겠어요"],
  },
  {
    // F2-01a — **물품 거래일 때만** 노출한다(INTAKE_PAGES의 `showWhen`).
    // 용역·채권 회수에는 배송 개념이 없어 "해당 없음"만 고르게 되는 문항이 하나 늘 뿐이다.
    id: "delivery",
    label: "물건을 어떻게 건네셨나요?",
    short: "거래 방식",
    input: "chips",
    hint: "직접 만나서 건넨 경우에는 송장이 없어도 괜찮아요.",
    options: ["택배로 보냈어요", "직접 만나서 건넸어요", "해당 없어요"],
  },
  {
    id: "history",
    label: "이 계좌가 과거에도 지급정지된 적 있나요?",
    short: "과거 이력",
    input: "chips",
    options: ["없어요", "있어요"],
  },
  {
    id: "usage",
    label: "이 계좌를 얼마나 쓰세요?",
    short: "계좌 사용",
    input: "chips",
    options: ["주 거래 계좌예요", "가끔 써요", "거의 안 써요"],
  },
]

/** ② 채권소멸절차 개시 공고 — api-contract의 dueNoticeStatus 3종. */
export const NOTICE_OPTIONS: { value: DueNoticeStatus; label: string }[] = [
  { value: "notified", label: "통지받았어요" },
  { value: "not_yet", label: "아직 없어요" },
  { value: "unknown", label: "모름" },
]

/** 요약 칩(F2-02)에 쓰는 짧은 표기. */
export const NOTICE_LABEL: Record<DueNoticeStatus, string> = {
  notified: "통지받음",
  not_yet: "아직 없음",
  unknown: "모름",
}

// 상황 접수(stage 1)를 3문항씩 두 페이지로 나눈다.
// 1페이지 = FR-014 이의제기 기한 계산 입력, 2페이지 = 하위 단계 분기용 거래 맥락.
export const INTAKE_PAGES: { title: string; desc: string; fields: IntakeField[] }[] = [
  {
    title: "무슨 일이 있었나요",
    desc: "정지 시점과 공고 여부로 이의제기 기한을 계산해요.",
    fields: ["when", "notice", "amount"],
  },
  {
    title: "어떤 거래였나요",
    desc: "거래 성격에 따라 준비할 자료가 달라져요. 자료가 없어도 진행할 수 있어요.",
    fields: ["kind", "delivery", "history", "usage"],
  },
]

/**
 * 조건부 노출 (F2-01a). 해당 없는 사용자에게는 문항 자체가 보이지 않는다 —
 * 무조건 7문항으로 늘리지 않는다.
 */
export function isFieldVisible(field: IntakeField, kind: string | null): boolean {
  return field !== "delivery" || REASON_BY_KIND[kind ?? ""] === "goods"
}

export const EVIDENCE_META: { id: EvidenceId; title: string; meta: string; badge: string; viewer: ViewerId }[] = [
  { id: "autopay", title: "통신비 자동이체 내역", meta: "2026.08.15 · 12개월", badge: "계좌", viewer: "bank" },
  { id: "chat", title: "구매자와의 대화", meta: "2026.09.01 13:40", badge: "대화", viewer: "chat" },
  { id: "bank", title: "입금 내역", meta: "2026.09.01 14:12", badge: "계좌", viewer: "bank" },
  { id: "shipping", title: "택배 송장", meta: "2026.09.01 16:05", badge: "배송", viewer: "shipping" },
]

/** 거래 방식 선택지 → 계약의 `deliveryMethod`. */
export const DELIVERY_BY_LABEL: Record<string, DeliveryMethod> = {
  "택배로 보냈어요": "courier",
  "직접 만나서 건넸어요": "in_person",
  "해당 없어요": "not_applicable",
}

/** 문진의 한국어 선택지 → api-contract의 `reason` 4종. */
export const REASON_BY_KIND: Record<string, ReasonType> = {
  "중고 물건 판매": "goods",
  "용역·알바 대가": "service",
  "빌려준 돈 회수": "debt",
  "잘 모르겠어요": "unclear",
}

export const TIER_SECTIONS: { tier: EvidenceTier; title: string; desc: string }[] = [
  { tier: "legal", title: "반드시 내야 하는 것", desc: "시행령 제7조가 정한 첨부서류예요." },
  { tier: "fss", title: "은행이 바로 심사할 수 있는 자료", desc: "금융감독원이 정리한 기준이에요. 없다고 접수가 막히지는 않아요." },
  { tier: "common", title: "있으면 도움이 되는 자료", desc: "정해진 기준이 없는 유형이라 참고로만 안내해요." },
  { tier: "supporting", title: "함께 내면 도움이 되는 자료", desc: "관행상 함께 내는 자료예요. 없어도 불이익은 없어요." },
]

// ── 소명자료 카탈로그 (reason-type-rules.md §2 · spec.md F7-03) ──────────────
//
// 종전에는 사유마다 EvidenceId 평면 배열 하나(REQUIRED_EVIDENCE)를 두고 전부 AND로 봤다.
// 그 구조는 두 가지를 표현할 수 없어서 실제 사용자를 막았다.
//   ① 택일 — "계약서·세금계산서·거래명세서 중 하나"를 셋 다 요구했다
//   ② 채울 수 없는 항목 — 개인 중고거래자는 사업자등록증을 발급받을 수 없는데
//      미보유로 잡혀 영원히 "증빙 보완 필요"가 나왔다 (TC-21·TC-22)
//
// 그래서 층(tier)과 미보유 효과(whenMissing)를 **독립된 두 축**으로 분리했다.
// 같은 ②(금감원 표준)라도 재직 증빙은 즉시 발급받을 수 있어 blocks이고,
// 사업자등록증은 발급 자체가 불가능할 수 있어 silent다.
const LEGAL_ENTRIES: ChecklistEntry[] = [
  {
    id: "legal.proof",
    label: "사기이용계좌가 아니라는 사실을 증명하는 자료",
    tier: "legal",
    fulfillBy: "upload",
    // 자유 형식이다. 확인된 자료가 하나라도 있으면 충족으로 본다 — 서비스 산출물
    // 전체(진술서·타임라인·증빙목록·원본)가 여기에 해당한다 (spec.md F7-03 ①).
    whenMissing: "blocks",
    sources: ["chat", "bank", "shipping", "autopay", "threat"],
    note: "정해진 양식이 없어요. 올리신 자료로 저희가 만들어드려요.",
  },
  {
    id: "legal.id_copy",
    label: "명의인 신분증 사본",
    tier: "legal",
    fulfillBy: "self",
    // 서비스가 받지 않는 자료라 보유 여부를 판정할 수 없다. blocks로 두면 전원이
    // 영원히 "보완 필요"가 된다 — 채울 수 없는 요구를 만들지 않는다.
    whenMissing: "silent",
    note: "여기에 올리지 마세요. 은행에 낼 때 직접 첨부해주세요.",
  },
]

const SUPPORTING_ENTRIES: ChecklistEntry[] = [
  {
    id: "supporting.life_activity",
    label: "생계 흔적 (통신비·공과금 자동이체)",
    tier: "supporting",
    fulfillBy: "upload",
    // 간소화 절차의 고려 요소지 소명자료 요건이 아니다. 서비스는 생계 여부를
    // 판정하지 않으므로(reason-type-rules.md §3) 준비도에 넣지 않는다.
    whenMissing: "silent",
    sources: ["autopay"],
  },
  {
    id: "supporting.identity",
    label: "재직증명서 · 소득금액증명원 · 예금거래내역서",
    tier: "supporting",
    fulfillBy: "self",
    whenMissing: "silent",
    note: "함께 제출하는 경우가 많아요. 여기에 올리지 않고 직접 첨부하시면 돼요.",
  },
  {
    id: "supporting.threat",
    label: "협박 메시지 (해당하는 경우에만)",
    tier: "supporting",
    fulfillBy: "upload",
    whenMissing: "silent",
    sources: ["threat"],
  },
  {
    id: "supporting.police_record",
    label: "경찰 신고 접수증 · 수사 결과 통지서 (해당하는 경우에만)",
    tier: "supporting",
    fulfillBy: "self",
    // 해당하는 사람만 선택적으로 보게 둔다. "고소당하셨나요?" 같은 질문을 전면에 두지
    // 않는다 — 이미 불안한 사용자에게 공포를 더한다 (evidence-structure-revision §6).
    whenMissing: "silent",
    note: "신고했거나 수사가 진행 중이라면 도움이 될 수 있어요. 해당 없으면 넘어가세요.",
  },
]

const BANK_RECORD: ChecklistEntry = {
  id: "common.bank_record",
  label: "해당 입금 건의 계좌 거래내역",
  tier: "common",
  fulfillBy: "upload",
  whenMissing: "notice",
  sources: ["bank"],
}

/**
 * **물품 거래(goods)에만 있다.** 금감원 표준 소명자료 표에도 물품 거래 행에만 있고,
 * `reason-type-rules.md` §2-1이 "용역·급여, 채권 회수, 기타 유형의 체크리스트에는 넣지
 * 않는다"고 못 박고 있다. 종전에는 4개 유형 전부에 라벨만 바꿔 두었는데, 백엔드 Phase 4
 * 구현이 문서를 따라 `service`/`debt`/`unclear` 응답에서는 이 항목을 아예 내리지 않는다
 * (`docs/request/frontend/readiness-checklist-catalog-diffs.md` §1).
 *
 * 사용자가 갖다 낼 것이 없는 항목이다. 대조는 백엔드가 하고, 불일치는 위험 신호가
 * 아니라 "설명이 필요한 항목"이다 (TC-25).
 */
const PAYER_MATCH: ChecklistEntry = {
  id: "payer_match",
  label: "구매자–송금인 일치 여부",
  tier: "fss",
  fulfillBy: "derived",
  whenMissing: "silent",
  note: "올리신 대화와 입금 내역에서 저희가 대조해요.",
}

export const EVIDENCE_CATALOG: Record<ReasonType, ChecklistEntry[]> = {
  goods: [
    ...LEGAL_ENTRIES,
    {
      id: "goods.chat",
      // 중고거래 앱 거래 내역도 여기에 넣는다. **증거 유형을 새로 만들지 않는다** —
      // 실제 유형은 AI의 `source_type` 6종 고정이라 프론트만 늘리면 죽은 코드가 된다
      // (백엔드 회신 2026-08-25 B안 채택).
      label: "거래 상대방과의 대화 · 중고거래 앱 거래 내역",
      tier: "fss",
      fulfillBy: "upload",
      // 이미 지운 사람은 다시 만들 수 없다(P-02 사례). 안내는 하되 막지는 않는다.
      whenMissing: "notice",
      sources: ["chat"],
    },
    {
      id: "goods.trade_doc",
      label: "거래 사실을 보이는 서류",
      tier: "fss",
      // **업로드가 아니라 자가 진술이다** (백엔드 Phase 4 구현, 2026-08-26).
      // ① 카드의 `source_type` 6종에 이 서류를 가리키는 값이 없어 애초에 `upload` 판정이
      //    성립하지 않는다 — 종전에 `sources`를 비워둔 채로 둔 이유가 그것이었다.
      // ② `notice`("보완 요청 사유가 될 수 있어요")는 가서 받아오라는 뉘앙스인데,
      //    이 서류는 사후에 만들면 증거 조작이다. 없는 것이 정상인 항목을 재촉하지 않는다.
      fulfillBy: "self",
      whenMissing: "silent",
      anyOf: [
        { id: "goods.trade_doc.contract", label: "계약서" },
        { id: "goods.trade_doc.tax_invoice", label: "세금계산서" },
        { id: "goods.trade_doc.statement", label: "거래명세서" },
      ],
      note: "이 중 하나만 있으면 돼요. 개인 간 거래라 셋 다 없어도 괜찮아요.",
    },
    { ...PAYER_MATCH },
    {
      id: "goods.business_reg",
      label: "사업자등록증",
      tier: "fss",
      fulfillBy: "self",
      // 개인은 발급 자체가 불가능하다. 미보유를 붉게 칠하지 않는다 (TC-21).
      whenMissing: "silent",
      note: "사업자가 아니면 넘어가세요.",
    },
    { ...BANK_RECORD },
    {
      id: "goods.delivery",
      label: "물품 발송 증빙 (택배 송장 등)",
      tier: "common",
      fulfillBy: "upload",
      // 직거래는 송장이 원래 없다. 직거래 분기는 evidence-structure-revision §3
      // 회신 후 확정한다 — 그때까지 준비도를 깎지 않는다.
      whenMissing: "notice",
      sources: ["shipping"],
    },
    ...SUPPORTING_ENTRIES,
  ],
  service: [
    ...LEGAL_ENTRIES,
    {
      id: "service.employment",
      label: "일한 사실을 보이는 서류",
      tier: "fss",
      fulfillBy: "self",
      // 근로자라면 즉시 온라인 발급이 가능한 자료다 — 채울 수 있으므로 blocks (TC-02).
      whenMissing: "blocks",
      anyOf: [
        { id: "service.employment.insurance", label: "건강보험 자격득실 확인서" },
        { id: "service.employment.certificate", label: "재직증명서" },
      ],
      note: "이 중 하나만 있으면 돼요. 정부24·건강보험공단에서 바로 뗄 수 있어요.",
    },
    {
      id: "service.payroll",
      label: "급여 입금내역",
      tier: "fss",
      fulfillBy: "upload",
      whenMissing: "notice",
      sources: ["bank"],
    },
    {
      id: "service.work_record",
      label: "용역 내용·결과물 전달 기록",
      tier: "common",
      fulfillBy: "upload",
      whenMissing: "notice",
      sources: ["chat"],
    },
    ...SUPPORTING_ENTRIES,
  ],
  // 채권 회수·미확정은 금감원 표준이 존재하지 않는다. 공통 최소 자료를 참고 안내로만
  // 제시하고 "필수"라고 쓰지 않는다 (reason-type-rules.md §2-2, TC-22).
  debt: [
    ...LEGAL_ENTRIES,
    {
      id: "debt.contact",
      label: "상대방과의 대화·연락 기록",
      tier: "common",
      fulfillBy: "upload",
      whenMissing: "notice",
      sources: ["chat"],
    },
    { ...BANK_RECORD },
    {
      id: "debt.loan_record",
      label: "빌려준 사실을 보이는 자료 (차용증·최초 이체 기록)",
      tier: "common",
      fulfillBy: "self",
      // 차용증 없는 대여가 흔하다(P-05). 없다고 표시조차 하지 않는다 (TC-22).
      whenMissing: "silent",
      note: "차용증이 없어도 괜찮아요. 송금 기록과 대화로도 대여 사실을 보일 수 있어요.",
    },
    ...SUPPORTING_ENTRIES,
  ],
  unclear: [
    ...LEGAL_ENTRIES,
    {
      id: "unclear.contact",
      label: "상대방과의 대화·연락 기록",
      tier: "common",
      fulfillBy: "upload",
      whenMissing: "notice",
      sources: ["chat"],
    },
    { ...BANK_RECORD },
    ...SUPPORTING_ENTRIES,
  ],
}

export const ROUTES: { title: string; desc: string; badge: "official" | "secondary" }[] = [
  { title: "금융회사 이의제기 접수", desc: "그 계좌를 관리하는 금융회사예요", badge: "official" },
  { title: "영업점 창구 방문", desc: "원본 확인을 요청받을 수 있어요", badge: "secondary" },
  { title: "금융감독원 민원", desc: "공식 제출처와 구분된 보조 경로예요", badge: "secondary" },
]

export const INTRO_STATS = [
  { title: "계좌 지급정지", desc: "5대 은행 · 최근 1년", value: "149,176건" },
  { title: "보이스피싱 발생", desc: "같은 기간 · 전년 대비", value: "▼35.5%" },
  // 숫자 자체는 금감원 2026.5 기준의 사실이지만, "5영업일"은 **심사 결과 통보** 기한이지
  // 돈을 쓸 수 있게 되는 시점이 아니다 (법 제8조 제2항 — 피해자 통보일로부터 2개월 제한).
  // 첫 화면에서 이 구분이 빠지면 사용자가 해제 기한으로 읽는다.
  { title: "심사 결과 통보", desc: "자료를 충분히 갖춰 낸 경우 · 해제 시점은 아니에요", value: "5영업일" },
]
