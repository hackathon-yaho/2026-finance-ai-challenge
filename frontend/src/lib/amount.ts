import type { AmountInfo } from "../types"

/**
 * 목업 샘플 캡처에 찍혀 있는 금액.
 *
 * 사용자가 입금액을 "모름"으로 두면 증거 화면·타임라인이 보여줄 숫자가 없어진다. 그 화면들이
 * 표현하는 건 업로드된 샘플 캡처의 내용이므로 이 값으로 되돌린다. 반대로 소명서 문장은
 * 사용자 진술이라 임의로 채우지 않는다 — FR-028 "확인 불가한 값은 미상으로 유지".
 * 그 구분을 `AmountInfo.known`이 한다.
 */
const SAMPLE_AMOUNT = 450000

/** "450,000원" */
export function formatWon(won: number): string {
  return `${won.toLocaleString("ko-KR")}원`
}

/**
 * 억·만 단위로 끊어 읽는 짧은 표기. 입력칸 아래 확인 문구와 대화·타임라인 문장에 쓴다.
 * 450000 → "45만원", 12345 → "1만 2,345원"
 */
export function formatKoreanAmount(won: number): string {
  if (won === 0) return "0원"
  const eok = Math.floor(won / 100_000_000)
  const man = Math.floor((won % 100_000_000) / 10_000)
  const rest = won % 10_000
  const parts: string[] = []
  if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`)
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만`)
  if (rest > 0) parts.push(rest.toLocaleString("ko-KR"))
  return `${parts.join(" ")}원`
}

export function getAmountInfo(amount: number | null): AmountInfo {
  const known = amount !== null
  const won = amount ?? SAMPLE_AMOUNT
  return { known, short: formatKoreanAmount(won), formatted: formatWon(won) }
}
