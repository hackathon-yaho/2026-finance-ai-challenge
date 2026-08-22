import type { EvidenceId, IntakeField } from "./types"

export const AMOUNT_OPTIONS = ["50만원 미만", "50~300만원", "300만원 초과"] as const

export const QUESTIONS: { id: IntakeField; label: string; options: string[] }[] = [
  { id: "when", label: "계좌가 언제 정지됐나요?", options: ["오늘", "1~3일 전", "4일 이상 전"] },
  { id: "amount", label: "정지된 입금액은 얼마인가요?", options: [...AMOUNT_OPTIONS] },
  {
    id: "kind",
    label: "이 입금은 어떤 거래였나요?",
    options: ["중고 물건 판매", "용역·알바 대가", "빌려준 돈 회수", "잘 모르겠어요"],
  },
  { id: "history", label: "이 계좌가 과거에도 지급정지된 적 있나요?", options: ["없어요", "있어요"] },
  {
    id: "usage",
    label: "이 계좌를 얼마나 자주 쓰시나요?",
    options: ["생활비·월급 등 주거래 계좌예요", "가끔 쓰는 계좌예요"],
  },
]

export const EVIDENCE_META: { id: EvidenceId; title: string; time: string; kindLabel: string }[] = [
  { id: "autopay", title: "통신비 자동이체 내역", time: "2026.08.15", kindLabel: "계좌" },
  { id: "chat", title: "구매자와의 대화", time: "2026.09.01 13:40", kindLabel: "대화" },
  { id: "deposit", title: "입금 내역", time: "2026.09.01 14:12", kindLabel: "계좌" },
  { id: "shipping", title: "택배 송장", time: "2026.09.01 16:05", kindLabel: "사진" },
]

export const STAGE_NAMES = ["인트로", "상황 접수", "증거 수집", "판정", "소명서 생성", "접수 안내"]

export const ROUTES: { title: string; desc: string; badge: "recommended" | "conditional" }[] = [
  { title: "앱 이의제기 메뉴", desc: "가장 빠른 경로예요", badge: "recommended" },
  { title: "은행 창구 방문", desc: "서류 원본 확인이 필요할 수 있어요", badge: "conditional" },
  { title: "금융감독원 민원(파인)", desc: "은행 처리가 지연될 때 이용해요", badge: "conditional" },
]
