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
      {/* NFR·규제 대응 — `spec.md` 화면 정의서가 **공통 요소(전 화면)**로,
          `privacy-and-safety.md`가 "프론트엔드 필수 구현"으로 지정한 문구다.
          준비도 결과를 승인 예측으로 오해하는 것을 막는 장치라 한 화면만 빠져도 의미가 없다. */}
      <div className="border-b border-border bg-subtle">
        <p
          className="mx-auto max-w-[720px] py-1.5 text-[11px] leading-normal text-muted"
          style={{ padding: `6px ${pad}px` }}
        >
          이 화면은 제출 자료를 정리하는 도구예요. 지급정지 해제 여부는 은행 심사로 결정돼요.
        </p>
      </div>

      <div className="mx-auto flex h-14 max-w-[720px] items-center gap-2" style={{ padding: `0 ${pad}px` }}>
        {showStepper && (
          <button
            type="button"
            onClick={onBack}
            aria-label="이전 단계로"
            className="-ml-2.5 flex h-11 w-11 flex-none items-center justify-center rounded-full text-[22px] leading-none text-ink"
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
