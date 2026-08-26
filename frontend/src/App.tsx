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
import { downloadBlob, fileNameFor } from "./lib/pdf"
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

  // 조립 전 서브스텝도 같은 이유로 하단 CTA가 맡는다. 종전에는 실제 다음 행동이 목록 안의
  // "자료 조립하기"인데 하단에는 "준비도 보기"가 비활성으로 떠 있어, 화면에서 가장 큰
  // 버튼이 눌리지 않는 채로 이유도 말해주지 않았다 — 업로드 서브스텝에서 고친 것과 같은 문제다.
  const assembling = stage === 2 && !uploading && !flow.textEntryOpen && !flow.analyzed

  const ctaDisabled =
    (stage === 1 && !flow.intakePageAnswered) ||
    // 판독이 끝나기 전에 조립을 부르면 아직 없는 카드로 타임라인을 만든다.
    (stage === 2 && flow.extracting) ||
    (stage === 2 && assembling && flow.analyzing) ||
    (stage === 2 && !uploading && !assembling && cardsBlock) ||
    (stage === 4 && !flow.draftShown)

  const ctaLabel = uploading
    ? flow.uploadedFiles.length > 0
      ? "이 자료로 계속하기"
      : "자료 없이 계속하기"
    : assembling
      ? "자료 조립하기"
      : CTA_LABEL[stage]

  // 단계 인디케이터로 건너뛰는 경로도 같은 조건으로 막는다 (F1-04).
  const handleStepClick = (n: number) => {
    if (n >= 3 && stage < 3 && cardsBlock) {
      flow.showToast(`먼저 확인해야 하는 자료 ${flow.blockingCount}건이 있어요`)
      return
    }
    flow.go(n)
  }

  const handleCta = () => {
    if (uploading) {
      flow.proceedFromUpload()
      return
    }
    if (assembling) {
      flow.analyze()
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

      {/**
       * 협박 대응 배너 (F10-02 · F10-03 · FR-024).
       *
       * `signals.threat_detected`가 켜지면 **화면 상단에 고정**한다 — 계약이 "사용자가 다음
       * 단계로 넘어가길 기다리지 않는다"고 못 박은 자리다. 협박을 받는 사용자는 5단계까지
       * 가지 않을 수 있고(PRD P-03), **가장 먼저 지우는 것이 가장 중요한 자료**라는 역설이
       * 이 배너의 존재 이유다.
       *
       * 문구는 F10-03의 세 가지를 그대로 쓴다. 줄이거나 순화하지 않는다.
       */}
      {flow.threatDetected && (
        <div className="sticky top-0 z-20 border-b border-danger/30 bg-danger-subtle" style={{ padding: `10px ${pad}px` }}>
          <div className="mx-auto flex max-w-[720px] items-start gap-3">
            <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-danger text-[13px] font-bold text-white">
              !
            </div>
            <p className="text-[13px] leading-normal">
              <b>협박 연락을 받고 있다면</b>
              <br />
              돈을 보내지 마세요 · 메시지를 지우지 마세요 · 답장하지 마세요
            </p>
          </div>
        </div>
      )}

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
                extracting={flow.extracting}
                timelineRunId={flow.timelineRunId}
                timeline={flow.timeline}
                onToggle={flow.toggle}
                onAddThreat={flow.addThreat}
                onConfirmCard={flow.confirmCard}
                findSource={flow.findSource}
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
                // F7-05 — 문장의 근거가 된 **실제 원본 이미지**를 연다. 목 뷰어가 아니다.
                findSource={flow.findSource}
                onOpenSource={flow.openLightbox}
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
          // 채권소멸절차 개시 공고는 지급정지 이후에 나온다. 정지일을 이미 답했으면 그 앞
          // 날짜를 고를 수 없게 막는다 — 앞선 날짜를 넣으면 기한이 실제보다 이르게 계산된다.
          min={flow.dateSheet === "notice" ? (flow.intake.when ?? undefined) : undefined}
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
          // 제출본 3면은 **확인된 카드만** 싣는다 — 화면 타임라인(flow.timeline)과 다르다.
          timeline={flow.submitTimeline}
          checklist={flow.checklist}
          cards={flow.cards}
          excluded={flow.excludedSentences}
          onToggleExcluded={flow.toggleExcludedSentence}
          onRevise={flow.reviseSentence}
          // 인쇄물에 붙는 5면 원본 (F8-02). 화면 미리보기에는 나오지 않는다.
          files={flow.uploadedFiles}
          reviseWarning={flow.reviseWarning}
          // 미리보기와 다운로드가 **같은 함수**를 쓴다. 따로 만들면 보여준 것과 받는 것이 갈린다.
          buildPdf={flow.buildPackage}
          // 서버가 붙으면 텍스트 5면이 실제로 들어온다 — 그때는 "아직 없다"고 말하지 않는다.
          textPagesPending={!flow.live}
          onBackToEvidence={() => {
            flow.closePreview()
            flow.go(2)
          }}
          onDownload={async () => {
            try {
              const pdf = await flow.buildPackage()
              downloadBlob(pdf, fileNameFor())
              flow.confirmPackage()
              flow.showToast("출력해서 서명란에 자필 서명한 뒤 제출해주세요")
            } catch {
              // 병합 실패 시 폴백 — **인쇄로 보낸다** (F8-02). 종전에는 "자료를 하나씩
              // 저장해주세요"였는데, 그러면 사용자가 신청서·진술서를 스스로 만들어야 한다.
              // 인쇄는 같은 서류를 그대로 종이로 내보내는 길이라 대체가 된다.
              flow.showToast("파일을 만들지 못했어요. 아래 [인쇄하기]로 종이에 뽑아 내실 수 있어요")
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
