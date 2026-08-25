import { useEffect, useRef } from "react"
import { ConfirmCard } from "../ConfirmCard"
import { TextEntryPanel } from "../TextEntryPanel"
import { UploadPanel } from "../UploadPanel"
import type { CardEdits, EvidenceId, EvidenceState, ExtractedCard, TimelineEvent, UploadedFile, ViewerId } from "../../types"

const STICKY_HEADER_OFFSET = 72 // 56px top bar + a little breathing room

interface EvidenceStageProps {
  /** 문진의 거래 성격 — 사유별 업로드 안내(F3-07)로 내려보낸다. */
  kind: string | null
  evidence: EvidenceState
  cards: ExtractedCard[]
  blockingCount: number
  unconfirmedCount: number
  wide: boolean
  analyzing: boolean
  analyzed: boolean
  timelineRunId: number
  timeline: TimelineEvent[]
  onToggle: (id: EvidenceId) => void
  onAddThreat: () => void
  onConfirmCard: (eventId: string) => void
  onEditCard: (eventId: string, patch: CardEdits) => void
  onRemoveCard: (eventId: string) => void
  onAnalyze: () => void
  onOpenViewer: (id: ViewerId) => void
  filesReady: boolean
  textEntryOpen: boolean
  textEntryFromFailure: boolean
  onOpenTextEntry: () => void
  onCloseTextEntry: () => void
  onSubmitTextEntry: (text: string) => void
  uploadedFiles: UploadedFile[]
  maxUploads: number
  uploadsLeft: number
  onSelectFiles: (files: FileList) => void
  onRemoveUpload: (id: string) => void
  onPreviewUpload: (id: string) => void
  onEditUpload: (id: string) => void
  onBackToUpload: () => void
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-[5px] w-[5px] animate-dot-pulse rounded-full bg-white" />
      <span className="h-[5px] w-[5px] animate-dot-pulse rounded-full bg-white [animation-delay:150ms]" />
      <span className="h-[5px] w-[5px] animate-dot-pulse rounded-full bg-white [animation-delay:300ms]" />
    </span>
  )
}

export function EvidenceStage({
  kind,
  evidence,
  cards,
  blockingCount,
  unconfirmedCount,
  wide,
  analyzing,
  analyzed,
  timelineRunId,
  timeline,
  onToggle,
  onAddThreat,
  onConfirmCard,
  onEditCard,
  onRemoveCard,
  onAnalyze,
  onOpenViewer,
  filesReady,
  textEntryOpen,
  textEntryFromFailure,
  onOpenTextEntry,
  onCloseTextEntry,
  onSubmitTextEntry,
  uploadedFiles,
  maxUploads,
  uploadsLeft,
  onSelectFiles,
  onRemoveUpload,
  onPreviewUpload,
  onEditUpload,
  onBackToUpload,
}: EvidenceStageProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const wasAnalyzing = useRef(false)

  // Scroll the newly (re-)assembled timeline into view — both the first "자료 조립하기"
  // and any later "다시 조립하기" should visibly land on the fresh result, not leave the
  // user wondering whether anything happened below the fold.
  useEffect(() => {
    if (wasAnalyzing.current && !analyzing && timelineRef.current) {
      const top = timelineRef.current.getBoundingClientRect().top + window.scrollY - STICKY_HEADER_OFFSET
      window.scrollTo({ top, behavior: "smooth" })
    }
    wasAnalyzing.current = analyzing
  }, [analyzing])

  // S02-1 — 캡처가 없거나 판독이 통째로 실패한 사용자의 길 (F3-04 · NFR-07)
  if (textEntryOpen) {
    return <TextEntryPanel fromFailure={textEntryFromFailure} onSubmit={onSubmitTextEntry} onBack={onCloseTextEntry} />
  }

  if (!filesReady) {
    return (
      <UploadPanel
        onOpenTextEntry={onOpenTextEntry}
        kind={kind}
        uploadedFiles={uploadedFiles}
        maxUploads={maxUploads}
        uploadsLeft={uploadsLeft}
        onSelectFiles={onSelectFiles}
        onEditFile={onEditUpload}
        onRemoveFile={onRemoveUpload}
        onPreviewFile={onPreviewUpload}
      />
    )
  }

  return (
    <div className="stagger flex flex-col gap-6">
      <div>
        <div className="text-[28px] leading-[1.3] font-bold tracking-tight">올린 자료를 읽었어요</div>
        <p className="mt-1.5 text-[15px] leading-normal text-muted">계좌번호 같은 정보는 보내기 전에 가렸어요. 원본은 눌러서 확인할 수 있어요.</p>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
          <div className="flex -space-x-2">
            {uploadedFiles.slice(0, 4).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onPreviewUpload(f.id)}
                className="h-9 w-9 flex-none overflow-hidden rounded-full border-2 border-bg"
              >
                <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1 text-[13px] text-muted">직접 올린 자료 {uploadedFiles.length}건</div>
          <button type="button" onClick={onBackToUpload} className="flex-none text-[13px] font-semibold text-brand underline">
            자료 더 올리기
          </button>
        </div>
      )}

      {evidence.threat && (
        <div className="animate-drop-in flex items-start gap-3 rounded-2xl bg-danger-subtle p-4">
          <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-danger text-[13px] font-bold text-white">
            !
          </div>
          <p className="text-[13px] leading-normal">
            <b>협박으로 보이는 메시지를 찾았어요.</b> 지우지 말고 답장하지 마세요. 수신한 사실만 소명서에 적고 원본을
            별첨으로 내요.
          </p>
        </div>
      )}

      {blockingCount > 0 && (
        <div className="rounded-2xl bg-warning-subtle px-4 py-3.5 text-[13px] leading-normal text-warning">
          판독 신뢰도가 낮은 자료 {blockingCount}건을 확인해야 다음 단계로 갈 수 있어요.
        </div>
      )}

      {/* F4-06 — 확인 없이 소명서를 만들면 틀린 서류가 은행에 간다. 확인한 카드만 문서에 들어간다. */}
      <div className={wide ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
        {cards.map((card) => (
          <ConfirmCard
            key={card.event_id}
            card={card}
            onConfirm={onConfirmCard}
            onEdit={onEditCard}
            onRemove={onRemoveCard}
            onOpenViewer={onOpenViewer}
          />
        ))}
      </div>

      {unconfirmedCount > 0 && blockingCount === 0 && (
        <p className="text-[13px] leading-normal text-muted">
          확인하지 않은 자료 {unconfirmedCount}건은 문서에 포함되지 않아요. 그대로 진행할 수 있어요.
        </p>
      )}

      {!evidence.threat && (
        <button type="button" onClick={onAddThreat} className="h-10 self-start rounded-xl border border-border bg-bg px-4 text-[15px] font-semibold text-ink">
          협박 문자 캡처 추가하기
        </button>
      )}

      <div className="h-px bg-border" />

      <div ref={timelineRef}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-[17px] font-semibold tracking-tight">시간순 타임라인</div>
          <button type="button" onClick={onAnalyze} className="h-10 flex-none rounded-xl bg-ink px-4 text-[15px] font-semibold text-white">
            {analyzing ? <LoadingDots /> : <span>{analyzed ? "다시 조립하기" : "자료 조립하기"}</span>}
          </button>
        </div>

        {!analyzed && (
          <div className="rounded-2xl border border-dashed border-neutral px-5 py-8 text-center text-[15px] leading-normal text-muted">
            자료를 조립하면 여기에 시간순으로 정리돼요
          </div>
        )}

        {analyzed && (
          <div key={timelineRunId}>
            {timeline.map((ev, i) => (
              <div
                key={`${ev.time}-${i}`}
                className="flex animate-fade-up gap-3 opacity-0"
                style={{ animationDelay: `${i * 0.16}s`, animationDuration: "0.55s" }}
              >
                <div className="flex w-5 flex-none flex-col items-center">
                  <div
                    className={`mt-[5px] h-2.5 w-2.5 flex-none rounded-full ${
                      ev.gap ? "bg-danger" : ev.threat ? "bg-warning" : "bg-brand"
                    }`}
                  />
                  {i < timeline.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2 pb-5">
                  <div className="text-xs tabular-nums text-muted">{ev.time}</div>
                  <div
                    className={
                      ev.gap
                        ? "animate-nudge rounded-xl bg-danger-subtle px-3 py-2 text-[15px] leading-normal font-semibold text-danger"
                        : "text-[15px] leading-normal"
                    }
                  >
                    {ev.text}
                  </div>
                  {ev.action && ev.srcToggle && (
                    <button
                      type="button"
                      onClick={() => onToggle(ev.srcToggle as EvidenceId)}
                      className="h-11 rounded-xl border border-danger px-4 text-[15px] font-semibold text-danger"
                    >
                      {ev.action}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
