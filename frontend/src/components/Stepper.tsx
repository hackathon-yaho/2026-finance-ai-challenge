import { STEP_LABELS } from "../data"

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
            <button
              type="button"
              onClick={() => onStepClick(idx)}
              className="flex flex-none cursor-pointer items-center justify-center rounded-full text-xs font-bold tabular-nums transition-all duration-200"
              style={{
                width: narrow ? 20 : 26,
                height: narrow ? 20 : 26,
                fontSize: narrow ? 10 : 12,
                background: lit ? "var(--color-brand)" : "var(--color-border)",
                color: lit ? "white" : "var(--color-muted)",
                boxShadow: active ? `0 0 0 ${narrow ? 3 : 4}px var(--color-brand-subtle)` : "none",
              }}
            >
              {done ? "✓" : idx}
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
