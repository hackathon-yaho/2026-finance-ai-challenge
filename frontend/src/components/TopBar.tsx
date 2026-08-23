import { STEP_LABELS } from "../data"
import { Stepper } from "./Stepper"

interface TopBarProps {
  stage: number
  width: number
  onBack: () => void
  onStepClick: (stage: number) => void
}

export function TopBar({ stage, width, onBack, onStepClick }: TopBarProps) {
  const pad = width >= 640 ? 24 : 20
  const showStepper = stage > 0
  // TODO: 백엔드 연동 후, 실제 데모 모드(F11-03: LLM 호출 실패·쿼터 초과 시 DEMO_MODE 전환) 플래그를
  // API 응답으로 받아 그 값으로 대체한다. 지금은 데이터 자체가 전부 목업이라 항상 숨김 처리.
  const showDemoBadge = false

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-bg">
      <div className="mx-auto flex h-14 max-w-[720px] items-center gap-2" style={{ padding: `0 ${pad}px` }}>
        {showStepper && (
          <button
            type="button"
            onClick={onBack}
            aria-label="이전 단계로"
            className="-ml-2 flex h-10 w-10 flex-none items-center justify-center rounded-full text-[22px] leading-none text-ink"
          >
            ‹
          </button>
        )}

        <div className="flex min-w-0 flex-none items-baseline gap-2">
          <div className="text-lg font-bold tracking-tight whitespace-nowrap">{stage === 0 ? "해빙" : STEP_LABELS[stage - 1]}</div>
          <div className="text-xs font-medium tabular-nums text-muted">{stage === 0 ? "解氷" : ""}</div>
        </div>

        {showStepper ? (
          <Stepper stage={stage} width={width} onStepClick={onStepClick} />
        ) : (
          <div className="flex-1" />
        )}

        {showDemoBadge && (
          <div className="flex-none rounded-full bg-surface px-2.5 py-[5px] text-[11px] font-semibold whitespace-nowrap text-muted">
            예시 데이터
          </div>
        )}
      </div>
    </div>
  )
}
