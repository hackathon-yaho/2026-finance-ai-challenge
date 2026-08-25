import { NOTICE_LABEL } from "../data"
import { formatWon } from "./amount"
import { formatDot } from "./date"
import type { IntakeAnswers, IntakeField } from "../types"

/**
 * 문항이 답해졌는지. 값 형식이 문항마다 다르고 "모름"도 유효한 응답이라
 * `intake[field] !== null` 한 줄로는 판단할 수 없다 (spec.md F2-01 수용 기준).
 */
export function isAnswered(intake: IntakeAnswers, field: IntakeField): boolean {
  switch (field) {
    case "when":
      return intake.when !== null || intake.whenUnknown
    case "notice":
      if (intake.noticeStatus === null) return false
      // 통지받았다면 공고일까지 있어야 기한(공고일 + 2개월)을 계산할 수 있다.
      return intake.noticeStatus !== "notified" || intake.noticeDate !== null
    case "amount":
      return intake.amount !== null || intake.amountUnknown
    default:
      return intake[field] !== null
  }
}

/** F2-02 요약 칩에 보여줄 값. null이면 미응답. */
export function summaryValue(intake: IntakeAnswers, field: IntakeField): string | null {
  switch (field) {
    case "when":
      if (intake.when) return formatDot(intake.when)
      return intake.whenUnknown ? "모름" : null
    case "notice":
      if (intake.noticeStatus === null) return null
      if (intake.noticeStatus === "notified") return intake.noticeDate ? formatDot(intake.noticeDate) : null
      return NOTICE_LABEL[intake.noticeStatus]
    case "amount":
      if (intake.amount !== null) return formatWon(intake.amount)
      return intake.amountUnknown ? "모름" : null
    default:
      return intake[field]
  }
}

/**
 * 단일 선택 칩 문항의 현재 값. 날짜·금액 문항은 값 형식이 달라 여기서는 항상 null이다
 * (호출부가 `input === "chips"`인 문항에서만 쓴다).
 */
export function chipValue(intake: IntakeAnswers, field: IntakeField): string | null {
  switch (field) {
    case "kind":
    // 거래 방식(F2-01a)은 나중에 추가된 문항이라 여기서 빠져 있었다. 값은 저장되는데
    // 읽어주는 곳이 없어 **선택해도 칩에 색이 안 들어왔다** — 고른 것이 화면에 남지 않으니
    // 사용자는 눌리지 않았다고 읽는다.
    case "delivery":
    case "history":
    case "usage":
      return intake[field]
    default:
      return null
  }
}
