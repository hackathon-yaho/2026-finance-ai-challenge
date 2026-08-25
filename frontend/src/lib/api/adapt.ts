/**
 * 서버 응답 → 화면이 이미 쓰는 모양으로 옮긴다.
 *
 * **화면 컴포넌트는 이 파일 덕분에 손대지 않는다.** 목 함수들(`lib/cards`·`timeline`·
 * `readiness`·`draft`)이 만들던 값과 같은 타입을 돌려주므로, 훅에서 둘 중 하나를 고르기만
 * 하면 된다. 반대로 **화면 모양에 맞추려고 서버 값을 가공하지 않는다** — 문구를 다듬으면
 * 계약 위반이 되는 필드(`notice`·`notices`)가 있어서, 옮기기만 하고 고치지 않는다.
 */

import type { DraftLine, ReadinessResult, TimelineEvent } from "../../types"
import type { DeadlineInfo } from "../deadline"
import type { DraftResponse, EvidenceGap, IntakeResponse, ReadinessResponse, TimelineResponse } from "./contract"

/** 화면 강조 기준. `lib/deadline.ts`와 같은 값을 쓴다 — 법적 판단이 아니다. */
const URGENT_DAYS = 14

/**
 * `notice`는 **서버가 단일 소스**다 (`api-contract.md`). 법 제7조 제1항 근거의 안내라
 * 프론트가 순화하거나 줄이지 않고 그대로 옮긴다. `urgent`만 화면 강조용으로 덧붙인다.
 */
export function toDeadlineInfo(res: IntakeResponse): DeadlineInfo {
  const { date, daysLeft, notice } = res.deadline
  return {
    date,
    daysLeft,
    notice,
    // 날짜를 모르면 붉게, 알면 남은 일수로 판단한다. 경과(음수)도 붉게 띄운다.
    urgent: date === null || daysLeft === null || daysLeft <= URGENT_DAYS,
  }
}

/** `2026-09-01T14:12:00+09:00` → `2026.09.01 14:12`. 시각이 없으면 날짜만. */
function formatWhen(occurredAt: string | null): string {
  if (!occurredAt) return "시각 미상"
  const date = occurredAt.slice(0, 10).replace(/-/g, ".")
  return occurredAt.includes("T") ? `${date} ${occurredAt.slice(11, 16)}` : date
}

/**
 * 증거 공백을 타임라인 노드로 (F5-03).
 *
 * **`action` 버튼을 만들지 않는다.** 목에서는 그 버튼이 증거 토글을 켰지만, 실제로는 자료를
 * 더 올리는 것 말고 할 수 있는 일이 없다. 누르면 아무 일도 안 하는 버튼을 두지 않는다.
 * `suggestions`는 **비어 있는 것이 정상**이라(`no_life_activity`) 있을 때만 덧붙인다.
 */
function gapToEvent(gap: EvidenceGap): TimelineEvent {
  const hint = gap.suggestions.length > 0 ? ` · ${gap.suggestions.join(" · ")}` : ""
  return { time: "시각 미상", text: `${gap.label}${hint}`, gap: true }
}

/**
 * 화면 타임라인 — 이벤트 + 공백.
 *
 * 제출본 3면은 이걸 쓰지 않는다. `toSubmitTimeline`을 따로 두는 이유는 두 가지다 —
 * 3면은 **확인된 카드만** 싣고(계약 v1.10), **공백을 표시하지 않는다**(F8-01 금지 3가지).
 */
export function toTimelineEvents(res: TimelineResponse): TimelineEvent[] {
  const events: TimelineEvent[] = res.events.map((card) => ({
    time: formatWhen(card.occurred_at),
    text: card.summary,
    threat: card.source_type === "threat",
  }))
  return [...events, ...res.gaps.map(gapToEvent)]
}

/** 제출본 3면. 확인된 카드만, 공백 없이. */
export function toSubmitTimeline(res: TimelineResponse): TimelineEvent[] {
  return res.events
    .filter((card) => card.confirmation_status !== "pending")
    .map((card) => ({
      time: formatWhen(card.occurred_at),
      text: card.summary,
      threat: card.source_type === "threat",
    }))
}

const READINESS_LABEL = {
  SUBMISSION_READY: { key: "ready", label: "제출 준비 완료" },
  SUPPLEMENT_NEEDED: { key: "supplement", label: "증빙 보완 필요" },
  BANK_CHECK_REQUIRED: { key: "bankcheck", label: "은행 확인 필요" },
} as const

/**
 * 준비도 3분기와 신호 3줄.
 *
 * **판정(`readiness`)은 서버 값을 그대로 쓴다.** 프론트가 다시 계산하지 않는다 —
 * `reason-type-rules.md`가 백엔드를 단일 소스로 정해 뒀다. 신호 3줄은 서버가 주는
 * `missingItems`·`conflicts`와 확인 카드 수로 **설명만** 만든다.
 */
export function toReadinessResult(
  res: ReadinessResponse,
  unconfirmedCount: number,
  hasHistory: boolean,
): ReadinessResult {
  const { key, label } = READINESS_LABEL[res.readiness]
  const bankUnknown = hasHistory || res.conflicts.length > 0
  return {
    key,
    label,
    criteria: [
      {
        name: "자료 확인",
        ok: unconfirmedCount === 0,
        desc:
          unconfirmedCount > 0
            ? `확인하지 않은 자료 ${unconfirmedCount}건은 문서에 들어가지 않아요`
            : "올린 자료를 모두 확인했어요",
      },
      {
        name: "필수 증빙",
        ok: res.missingItems.length === 0,
        // `missingItems`는 서버가 고른 문구다. 첫 항목만 보여주고 다듬지 않는다.
        desc: res.missingItems.length > 0 ? `${res.missingItems[0]} 확인이 필요해요` : "반드시 필요한 자료를 갖췄어요",
      },
      {
        name: "은행 확인 사항",
        ok: !bankUnknown,
        // 자료 간 충돌 문구도 서버가 만든 것을 그대로 쓴다.
        desc: res.conflicts.length > 0
          ? res.conflicts[0]
          : hasHistory
            ? "과거 지급정지 이력이 있어 은행이 직접 확인해야 해요"
            : "과거 이력이 없고 자료 간 충돌도 없어요",
      },
    ],
  }
}

/**
 * 소명서 문장 (F7-05).
 *
 * 배지 규칙은 계약이 정한다 — `intake`·`user_text` 근거는 **"본인 진술"**, 이미지 근거는
 * 어느 원본에서 나왔는지 적는다. `imageIndex`가 없는 것이 정상인 유형이 있으므로
 * (`intake`·`user_text`) **없다고 오류로 다루지 않는다.**
 */
export function toDraftLines(res: DraftResponse): DraftLine[] {
  return res.sentences.map((sentence) => {
    const imageRef = sentence.evidenceRefs.find((ref) => ref.type === "evidence" && ref.imageIndex !== undefined)
    return {
      id: sentence.sentenceId,
      text: sentence.text,
      badge: imageRef ? `근거 · 원본 ${(imageRef.imageIndex ?? 0) + 1}번` : "본인 진술",
      // 목 뷰어(ViewerSheet)로 보내지 않는다. 실제 원본은 `imageIndex`로 연다.
      ref: null,
      imageIndex: imageRef?.imageIndex ?? null,
    }
  })
}
