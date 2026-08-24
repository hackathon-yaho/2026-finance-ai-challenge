import { addMonths, diffDays, formatDot, todayISO } from "./date"
import type { IntakeAnswers } from "../types"

/**
 * FR-014 이의제기 기한 안내.
 *
 * 문구는 prd.md §4.1의 분기를 그대로 쓴다. 최종 소유는 백엔드다 — `POST /api/intake` 응답의
 * `deadline.notice`를 프론트가 순화하거나 줄이지 않고 그대로 노출하기로 확정했다
 * (docs/request/frontend/pdf-ownership-and-open-contracts.md §3-2). 법 제7조 제1항 근거의
 * 안내 문구라서 문장을 다듬는 것 자체가 계약 위반이다.
 *
 * API를 붙이기 전까지는 같은 규칙을 이 파일이 대신 계산한다. 문구를 바꿔야 하면 PRD와
 * 백엔드를 먼저 고치고 여기를 따라 맞춘다. 반대 방향으로 고치지 않는다.
 */
export interface DeadlineInfo {
  /** 기한일. 공고일을 모르면 null (api-contract의 deadline.date와 같은 의미). */
  date: string | null
  daysLeft: number | null
  notice: string
  /** 화면 강조용. 남은 기간이 짧거나 날짜를 모를 때 붉게 띄운다 — 법적 판단이 아니다. */
  urgent: boolean
}

/** 이 일수 이하로 남으면 배너를 붉게 띄운다. 문서에 정해진 값은 아니고 화면 강조 기준이다. */
const URGENT_DAYS = 14

export function getDeadline(intake: IntakeAnswers): DeadlineInfo | null {
  const { when, whenUnknown, noticeStatus, noticeDate } = intake

  // 아직 아무것도 답하지 않았으면 안내할 근거가 없다.
  if (when === null && !whenUnknown && noticeStatus === null) return null

  // ① 공고일을 알면 기한 = 공고일 + 2개월.
  if (noticeStatus === "notified" && noticeDate) {
    const date = addMonths(noticeDate, 2)
    const daysLeft = diffDays(todayISO(), date)
    if (daysLeft < 0) {
      // 기한 경과가 확실해도 "불가능"이라고 단정하지 않는다 (prd.md §4.1 단서).
      return {
        date,
        daysLeft,
        urgent: true,
        notice: `공고일부터 2개월이 지난 것으로 보입니다. (${formatDot(date)}) 기한 경과 여부와 이후 절차는 금융회사와 전문가 확인이 필요합니다.`,
      }
    }
    return {
      date,
      daysLeft,
      urgent: daysLeft <= URGENT_DAYS,
      notice: `이의제기 기한까지 ${daysLeft}일 남았습니다. (${formatDot(date)})`,
    }
  }

  // 통지받았다고 답했는데 공고일을 아직 안 고른 상태. 아래 ②로 내려가면 "아직 공고 전이라면"이라는
  // 앞뒤가 맞지 않는 안내가 나가므로, 날짜가 들어올 때까지 배너를 띄우지 않는다.
  // 이 상태로는 다음 단계로 넘어갈 수 없다 (lib/intake.ts의 isAnswered).
  if (noticeStatus === "notified") return null

  // ② 공고가 아직 없거나 모르는 경우. 지급정지일을 알면 기한이 남아 있다는 안내까지만 한다.
  if (when !== null) {
    return {
      date: null,
      daysLeft: null,
      urgent: false,
      notice:
        "아직 공고 전이라면 기한이 남아 있습니다. 공고일로부터 2개월이 기한이므로, 금융회사에 공고 여부를 먼저 확인하세요.",
    }
  }

  // ③ 지급정지일까지 모르는 경우.
  return {
    date: null,
    daysLeft: null,
    urgent: true,
    notice: "지급정지 통지서에서 날짜를 확인해 주세요. 기한이 지나면 예금채권이 소멸할 수 있습니다.",
  }
}
