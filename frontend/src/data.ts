import type { DueNoticeStatus, EvidenceId, IntakeField, ViewerId } from "./types"

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
    fields: ["kind", "history", "usage"],
  },
]

export const EVIDENCE_META: { id: EvidenceId; title: string; meta: string; badge: string; viewer: ViewerId }[] = [
  { id: "autopay", title: "통신비 자동이체 내역", meta: "2026.08.15 · 12개월", badge: "계좌", viewer: "bank" },
  { id: "chat", title: "구매자와의 대화", meta: "2026.09.01 13:40", badge: "대화", viewer: "chat" },
  { id: "bank", title: "입금 내역", meta: "2026.09.01 14:12", badge: "계좌", viewer: "bank" },
  { id: "shipping", title: "택배 송장", meta: "2026.09.01 16:05", badge: "배송", viewer: "shipping" },
]

export const REQUIRED_EVIDENCE: Record<string, EvidenceId[]> = {
  "중고 물건 판매": ["chat", "bank", "shipping", "autopay"],
  "용역·알바 대가": ["chat", "bank", "autopay"],
  "빌려준 돈 회수": ["chat", "bank", "autopay"],
  "잘 모르겠어요": ["bank", "autopay"],
}

export const CHECK_LABELS: Record<string, [EvidenceId, string][]> = {
  "중고 물건 판매": [
    ["chat", "거래 대화 내역"],
    ["bank", "입금 내역"],
    ["shipping", "물품 발송 증빙"],
    ["autopay", "생계 흔적 (자동이체)"],
  ],
  "용역·알바 대가": [
    ["chat", "용역 내용 증빙"],
    ["bank", "입금 내역"],
    ["shipping", "결과물 전달 기록"],
    ["autopay", "생계 흔적 (자동이체)"],
  ],
  "빌려준 돈 회수": [
    ["chat", "대여 사실 증빙"],
    ["bank", "최초 송금 기록"],
    ["autopay", "생계 흔적 (자동이체)"],
  ],
  "잘 모르겠어요": [
    ["bank", "입금 내역"],
    ["autopay", "생계 흔적 (자동이체)"],
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
  { title: "표준 심사 기간", desc: "자료를 충분히 갖춰 낸 경우", value: "5영업일" },
]
