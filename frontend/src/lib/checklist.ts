import { EVIDENCE_CATALOG, REASON_BY_KIND } from "../data"
import type {
  ChecklistEntry,
  ChecklistItem,
  ChecklistStatus,
  EvidenceId,
  EvidenceState,
  ReasonType,
} from "../types"

/**
 * 체크리스트 판정 (spec.md F6-03 · F7-03).
 *
 * **API를 붙이면 이 판정은 백엔드 `ReadinessService`가 하고, 프론트는 `/api/readiness`가
 * 내려준 `checklist` 배열을 그리기만 한다.** 결과 타입(`ChecklistItem`)이 곧 응답 원소의
 * 모양이므로, 여기서 만드는 값과 서버가 주는 값은 같은 형태다. 그때까지는 이 파일이
 * 같은 규칙을 대신 계산한다.
 *
 * 규칙을 바꿔야 하면 `docs/01-product/reason-type-rules.md` §2를 먼저 고친다.
 */

export function reasonOf(kind: string | null): ReasonType {
  return (kind && REASON_BY_KIND[kind]) || "unclear"
}

/** 업로드 자료가 실제로 쓸 수 있는 상태인지. 입금 내역은 사용자가 확인한 뒤라야 근거가 된다 (F6-03). */
function hasSource(id: EvidenceId, evidence: EvidenceState, bankConfirmed: boolean): boolean {
  return evidence[id] && (id !== "bank" || bankConfirmed)
}

function uploadStatus(
  sources: EvidenceId[] | undefined,
  evidence: EvidenceState,
  bankConfirmed: boolean,
): ChecklistStatus {
  return sources?.some((id) => hasSource(id, evidence, bankConfirmed)) ? "met" : "unmet"
}

/**
 * 구매자–송금인 대조 (reason-type-rules.md §2-1).
 *
 * **불일치는 `unmet`이 아니다.** 닉네임과 실명이 다른 것은 정상이고, 삼각사기 피해자는
 * 원래 불일치한다 — 미보유로 잡으면 서비스가 피해자를 의심하는 도구가 된다.
 * 한쪽 이름이 `null`이면 "확인 불가"(`unknown`)이지 불일치가 아니다 (TC-26).
 *
 * 목 구현이라 실제 이름 비교는 하지 않는다. 실제 값은 백엔드가 카드의
 * `counterparty_name` / `payer_name`을 대조해 채운다.
 */
function derivedStatus(evidence: EvidenceState, bankConfirmed: boolean): ChecklistStatus {
  const bothSides = hasSource("chat", evidence, bankConfirmed) && hasSource("bank", evidence, bankConfirmed)
  return bothSides ? "met" : "unknown"
}

function judge(
  entry: ChecklistEntry,
  evidence: EvidenceState,
  bankConfirmed: boolean,
  selfHeld: ReadonlySet<string>,
): ChecklistItem {
  const { anyOf, ...rest } = entry

  if (entry.fulfillBy === "derived") {
    return { ...rest, status: derivedStatus(evidence, bankConfirmed) }
  }

  const statusOf = (id: string, sources: EvidenceId[] | undefined): ChecklistStatus =>
    entry.fulfillBy === "self"
      ? selfHeld.has(id)
        ? "met"
        : "unmet"
      : uploadStatus(sources, evidence, bankConfirmed)

  if (anyOf) {
    // 택일 — 하나만 충족되면 그룹 전체가 met이다. 전부 요구하면 금감원이 완화한
    // 기준을 되돌리는 것이 된다 (reason-type-rules.md §2-1, TC-23).
    const options = anyOf.map((option) => ({ ...option, status: statusOf(option.id, option.sources) }))
    return { ...rest, status: options.some((o) => o.status === "met") ? "met" : "unmet", options }
  }

  return { ...rest, status: statusOf(entry.id, entry.sources) }
}

export function buildChecklist(
  kind: string | null,
  evidence: EvidenceState,
  bankConfirmed: boolean,
  selfHeld: ReadonlySet<string>,
): ChecklistItem[] {
  return EVIDENCE_CATALOG[reasonOf(kind)].map((entry) => judge(entry, evidence, bankConfirmed, selfHeld))
}

/**
 * 준비도의 `필수증빙누락` 신호 (reason-type-rules.md §3).
 *
 * **`whenMissing: "blocks"`인 항목만 본다.** 금감원 표준(②) 미충족만으로는 신호가 서지
 * 않는다 — ②는 "이 정도만 받아 수용 여부를 결정한다"는 **부담 경감** 기준이지
 * "없으면 안 된다"는 요건이 아니다 (reason-type-rules.md §2, TC-21).
 */
export function blockingItems(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => item.whenMissing === "blocks" && item.status !== "met")
}
