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
      {/*
       * 규제 대응 문구 — 준비도 결과를 승인 예측으로 오해하는 것을 막는 장치다
       * (PRD §11 오안내 책임, `privacy-and-safety.md` "상시 노출 배지").
       *
       * **진입 화면에서만 띄운다.** 모든 화면에 고정하면 6단계 내내 같은 문장이 따라붙어
       * 오히려 읽히지 않는다. 대신 **판정이 나오는 화면은 각자 자기 문구를 갖는다** —
       * 준비도는 "최종 판단은 은행이 합니다", 소명서는 "최종 판단은 금융회사",
       * 접수 화면은 같은 문장을 본문 끝에 둔다. 오해가 생길 수 있는 자리는 다 덮인다.
       *
       * `spec.md` 화면 정의서는 이 배지를 "공통 요소(전 화면)"로 적고 있어 표기가 다르다.
       * 백엔드에 정정을 요청해 뒀다 — `docs/request/backend/persistent-badge-placement.md`.
       */}
      {stage === 0 && (
        <div className="border-b border-border bg-subtle">
          <p className="mx-auto max-w-[720px] text-[11px] leading-normal text-muted" style={{ padding: `6px ${pad}px` }}>
            이 화면은 제출 자료를 정리하는 도구예요. 지급정지 해제 여부는 은행 심사로 결정돼요.
          </p>
        </div>
      )}

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
