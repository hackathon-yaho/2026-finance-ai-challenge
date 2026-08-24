import { formatDotWeekday } from "../../lib/date"

interface DateFieldProps {
  value: string | null
  placeholder: string
  /** "모름" 버튼. 넘기지 않으면 버튼을 그리지 않는다 (공고일처럼 모름이 별도 선택지인 경우). */
  unknown?: boolean
  onOpen: () => void
  onToggleUnknown?: () => void
}

export function DateField({ value, placeholder, unknown = false, onOpen, onToggleUnknown }: DateFieldProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onOpen}
        disabled={unknown}
        className={`h-11 min-w-0 flex-1 rounded-2xl border px-[18px] text-left text-[15px] tracking-tight transition-all duration-[120ms] disabled:opacity-40 ${
          value && !unknown ? "border-brand bg-bg font-semibold text-ink" : "border-border bg-bg text-muted"
        }`}
      >
        {value && !unknown ? <span className="tabular-nums">{formatDotWeekday(value)}</span> : placeholder}
      </button>
      {onToggleUnknown && (
        <button
          type="button"
          onClick={onToggleUnknown}
          className={`h-11 flex-none rounded-2xl border px-5 text-[15px] font-semibold tracking-tight transition-all duration-[120ms] ${
            unknown ? "border-brand bg-brand text-white" : "border-border bg-bg text-muted"
          }`}
        >
          모름
        </button>
      )}
    </div>
  )
}
