import { STEP_LABELS } from "../data"
import { Check } from "./icons"

interface StepperProps {
  stage: number
  width: number
  onStepClick: (stage: number) => void
}

export function Stepper({ stage, width, onStepClick }: StepperProps) {
  const showLabels = width >= 900
  const narrow = width < 720

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
      {STEP_LABELS.map((label, i) => {
        const idx = i + 1
        const done = stage > idx
        const active = stage === idx
        const lit = done || active

        return (
          <div key={label} className="flex flex-none items-center" style={{ gap: narrow ? 3 : 6 }}>
            {i > 0 && (
              <div
                className="h-px"
                style={{
                  width: showLabels ? 10 : narrow ? 5 : 16,
                  background: lit ? "var(--color-brand)" : "var(--color-border)",
                }}
              />
            )}
            {/* NFR-04 터치 타겟 44px — 보이는 원은 20~26px로 두고 **누르는 영역만** 넓힌다.
                단계 이동이 가능한 컨트롤(F1-04)이라 실제로 눌러야 하는 버튼이다.
                음수 마진으로 넓힌 영역이 옆 단계를 밀어내지 않게 한다. */}
            <button
              type="button"
              onClick={() => onStepClick(idx)}
              aria-label={`${idx}단계 ${label}`}
              className="-my-[9px] flex h-11 flex-none cursor-pointer items-center justify-center"
              style={{ width: 44, marginLeft: narrow ? -12 : -9, marginRight: narrow ? -12 : -9 }}
            >
              <span
                className="flex items-center justify-center rounded-full text-xs font-bold tabular-nums transition-all duration-200"
                style={{
                  width: narrow ? 20 : 26,
                  height: narrow ? 20 : 26,
                  fontSize: narrow ? 10 : 12,
                  background: lit ? "var(--color-brand)" : "var(--color-border)",
                  color: lit ? "white" : "var(--color-muted)",
                  boxShadow: active ? `0 0 0 ${narrow ? 3 : 4}px var(--color-brand-subtle)` : "none",
                }}
              >
                {done ? <Check size={narrow ? 13 : 14} /> : idx}
              </span>
            </button>
            {showLabels && (
              <div className={`text-[11px] whitespace-nowrap ${active ? "font-semibold text-ink" : "font-medium text-muted"}`}>
                {label}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
