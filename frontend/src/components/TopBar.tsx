interface TopBarProps {
  stage: number
  stageName: string
  onBack: () => void
}

export function TopBar({ stage, stageName, onBack }: TopBarProps) {
  return (
    <div className="flex-none">
      <div className="grid h-14 grid-cols-[40px_1fr_40px] items-center gap-2 border-b border-border px-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="이전 단계로"
          className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-ink"
        >
          ‹
        </button>
        <div className="truncate text-center text-lg font-semibold tracking-tight text-ink">
          {stageName} <span className="text-xs font-medium tabular-nums text-muted">({stage}/5)</span>
        </div>
        <div />
      </div>
      <div className="relative h-[3px] overflow-hidden bg-border">
        <div
          className="absolute inset-y-0 left-0 bg-brand transition-[width] duration-300 ease-out"
          style={{ width: `${(stage / 5) * 100}%` }}
        />
      </div>
    </div>
  )
}
