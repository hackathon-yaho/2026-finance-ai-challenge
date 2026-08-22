import type { ChecklistItem } from "../../types"

interface DraftStageProps {
  draftGenerating: boolean
  draftRevealed: boolean
  draftParagraphs: string[]
  checklist: ChecklistItem[]
  onGenerate: () => void
  onExportPdf: () => void
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-white" />
      <span className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-white [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-white [animation-delay:300ms]" />
    </span>
  )
}

export function DraftStage({
  draftGenerating,
  draftRevealed,
  draftParagraphs,
  checklist,
  onGenerate,
  onExportPdf,
}: DraftStageProps) {
  return (
    <div className="flex flex-col gap-5">
      {!draftRevealed && (
        <div className="flex flex-col items-center gap-4 px-3 py-10">
          <p className="text-center text-sm leading-relaxed text-muted">
            타임라인과 판정 결과를 바탕으로
            <br />
            사실 진술서 초안을 만들어요
          </p>
          <button
            type="button"
            onClick={onGenerate}
            className="h-[52px] w-full max-w-[260px] rounded-2xl bg-brand text-[15px] font-bold text-white"
          >
            {draftGenerating ? <LoadingDots /> : <span>소명서 초안 생성하기</span>}
          </button>
        </div>
      )}

      {draftRevealed && (
        <>
          <div className="rounded-2xl border border-border bg-bg p-[18px]">
            <div className="mb-2.5 text-xs font-semibold text-muted">소명서 초안</div>
            {draftParagraphs.map((paragraph, index) => (
              <p
                key={index}
                className="animate-fade-up mb-3 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink opacity-0"
                style={{ animationDelay: `${index * 0.18}s` }}
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-ink">첨부 서류 체크리스트</div>
            {checklist.map((doc) => (
              <div key={doc.label} className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
                <div className="text-[13px] text-ink">{doc.label}</div>
                <div
                  className={`flex-none rounded-full px-2 py-[3px] text-[11px] font-semibold ${
                    doc.have ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"
                  }`}
                >
                  {doc.have ? "보유" : "미보유 · 보완 요청 사유가 될 수 있어요"}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onExportPdf}
            className="h-12 rounded-2xl border border-border bg-white text-sm font-semibold text-ink"
          >
            PDF로 내보내기
          </button>
        </>
      )}
    </div>
  )
}
