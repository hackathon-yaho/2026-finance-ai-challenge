import { REQUIRED_EVIDENCE } from "../data"
import type { EvidenceState, IntakeAnswers, ReadinessResult } from "../types"

export function computeReadiness(
  intake: IntakeAnswers,
  evidence: EvidenceState,
  bankConfirmed: boolean,
  historyOverride: boolean | null,
): ReadinessResult {
  const kind = intake.kind || "잘 모르겠어요"
  const required = REQUIRED_EVIDENCE[kind] ?? REQUIRED_EVIDENCE["잘 모르겠어요"]
  const unconfirmed = evidence.bank && !bankConfirmed
  const missing = required.filter((id) => !evidence[id])
  const bankUnknown = historyOverride === null ? intake.history === "있어요" : historyOverride

  let key: ReadinessResult["key"]
  let label: string
  if (unconfirmed || missing.length > 0) {
    key = "supplement"
    label = "증빙 보완 필요"
  } else if (bankUnknown) {
    key = "bankcheck"
    label = "은행 확인 필요"
  } else {
    key = "ready"
    label = "제출 준비 완료"
  }

  return {
    key,
    label,
    criteria: [
      {
        name: "자료 확인",
        ok: !unconfirmed,
        desc: unconfirmed ? "입금 내역의 금액을 아직 확인하지 않았어요" : "올린 자료를 모두 확인했어요",
      },
      {
        name: "필수 증빙",
        ok: missing.length === 0,
        desc: missing.length > 0 ? `사유별 필수 자료 ${missing.length}건이 없어요` : "사유별 필수 자료를 모두 갖췄어요",
      },
      {
        name: "은행 확인 사항",
        ok: !bankUnknown,
        desc: bankUnknown ? "과거 지급정지 이력이 있어 은행이 직접 확인해야 해요" : "과거 이력이 없고 자료 간 충돌도 없어요",
      },
    ],
  }
}
