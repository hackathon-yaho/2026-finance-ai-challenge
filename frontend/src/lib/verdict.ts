import { AMOUNT_OPTIONS } from "../data"
import type { CriterionResult, EvidenceState, IntakeAnswers, VerdictResult } from "../types"

function buildCriteria(amountIdx: number, smallAmount: boolean, noHistory: boolean, lifeSignal: boolean): CriterionResult[] {
  return [
    {
      name: "소액 요건",
      ok: smallAmount,
      desc:
        amountIdx === -1
          ? "입금액 정보가 없어요"
          : smallAmount
            ? "입금액이 소액 구간에 해당해요"
            : "입금액이 소액 기준을 초과해요",
    },
    {
      name: "이력 없음 요건",
      ok: noHistory,
      desc: noHistory ? "과거 지급정지 이력이 없어요" : "과거 지급정지 이력이 확인됐어요",
    },
    {
      name: "생계 흔적 요건",
      ok: lifeSignal,
      desc: lifeSignal ? "자동이체 등 생활 반응 흔적이 있어요" : "생활 반응 흔적을 찾지 못했어요",
    },
  ]
}

export function computeVerdict(
  intake: IntakeAnswers,
  evidence: EvidenceState,
  historyOverride: boolean | null,
): VerdictResult {
  const amountIdx = intake.amount === null ? -1 : AMOUNT_OPTIONS.indexOf(intake.amount as (typeof AMOUNT_OPTIONS)[number])
  const smallAmount = amountIdx === 0 || amountIdx === 1

  let hasHistory = intake.history === "있어요"
  if (historyOverride !== null) hasHistory = historyOverride

  const lifeSignal = evidence.autopay || intake.usage === "생활비·월급 등 주거래 계좌예요"
  const noHistory = !hasHistory
  const criteria = buildCriteria(amountIdx, smallAmount, noHistory, lifeSignal)

  if (!noHistory) {
    return {
      verdict: "reject",
      label: "별도 심사 없이 기각될 수 있어요",
      colorKey: "red",
      days: "정식 절차 (최대 5+5+3영업일) 안내가 필요해요",
      note: "과거 지급정지 이력이 있어 간소화 절차 대상이 아니에요. 전문가 상담을 권해요.",
      criteria,
    }
  }
  if (smallAmount && lifeSignal) {
    return {
      verdict: "approve",
      label: "일부 지급정지 적용 가능성이 높아요",
      colorKey: "blue",
      days: "5영업일 이내 예상",
      note: "소액 요건과 생계 흔적 요건을 모두 충족했어요.",
      criteria,
    }
  }
  return {
    verdict: "more",
    label: "추가 소명이 필요해요",
    colorKey: "orange",
    days: "5~10(+3)영업일 예상",
    note: "요건 일부가 확인되지 않아 자료 보완이 필요할 수 있어요.",
    criteria,
  }
}
