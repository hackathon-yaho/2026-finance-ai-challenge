import type { VerdictResult } from "../../types"

interface VerdictStageProps {
  verdict: VerdictResult
  historyOverride: boolean | null
  intakeHistory: string | null
  onToggleHistoryDemo: () => void
}

const VERDICT_COLOR: Record<VerdictResult["colorKey"], { text: string; border: string }> = {
  blue: { text: "text-brand", border: "border-brand" },
  orange: { text: "text-warning", border: "border-warning" },
  red: { text: "text-danger", border: "border-danger" },
}

const VERDICT_SHORT_LABEL: Record<VerdictResult["verdict"], string> = {
  approve: "가능",
  more: "보완",
  reject: "기각",
}

export function VerdictStage({ verdict, historyOverride, intakeHistory, onToggleHistoryDemo }: VerdictStageProps) {
  const historyOn = historyOverride === true || (historyOverride === null && intakeHistory === "있어요")
  const colors = VERDICT_COLOR[verdict.colorKey]

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex items-center justify-between rounded-2xl bg-surface p-3.5">
        <div>
          <div className="text-[13px] font-semibold text-ink">데모: 과거 지급정지 이력</div>
          <div className="mt-0.5 text-xs text-muted">조건을 바꿔 판정이 어떻게 뒤집히는지 볼 수 있어요</div>
        </div>
        <button
          type="button"
          onClick={onToggleHistoryDemo}
          aria-pressed={historyOn}
          aria-label="과거 지급정지 이력 데모 전환"
          className={`relative h-[26px] w-11 flex-none rounded-full transition-colors ${historyOn ? "bg-brand" : "bg-neutral"}`}
        >
          <div
            className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-[left] ${
              historyOn ? "left-[21px]" : "left-[3px]"
            }`}
          />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {verdict.criteria.map((criterion, index) => (
          <div
            key={criterion.name}
            className="animate-fade-up flex items-start gap-3 rounded-2xl bg-bg p-3.5 opacity-0"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold text-white ${
                criterion.ok ? "bg-success" : "bg-danger"
              }`}
            >
              {criterion.ok ? "✓" : "✕"}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink">{criterion.name}</div>
              <div className="mt-0.5 text-xs text-muted">{criterion.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 px-2 pt-7 pb-2">
        <div
          className={`animate-stamp-in flex h-24 w-24 items-center justify-center rounded-full border-4 text-[22px] font-bold ${colors.border} ${colors.text}`}
          style={{ transform: "rotate(-7deg)" }}
        >
          {VERDICT_SHORT_LABEL[verdict.verdict]}
        </div>
        <div className="text-center text-base font-bold text-ink">{verdict.label}</div>
        <div className="text-center text-[13px] text-muted">{verdict.days}</div>
        <p className="max-w-[280px] text-center text-xs leading-relaxed text-muted">{verdict.note}</p>
      </div>
    </div>
  )
}
