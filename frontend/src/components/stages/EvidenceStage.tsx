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
  /** `/api/evidence` 판독 중. 이 동안에는 결과 화면을 보여주지 않는다. */
  extracting: boolean
  timelineRunId: number
  timeline: TimelineEvent[]
  onToggle: (id: EvidenceId) => void
  onAddThreat: () => void
  onConfirmCard: (eventId: string) => void
  /** F7-05 — `source_image_index`로 메모리의 원본을 찾는다. 없으면 `null`. */
  findSource: (imageIndex: number) => { id: string } | null
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
  extracting,
  timelineRunId,
  timeline,
  onToggle,
  onAddThreat,
  onConfirmCard,
  findSource,
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

  /**
   * 판독이 도는 동안 **"읽었어요"라고 말하지 않는다.**
   *
   * 종전에는 `[이 자료로 계속하기]`를 누르는 즉시 이 화면으로 바뀌면서 완료형 제목과 빈
   * 카드 목록이 먼저 뜨고, 응답이 오면 카드가 튀어나왔다. 다 읽은 화면을 보여줬다가 다시
   * 그리는 셈이라 **고장으로 읽힌다.** 몇 장을 읽고 있는지까지 말해준다 — 장수만큼 시간이
   * 걸린다는 것을 알면 기다릴 수 있다.
   */
  if (extracting) {
    return (
      <div className="stagger flex flex-col gap-6">
        <div>
          <div className="text-[28px] leading-[1.3] font-bold tracking-tight">자료를 읽고 있어요</div>
          <p className="mt-1.5 text-[15px] leading-normal text-muted">
            {uploadedFiles.length > 0
              ? `${uploadedFiles.length}장을 하나씩 읽고 있어요. 잠시만 기다려주세요.`
              : "적어주신 내용을 정리하고 있어요. 잠시만 기다려주세요."}
          </p>
        </div>
        {/* 몇 장짜리인지 보이도록 올린 장수만큼 자리를 잡아둔다. 끝나면 이 자리에 카드가 온다. */}
        <div className="flex flex-col gap-3">
          {Array.from({ length: Math.max(uploadedFiles.length, 1) }).map((_, i) => (
            <div
              key={i}
              className="h-[104px] animate-pulse rounded-2xl border border-border bg-surface"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      </div>
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
      {/* 정렬은 **카드가 각자 정한다** (`ConfirmCard`의 `self-start`). 펼친 카드는 그리드
          기본값(`stretch`)대로 같은 행에서 높이를 맞추고, 접은 카드만 자기 높이로 줄어든다. */}
      <div className={wide ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
        {cards.map((card) => (
          <ConfirmCard
            key={card.event_id}
            card={card}
            onConfirm={onConfirmCard}
            onEdit={onEditCard}
            onRemove={onRemoveCard}
            onOpenViewer={onOpenViewer}
            findSource={findSource}
            onOpenSource={onPreviewUpload}
          />
        ))}
      </div>

      {/**
       * 읽었는데 **아무것도 못 찾은 경우.** 판독 실패(EXTRACTION_FAILED)와 다르다 — 호출은
       * 성공했고 결과가 비어 있을 뿐이다. 종전에는 이 자리가 그냥 비어 있어서, 사용자는
       * 자기 자료가 왜 사라졌는지 알 수 없었다. **없는 것을 만들어 채우지 않고 그대로
       * 말하고**, 대신 갈 곳(F3-04 텍스트 입력)을 준다.
       */}
      {cards.length === 0 && (
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-[15px] font-semibold">읽을 수 있는 거래 내용을 찾지 못했어요</div>
          <p className="mt-1 text-[13px] leading-normal text-muted">
            화면이 잘렸거나 글씨가 흐리면 읽지 못할 수 있어요. 다시 캡처해서 올리시거나, 있었던 일을
            글로 적어주시면 그걸로 정리해드려요.
          </p>
          <button
            type="button"
            onClick={onOpenTextEntry}
            className="mt-3 h-11 rounded-xl border border-border bg-bg px-4 text-[15px] font-semibold text-ink"
          >
            글로 직접 쓰기
          </button>
        </div>
      )}

      {unconfirmedCount > 0 && blockingCount === 0 && (
        <p className="text-[13px] leading-normal text-muted">
          확인하지 않은 자료 {unconfirmedCount}건은 문서에 포함되지 않아요. 그대로 진행할 수 있어요.
        </p>
      )}

      {/* 이미 협박 카드가 있으면 권하지 않는다. 목은 `evidence.threat`가, 연결된 상태에서는
          AI가 분류한 카드가 그 사실을 알려준다 — 목 플래그만 보면 서버 판독으로 이미 들어온
          경우에도 계속 권하게 된다. */}
      {!evidence.threat && !cards.some((card) => card.source_type === "threat") && (
        <button type="button" onClick={onAddThreat} className="h-11 self-start rounded-xl border border-border bg-bg px-4 text-[15px] font-semibold text-ink">
          협박 문자 캡처 추가하기
        </button>
      )}

      <div className="h-px bg-border" />

      <div ref={timelineRef}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-[17px] font-semibold tracking-tight">시간순 타임라인</div>
          <button type="button" onClick={onAnalyze} className="h-11 flex-none rounded-xl bg-ink px-4 text-[15px] font-semibold text-white">
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
                  {/* 공백을 메우는 길 (F5-03 `[추가하기]`). 목은 증거 유형 토글로 시늉했고,
                      연결된 상태에서는 자료를 더 올리는 것 말고 메울 방법이 없다. */}
                  {ev.action && (ev.srcToggle || ev.toUpload) && (
                    <button
                      type="button"
                      onClick={ev.toUpload ? onBackToUpload : () => onToggle(ev.srcToggle as EvidenceId)}
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
