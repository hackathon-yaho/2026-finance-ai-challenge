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
  /** 아직 확인하지 않은 카드 수 · 그중 진행을 막는 카드 수 (저신뢰 또는 시각 미상) */
  unconfirmed: { pending: number; blocking: number },
  historyOverride: boolean | null,
): ReadinessResult {
  // `필수증빙누락`은 blocks 항목만 본다. 금감원 표준 미충족은 여기에 들어가지 않는다.
  const blocking = blockingItems(checklist)
  const bankUnknown = historyOverride === null ? intake.history === "있어요" : historyOverride

  /**
   * `미확인필드` 신호 (reason-type-rules.md §3).
   *
   * **저신뢰 카드만이 아니라 미확인 카드 전부가 신호다** — "사용자가 확인하지 않은 카드
   * 또는 낮은 신뢰도 필드가 남아 있음". 확인하지 않은 카드의 사실은 소명서에 들어가지
   * 않으므로(F4-06), 그 상태를 "제출 준비 완료"라고 부르면 사용자가 **자기가 올린 자료의
   * 절반만 담긴 서류**를 다 갖춘 것으로 오해한다.
   */
  const hasUnconfirmed = unconfirmed.pending > 0

  let key: ReadinessResult["key"]
  let label: string
  if (hasUnconfirmed || blocking.length > 0) {
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
        ok: !hasUnconfirmed,
        desc:
          unconfirmed.blocking > 0
            ? `먼저 확인해야 하는 자료 ${unconfirmed.blocking}건이 있어요`
            : hasUnconfirmed
              ? `확인하지 않은 자료 ${unconfirmed.pending}건은 문서에 들어가지 않아요`
              : "올린 자료를 모두 확인했어요",
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
