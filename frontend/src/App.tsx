import { BottomCta } from "./components/BottomCta"
import { DateSheet } from "./components/DateSheet"
import { ImageLightbox } from "./components/ImageLightbox"
import { LegalFormSheet } from "./components/LegalFormSheet"
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

// 0 = 방향 없음. 클래스를 붙이지 않으면 .stagger 기본값(세로 상승)이 쓰인다.
const NAV_CLASS: Record<number, string> = {
  0: "",
  1: "nav-next",
  [-1]: "nav-prev",
}

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

  // F4-06 게이팅 — 날짜·금액이 low 신뢰도인 미확인 카드가 남아 있으면 Stage 3으로 넘기지 않는다.
  // 확인되지 않은 값으로 준비도가 산출되면 틀린 서류가 은행에 간다.
  // 백엔드도 같은 조건을 서버에서 검사해 `/api/readiness`를 409로 거부한다 — 이건 UX 쪽 방어선이다.
  const cardsBlock = flow.blockingCount > 0

  const ctaDisabled =
    (stage === 1 && !flow.intakePageAnswered) ||
    (stage === 2 && (!flow.analyzed || cardsBlock)) ||
    (stage === 4 && !flow.draftShown)

  // 단계 인디케이터로 건너뛰는 경로도 같은 조건으로 막는다 (F1-04).
  const handleStepClick = (n: number) => {
    if (n >= 3 && stage < 3 && cardsBlock) {
      flow.showToast(`판독 신뢰도가 낮은 자료 ${flow.blockingCount}건을 먼저 확인해주세요`)
      return
    }
    flow.go(n)
  }

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
      <TopBar stage={stage} width={width} onBack={flow.back} onStepClick={handleStepClick} />

      <div className="flex-1">
        <div className="mx-auto max-w-[720px]" style={{ padding: `${pad}px ${pad}px 132px` }}>
          {/* 진행 방향을 자손 .stagger에 공급한다. key로 단계마다 다시 재생시킨다. */}
          <div key={stage} className={NAV_CLASS[flow.navDir]}>
            {stage === 0 && <IntroStage wide={width >= 640} />}

            {stage === 1 && (
              <IntakeStage
                page={flow.intakePage}
                intake={flow.intake}
                deadline={flow.deadline}
                onPick={flow.pick}
                onOpenDate={flow.openDateSheet}
                onToggleWhenUnknown={flow.toggleWhenUnknown}
                onSetNoticeStatus={flow.setNoticeStatus}
                onSetAmount={flow.setAmount}
                onToggleAmountUnknown={flow.toggleAmountUnknown}
                onGoPage={flow.goIntakePage}
              />
            )}

            {stage === 2 && (
              <EvidenceStage
                kind={flow.intake.kind}
                evidence={flow.evidence}
                cards={flow.cards}
                blockingCount={flow.blockingCount}
                unconfirmedCount={flow.unconfirmedCount}
                wide={wide}
                analyzing={flow.analyzing}
                analyzed={flow.analyzed}
                timelineRunId={flow.timelineRunId}
                timeline={flow.timeline}
                onToggle={flow.toggle}
                onAddThreat={flow.addThreat}
                onConfirmCard={flow.confirmCard}
                onEditCard={flow.editCard}
                onRemoveCard={flow.removeCard}
                onAnalyze={flow.analyze}
                onOpenViewer={flow.openViewer}
                filesReady={flow.filesReady}
                uploadedFiles={flow.uploadedFiles}
                maxUploads={flow.maxUploads}
                uploadsLeft={flow.uploadsLeft}
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
                selfHeld={flow.selfHeld}
                onToggleSelfHeld={flow.toggleSelfHeld}
                confirmedCount={flow.confirmedCount}
                droppedCount={flow.droppedCount}
                onGenerate={flow.makeDraft}
                onOpenViewer={flow.openViewer}
                onExportPackage={flow.openLegalForm}
              />
            )}

              {stage === 5 && <RoutesStage showBizNotice={flow.intake.usage === "주 거래 계좌예요"} />}
          </div>
        </div>
      </div>

      <BottomCta label={CTA_LABEL[stage]} disabled={ctaDisabled} width={width} onClick={handleCta} />

      {flow.dateSheet && (
        <DateSheet
          key={flow.dateSheet}
          title={flow.dateSheet === "when" ? "계좌가 정지된 날" : "채권소멸절차 개시 공고일"}
          hint={
            flow.dateSheet === "when"
              ? "지급정지 통지서에 적힌 날짜를 골라주세요."
              : "이 날짜로부터 2개월이 이의제기 기한이에요."
          }
          value={flow.dateSheet === "when" ? flow.intake.when : flow.intake.noticeDate}
          width={width}
          onSelect={flow.commitDate}
          onClose={flow.closeDateSheet}
        />
      )}

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
          url={flow.activeUpload.url}
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
          url={flow.editingFile.url}
          width={width}
          queueLabel={null}
          onConfirm={flow.confirmEditFile}
          onCancel={flow.cancelEditFile}
        />
      )}

      {flow.legalFormOpen && (
        <LegalFormSheet
          width={width}
          initial={flow.legalForm}
          onSubmit={(values) => {
            flow.submitLegalForm(values)
            // 미리보기(S04-2)는 8/29~8/31 작업이다. 그때까지 다음 단계 안내만 띄운다.
            flow.showToast("출력해서 서명란에 자필 서명한 뒤 제출해주세요")
          }}
          onClose={flow.closeLegalForm}
        />
      )}

      <ImageLightbox file={flow.lightboxFile} width={width} onClose={flow.closeLightbox} />

      <Toast message={flow.toast} />
    </div>
  )
}

export default App
