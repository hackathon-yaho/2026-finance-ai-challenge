import { AMOUNT_MAP } from "../data"
import type { AmountInfo } from "../types"

export function getAmountInfo(amount: string | null): AmountInfo {
  const won = amount ? AMOUNT_MAP[amount] : undefined
  return {
    known: won !== undefined,
    short: won !== undefined ? (amount as string) : "45만원",
    formatted: (won ?? 450000).toLocaleString("ko-KR") + "원",
  }
}
