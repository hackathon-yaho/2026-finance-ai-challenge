import { BottomCta } from "./components/BottomCta"
import { DateSheet } from "./components/DateSheet"
import { ImageLightbox } from "./components/ImageLightbox"
import { LegalFormSheet } from "./components/LegalFormSheet"
import { PreviewSheet } from "./components/PreviewSheet"
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
import { buildPackagePdf, downloadBlob, fileNameFor } from "./lib/pdf"
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

  // 업로드 서브스텝(자료를 올리는 중)에서는 하단 CTA가 "이 자료로 계속하기"를 맡는다.
  // 종전에는 패널 안에 실제 동작 버튼이 있고 하단 CTA는 "준비도 보기"가 비활성으로 떠 있어,
  // 화면에서 가장 눈에 띄는 버튼이 눌리지 않는 상태였다.
  const uploading = stage === 2 && !flow.filesReady && !flow.textEntryOpen

  const ctaDisabled =
    (stage === 1 && !flow.intakePageAnswered) ||
    (stage === 2 && !uploading && (!flow.analyzed || cardsBlock)) ||
    (stage === 4 && !flow.draftShown)

  const ctaLabel = uploading
    ? flow.uploadedFiles.length > 0
      ? "이 자료로 계속하기"
      : "자료 없이 계속하기"
    : CTA_LABEL[stage]

  // 단계 인디케이터로 건너뛰는 경로도 같은 조건으로 막는다 (F1-04).
  const handleStepClick = (n: number) => {
    if (n >= 3 && stage < 3 && cardsBlock) {
      flow.showToast(`판독 신뢰도가 낮은 자료 ${flow.blockingCount}건을 먼저 확인해주세요`)
      return
    }
    flow.go(n)
  }

  const handleCta = () => {
    if (uploading) {
      flow.proceedFromUpload()
      return
    }
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
                textEntryOpen={flow.textEntryOpen}
                textEntryFromFailure={flow.textEntryFromFailure}
                onOpenTextEntry={() => flow.openTextEntry(false)}
                onCloseTextEntry={flow.closeTextEntry}
                onSubmitTextEntry={flow.submitTextEntry}
                uploadedFiles={flow.uploadedFiles}
                maxUploads={flow.maxUploads}
                uploadsLeft={flow.uploadsLeft}
                onSelectFiles={flow.addFiles}
                onRemoveUpload={flow.removeUploadedFile}
                onPreviewUpload={flow.openLightbox}
                onEditUpload={flow.startEditFile}
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
                confirmedAt={flow.packageConfirmedAt}
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

      {/* 텍스트 입력 화면(S02-1)은 자체 버튼("이 내용으로 정리하기")을 갖는다.
          하단 CTA까지 두면 같은 자리에 다른 일을 하는 버튼이 둘이 된다. */}
      {!flow.textEntryOpen && <BottomCta label={ctaLabel} disabled={ctaDisabled} width={width} onClick={handleCta} />}

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
          onSubmit={flow.submitLegalForm}
          onClose={flow.closeLegalForm}
        />
      )}

      {flow.previewOpen && (
        <PreviewSheet
          width={width}
          form={flow.legalForm}
          draftLines={flow.draftLines}
          timeline={flow.timeline}
          checklist={flow.checklist}
          uploadedFiles={flow.uploadedFiles}
          excluded={flow.excludedSentences}
          onToggleExcluded={flow.toggleExcludedSentence}
          // 미리보기와 다운로드가 **같은 함수**를 쓴다. 따로 만들면 보여준 것과 받는 것이 갈린다.
          buildPdf={() => buildPackagePdf(null, flow.uploadedFiles)}
          textPagesPending
          onBackToEvidence={() => {
            flow.closePreview()
            flow.go(2)
          }}
          onDownload={async () => {
            try {
              // 서버 PDF(텍스트 5종)는 `/api/package/text`가 열리면 앞에 붙는다.
              // 그때까지는 프론트 몫인 원본 이미지 페이지만으로 만든다.
              const pdf = await buildPackagePdf(null, flow.uploadedFiles)
              // TODO(백엔드 연동): `/api/package/text` 응답을 첫 인자로 넘기면 텍스트 5종이 앞에 붙는다.
              downloadBlob(pdf, fileNameFor())
              flow.confirmPackage()
              flow.showToast("출력해서 서명란에 자필 서명한 뒤 제출해주세요")
            } catch {
              // 병합 실패 시 폴백 — 원본을 개별로 저장하도록 안내한다 (PRD 리스크 레지스터).
              flow.showToast("파일을 만들지 못했어요. 자료를 하나씩 저장해주세요")
            }
          }}
          onClose={flow.closePreview}
        />
      )}

      <ImageLightbox file={flow.lightboxFile} width={width} onClose={flow.closeLightbox} />

      <Toast message={flow.toast} />
    </div>
  )
}

export default App
