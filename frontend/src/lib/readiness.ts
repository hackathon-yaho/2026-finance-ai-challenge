import { blockingItems } from "./checklist"
import type { ChecklistItem, IntakeAnswers, ReadinessResult } from "../types"

/**
 * 제출 준비도 산출 (reason-type-rules.md §3 · spec.md F6-04).
 *
 * 최종 소유는 백엔드 `ReadinessService`(결정적 규칙 엔진)다. API를 붙이면 이 함수는
 * `/api/readiness` 응답으로 대체된다. 그때까지 같은 규칙을 여기서 계산한다.
 *
 * **승인·기각을 예측하지 않는다.** 산출하는 것은 "제출 서류가 갖춰졌는가"이지
 * "해제될 것인가"가 아니다.
 */
export function computeReadiness(
  intake: IntakeAnswers,
  checklist: ChecklistItem[],
  unconfirmed: boolean,
  historyOverride: boolean | null,
): ReadinessResult {
  // `필수증빙누락`은 blocks 항목만 본다. 금감원 표준 미충족은 여기에 들어가지 않는다.
  const blocking = blockingItems(checklist)
  const bankUnknown = historyOverride === null ? intake.history === "있어요" : historyOverride

  let key: ReadinessResult["key"]
  let label: string
  if (unconfirmed || blocking.length > 0) {
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
        ok: blocking.length === 0,
        desc:
          blocking.length > 0
            ? `${blocking[0].label} 확인이 필요해요`
            : "반드시 필요한 자료를 갖췄어요",
      },
      {
        name: "은행 확인 사항",
        ok: !bankUnknown,
        desc: bankUnknown ? "과거 지급정지 이력이 있어 은행이 직접 확인해야 해요" : "과거 이력이 없고 자료 간 충돌도 없어요",
      },
    ],
  }
}
