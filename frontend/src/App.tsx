import { useEffect } from "react"
import { BottomCta } from "./components/BottomCta"
import { DraftStage } from "./components/stages/DraftStage"
import { EvidenceStage } from "./components/stages/EvidenceStage"
import { IntakeStage } from "./components/stages/IntakeStage"
import { IntroStage } from "./components/stages/IntroStage"
import { RoutesStage } from "./components/stages/RoutesStage"
import { VerdictStage } from "./components/stages/VerdictStage"
import { TopBar } from "./components/TopBar"
import { Toast } from "./components/Toast"
import { STAGE_NAMES } from "./data"
import { useHaebingFlow } from "./hooks/useHaebingFlow"

const CTA_LABEL: Record<number, string> = {
  1: "다음",
  2: "판정 보기",
  3: "소명서 만들기",
  4: "접수 안내 보기",
  5: "처음으로",
}

function App() {
  const flow = useHaebingFlow()
  const { stage } = flow

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [stage])

  const ctaDisabled =
    (stage === 1 && !flow.allAnswered) || (stage === 2 && !flow.analyzed) || (stage === 4 && !flow.draftRevealed)

  const handleCta = () => {
    if (stage === 5) {
      flow.restart()
      return
    }
    flow.goStage(stage + 1)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-3.5 py-7 font-sans text-ink antialiased">
      <div className="relative flex w-full max-w-[480px] flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        {stage > 0 && <TopBar stage={stage} stageName={STAGE_NAMES[stage]} onBack={() => flow.goStage(stage - 1)} />}

        <div className={`no-scrollbar flex-1 overflow-y-auto ${stage === 0 ? "px-5" : "px-5 pt-[22px] pb-6"}`}>
          {stage === 0 && <IntroStage onStart={() => flow.goStage(1)} />}

          {stage === 1 && <IntakeStage intake={flow.intake} onSelect={flow.selectIntake} />}

          {stage === 2 && (
            <EvidenceStage
              evidence={flow.evidence}
              onToggle={flow.toggleEvidence}
              onAddThreat={flow.addThreat}
              analyzing={flow.analyzing}
              analyzed={flow.analyzed}
              onAnalyze={flow.analyze}
              timeline={flow.timeline}
            />
          )}

          {stage === 3 && (
            <VerdictStage
              verdict={flow.verdict}
              historyOverride={flow.historyOverride}
              intakeHistory={flow.intake.history}
              onToggleHistoryDemo={flow.toggleHistoryDemo}
            />
          )}

          {stage === 4 && (
            <DraftStage
              draftGenerating={flow.draftGenerating}
              draftRevealed={flow.draftRevealed}
              draftParagraphs={flow.draftParagraphs}
              checklist={flow.checklist}
              onGenerate={flow.generateDraft}
              onExportPdf={() => flow.showToast("PDF 준비 중이에요")}
            />
          )}

          {stage === 5 && <RoutesStage threatAdded={flow.evidence.threat} />}
        </div>

        {stage > 0 && <BottomCta label={CTA_LABEL[stage]} disabled={ctaDisabled} onClick={handleCta} />}

        <Toast message={flow.toast} />
      </div>
    </div>
  )
}

export default App
