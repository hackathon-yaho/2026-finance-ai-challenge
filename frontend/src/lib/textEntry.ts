import type { ExtractedCard, SourceType } from "../types"

/**
 * 텍스트 직접 입력 (spec.md F3-04 · FR-026).
 *
 * 캡처가 없거나 판독이 통째로 실패해도 진행할 수 있는 경로다. 화면 캡처가 무엇인지 모르는
 * 사용자(P-06)와 자료를 이미 지운 사용자(P-02)가 여기로 온다.
 *
 * **지켜야 할 것: 사용자가 말하지 않은 정확한 시각을 만들지 않는다.**
 * "9월 2일쯤"이라고 쓴 것을 "9월 2일 14시 12분"으로 바꾸면 은행에 내는 문서에 없던 사실이
 * 생긴다. 그래서 이 경로의 카드는 **날짜 신뢰도가 언제나 `low`** 이고(F3-04 처리),
 * 시각(시·분)은 아예 만들지 않는다.
 *
 * **API를 붙이면 `POST /api/evidence/text`가 이 일을 한다.** 여기 있는 것은 그때까지 쓰는
 * 목이며, AI-server도 같은 규칙(`occurred_at` 신뢰도 전부 `low`)을 강제한다.
 */

export const MAX_RAW_TEXT = 2000

export const TEXT_ENTRY_EXAMPLE =
  "9월 1일쯤 당근마켓에서 쓰던 아이패드를 45만원에 팔았어요. 구매자가 입금했다고 해서 확인하고 다음 날 택배로 보냈습니다. 이 계좌로 통신비도 매달 자동이체하고 있어요."

// ── 개인정보 자동 마스킹 (FR-027) ────────────────────────────────────────────
//
// **보내기 전에 지운다.** 이미지에서 사용자가 직접 가린 뒤 전송하는 것과 같은 원칙이다 —
// 지우고 보내면 LLM이 애초에 보지 않는다. 패턴은 좁게 잡는다. 넓게 잡으면 금액이나
// 계좌 뒷자리처럼 소명에 필요한 값까지 지워진다.
const PII_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "주민등록번호", re: /\b\d{6}\s*[-–]\s*[1-4]\d{6}\b/g },
  { label: "전화번호", re: /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g },
  { label: "계좌번호", re: /\b\d{2,6}[-\s]\d{2,6}[-\s]\d{2,7}\b/g },
]

export interface ScrubResult {
  text: string
  /** 무엇을 가렸는지. 사용자에게 알려주지 않으면 글이 왜 바뀌었는지 알 수 없다. */
  masked: string[]
}

export function scrubPii(raw: string): ScrubResult {
  let text = raw
  const masked: string[] = []
  for (const { label, re } of PII_PATTERNS) {
    if (re.test(text)) {
      masked.push(label)
      text = text.replace(re, "***")
    }
    re.lastIndex = 0
  }
  return { text, masked }
}

// ── 서술 → 카드 ─────────────────────────────────────────────────────────────

/**
 * **구체적인 유형을 먼저 본다.** "자동이체"에는 "이체"가 들어 있어서 순서를 뒤집으면
 * 통신비 자동이체가 입출금으로 잡힌다.
 */
const TYPE_HINTS: { type: SourceType; words: string[] }[] = [
  { type: "threat", words: ["협박", "신고 취하", "합의금", "보내면 풀어"] },
  { type: "autopay", words: ["자동이체", "통신비", "공과금", "월세", "관리비"] },
  { type: "shipping", words: ["택배", "송장", "발송", "보냈", "배송"] },
  { type: "bank", words: ["입금", "송금", "이체", "받았", "들어왔"] },
  { type: "chat", words: ["대화", "카톡", "메시지", "연락", "당근", "채팅"] },
]

function detectType(sentence: string): SourceType {
  for (const { type, words } of TYPE_HINTS) {
    if (words.some((word) => sentence.includes(word))) return type
  }
  // 추측하지 않는다. 유형을 못 정하면 `unknown`이 정상 값이다.
  return "unknown"
}

const DATE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/
const AMOUNT_MAN = /(\d+(?:\.\d+)?)\s*만\s*원/
const AMOUNT_PLAIN = /(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/

/** 연도는 사용자가 적지 않으면 올해로 둔다. 시·분은 **만들지 않는다.** */
function parseDate(sentence: string): string | null {
  const match = DATE.exec(sentence)
  if (!match) return null
  const month = String(Number(match[1])).padStart(2, "0")
  const day = String(Number(match[2])).padStart(2, "0")
  return `${new Date().getFullYear()}-${month}-${day}`
}

function parseAmount(sentence: string): number | null {
  const man = AMOUNT_MAN.exec(sentence)
  if (man) return Math.round(Number(man[1]) * 10000)
  const plain = AMOUNT_PLAIN.exec(sentence)
  if (plain) return Number(plain[1].replace(/,/g, ""))
  return null
}

/**
 * 문장 단위로 쪼개 이벤트로 만든다.
 *
 * 실제로는 LLM이 하는 일이라 이 목은 훨씬 거칠다. 다만 **불확실성을 그대로 남긴다**는
 * 규칙은 목에서도 똑같이 지킨다 — 그게 이 경로의 존재 이유다.
 */
export function buildTextCards(raw: string): ExtractedCard[] {
  const sentences = raw
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)

  const cards: ExtractedCard[] = []
  for (const sentence of sentences) {
    const type = detectType(sentence)
    const amount = parseAmount(sentence)
    const date = parseDate(sentence)
    // 유형도 날짜도 금액도 없는 문장은 사건이 아니다. 억지로 카드를 만들지 않는다.
    if (type === "unknown" && amount === null && date === null) continue

    cards.push({
      event_id: `evt_txt_${cards.length + 1}`,
      // 이미지에서 나온 것이 아니므로 참조할 원본이 없다 → 근거 유형이 `user_text`가 된다.
      source_image_index: null,
      source_type: type,
      occurred_at: date,
      actor: "self",
      summary: sentence.length > 60 ? `${sentence.slice(0, 60)}…` : sentence,
      amount,
      counterparty_name: null,
      payer_name: null,
      identifiers: { tracking_no: null, account_last4: null },
      field_confidence: {
        // F3-04 처리 — 이 경로는 **언제나** low다. 승격하지 않는다.
        occurred_at: "low",
        actor: "low",
        amount: amount === null ? "low" : "medium",
        counterparty_name: null,
        payer_name: null,
      },
      source_region: null,
      confirmation_status: "pending",
    })
  }
  return cards
}
