import type { ReadinessResult } from "../../types"

interface ReadinessStageProps {
  readiness: ReadinessResult
  wide: boolean
  hasHistory: boolean
  onToggleHistory: () => void
}

const STAMP_COLOR: Record<ReadinessResult["key"], string> = {
  ready: "border-brand text-brand",
  supplement: "border-warning text-warning",
  bankcheck: "border-danger text-danger",
}

const STAMP_WASH: Record<ReadinessResult["key"], string> = {
  ready: "bg-brand-subtle",
  supplement: "bg-warning-subtle",
  bankcheck: "bg-danger-subtle",
}

const STAMP_RING: Record<ReadinessResult["key"], string> = {
  ready: "border-brand",
  supplement: "border-warning",
  bankcheck: "border-danger",
}

const SHORT_LABEL: Record<ReadinessResult["key"], string> = {
  ready: "완료",
  supplement: "보완",
  bankcheck: "확인",
}

export function ReadinessStage({ readiness, wide, hasHistory, onToggleHistory }: ReadinessStageProps) {
  return (
    <div className="stagger flex flex-col gap-6">
      <div>
        <div className="text-[28px] leading-[1.3] font-bold tracking-tight">제출 준비도</div>
        <p className="mt-1.5 text-[15px] leading-normal text-muted">확인된 자료만으로 점검했어요. 승인 여부는 점치지 않아요.</p>
      </div>

      <div className="flex flex-col items-center gap-4 pt-3 pb-1">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className={`animate-ring-out absolute inset-0 rounded-full border-2 opacity-0 ${STAMP_RING[readiness.key]}`} />
          <div
            className={`animate-stamp-in flex h-24 w-24 items-center justify-center rounded-full border-[3px] text-[22px] font-bold tracking-tight ${STAMP_COLOR[readiness.key]} ${STAMP_WASH[readiness.key]}`}
            style={{ transform: "rotate(-6deg)" }}
          >
            {SHORT_LABEL[readiness.key]}
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight">{readiness.label}</div>
          <div className="mt-2 text-[13px] font-semibold text-muted">최종 판단은 은행이 합니다</div>
        </div>
      </div>

      <div className={wide ? "grid grid-cols-3 gap-3" : "flex flex-col gap-2.5"}>
        {readiness.criteria.map((c, i) => (
          <div
            key={c.name}
            className="animate-fade-up flex items-start gap-3 rounded-2xl bg-subtle p-4 opacity-0"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold text-white ${
                c.ok ? "bg-success" : "bg-danger"
              }`}
            >
              {c.ok ? "✓" : "✕"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold tracking-tight">{c.name}</div>
              <div className="mt-0.5 text-[13px] leading-normal text-muted">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">과거 지급정지 이력 있음</div>
          <div className="mt-0.5 text-[13px] leading-normal text-muted">켜 보면 판정이 어떻게 달라지는지 볼 수 있어요</div>
        </div>
        {/* NFR-04 — 스위치 모양은 26px로 두고 누르는 영역만 44px로 넓힌다. */}
        <button
          type="button"
          onClick={onToggleHistory}
          aria-pressed={hasHistory}
          aria-label="과거 지급정지 이력 있음"
          className="-my-[9px] flex h-11 w-11 flex-none items-center justify-center"
        >
          <span
            className={`relative block h-[26px] w-11 rounded-full transition-colors duration-200 ${hasHistory ? "bg-brand" : "bg-neutral"}`}
          >
            <span
              className={`absolute top-[3px] block h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${
                hasHistory ? "left-[21px]" : "left-[3px]"
              }`}
            />
          </span>
        </button>
      </div>

      <p className="rounded-2xl bg-subtle p-4 text-[13px] leading-normal text-muted">
        이의제기신청서와 소명자료를 충분히 구비하여 제출한 경우 금융회사는 5영업일 내 심사결과를 통보해요. 자료 보완이
        필요하면 처리기간이 늘어날 수 있고, 5영업일 내 지급정지 해제를 보장하는 것은 아니에요.
      </p>
    </div>
  )
}
