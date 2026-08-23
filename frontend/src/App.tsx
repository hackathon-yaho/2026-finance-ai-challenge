import { BottomCta } from "./components/BottomCta"
import { ImageLightbox } from "./components/ImageLightbox"
import { MaskingSheet } from "./components/MaskingSheet"
import { DraftStage } from "./components/stages/DraftStage"
import { EvidenceStage } from "./components/stages/EvidenceStage"
import { IntakeStage } from "./components/stages/IntakeStage"
import { IntroStage } from "./components/stages/IntroStage"
import { ReadinessStage } from "./components/stages/ReadinessStage"
import { RoutesStage } from "./components/stages/RoutesStage"
import { Toast } from "./components/Toast"
import { TopBar } from "./components/TopBar"
import { ViewerSheet } from "./components/ViewerSheet"
import { useHaebingFlow } from "./hooks/useHaebingFlow"
import { useViewportWidth } from "./hooks/useViewportWidth"

const CTA_LABEL: Record<number, string> = {
  0: "시작하기",
  1: "다음",
  2: "준비도 보기",
  3: "소명서 만들기",
  4: "접수 안내 보기",
  5: "처음으로",
}

function App() {
  const flow = useHaebingFlow()
  const width = useViewportWidth()
  const { stage } = flow
  const wide = width >= 720
  const pad = width >= 640 ? 24 : 20

  const ctaDisabled =
    (stage === 1 && !flow.intakePageAnswered) || (stage === 2 && !flow.analyzed) || (stage === 4 && !flow.draftShown)

  const handleCta = () => {
    if (stage === 5) {
      flow.restart()
      return
    }
    if (stage === 1 && !flow.intakeLastPage) {
      flow.goIntakePage(flow.intakePage + 1)
      return
    }
    flow.go(stage + 1)
  }

  return (
    <div className="flex min-h-dvh flex-col font-sans text-ink antialiased" style={{ letterSpacing: "-0.005em" }}>
      <TopBar stage={stage} width={width} onBack={flow.back} onStepClick={flow.go} />

      <div className="flex-1">
        <div className="mx-auto max-w-[720px]" style={{ padding: `${pad}px ${pad}px 132px` }}>
          {stage === 0 && <IntroStage wide={width >= 640} />}

          {stage === 1 && (
            <IntakeStage
              page={flow.intakePage}
              dir={flow.intakeDir}
              intake={flow.intake}
              deadlineNotice={flow.deadlineNotice}
              deadlineUrgent={flow.deadlineUrgent}
              onPick={flow.pick}
              onGoPage={flow.goIntakePage}
            />
          )}

          {stage === 2 && (
            <EvidenceStage
              evidence={flow.evidence}
              bankConfirmed={flow.bankConfirmed}
              wide={wide}
              analyzing={flow.analyzing}
              analyzed={flow.analyzed}
              timelineRunId={flow.timelineRunId}
              timeline={flow.timeline}
              amount={flow.intake.amount}
              onToggle={flow.toggle}
              onAddThreat={flow.addThreat}
              onConfirmBank={flow.confirmBank}
              onAnalyze={flow.analyze}
              onOpenViewer={flow.openViewer}
              filesReady={flow.filesReady}
              uploadedFiles={flow.uploadedFiles}
              onSelectFiles={flow.addFiles}
              onRemoveUpload={flow.removeUploadedFile}
              onPreviewUpload={flow.openLightbox}
              onEditUpload={flow.startEditFile}
              onProceedFromUpload={flow.proceedFromUpload}
              onBackToUpload={flow.backToUpload}
            />
          )}

          {stage === 3 && (
            <ReadinessStage
              readiness={flow.readiness}
              wide={wide}
              hasHistory={flow.hasHistory}
              onToggleHistory={flow.toggleHistory}
            />
          )}

          {stage === 4 && (
            <DraftStage
              drafting={flow.drafting}
              draftShown={flow.draftShown}
              draftLines={flow.draftLines}
              checklist={flow.checklist}
              confirmedCount={flow.confirmedCount}
              droppedCount={flow.droppedCount}
              onGenerate={flow.makeDraft}
              onOpenViewer={flow.openViewer}
              onExportPackage={() => flow.showToast("패키지를 준비하고 있어요")}
            />
          )}

          {stage === 5 && <RoutesStage showBizNotice={flow.intake.usage === "주 거래 계좌예요"} />}
        </div>
      </div>

      <BottomCta label={CTA_LABEL[stage]} disabled={ctaDisabled} width={width} onClick={handleCta} />

      <ViewerSheet
        viewer={flow.viewer}
        note={flow.viewerNote}
        width={width}
        amountInfo={flow.amountInfo}
        onClose={flow.closeViewer}
      />

      {flow.activeUpload && (
        <MaskingSheet
          key={flow.activeUpload.id}
          fileName={flow.activeUpload.name}
          dataUrl={flow.activeUpload.dataUrl}
          width={width}
          queueLabel={flow.queueLength > 1 ? `총 ${flow.queueLength}장 중 1번째` : null}
          onConfirm={flow.confirmMasking}
          onCancel={flow.cancelActiveUpload}
        />
      )}

      {flow.editingFile && (
        <MaskingSheet
          key={flow.editingFile.id}
          mode="edit"
          fileName={flow.editingFile.name}
          dataUrl={flow.editingFile.dataUrl}
          width={width}
          queueLabel={null}
          onConfirm={flow.confirmEditFile}
          onCancel={flow.cancelEditFile}
        />
      )}

      <ImageLightbox file={flow.lightboxFile} width={width} onClose={flow.closeLightbox} />

      <Toast message={flow.toast} />
    </div>
  )
}

export default App
