import type { ChecklistItem, DraftLine, ViewerId } from "../../types"

interface DraftStageProps {
  drafting: boolean
  draftShown: boolean
  draftLines: DraftLine[]
  checklist: ChecklistItem[]
  confirmedCount: number
  droppedCount: number
  onGenerate: () => void
  onOpenViewer: (id: ViewerId, note?: string | null) => void
  onExportPackage: () => void
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

function checklistTag(item: ChecklistItem): { label: string; tone: "have" | "missing" | "na" } {
  if (item.have) return { label: "보유", tone: "have" }
  if (item.id === "threat") return { label: "해당 없음", tone: "na" }
  return { label: "미보유", tone: "missing" }
}

export function DraftStage({
  drafting,
  draftShown,
  draftLines,
  checklist,
  confirmedCount,
  droppedCount,
  onGenerate,
  onOpenViewer,
  onExportPackage,
}: DraftStageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[28px] leading-[1.3] font-bold tracking-tight">사실관계 진술서</div>
        <p className="mt-1.5 text-[15px] leading-normal text-muted">문장을 누르면 근거가 된 원본이 열려요. 근거 없는 문장은 만들지 않아요.</p>
      </div>

      {!draftShown && (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-neutral px-5 py-10">
          <p className="max-w-[320px] text-center text-[15px] leading-normal text-muted">확인한 자료 {confirmedCount}건과 문진 응답으로 초안을 만들어요</p>
          <button
            type="button"
            onClick={onGenerate}
            className="h-14 rounded-2xl bg-brand px-7 text-[17px] font-bold text-white"
          >
            {drafting ? <LoadingDots /> : <span>초안 만들기</span>}
          </button>
        </div>
      )}

      {draftShown && (
        <>
          <div className="overflow-hidden rounded-[20px] border border-border">
            <div className="border-b border-border bg-subtle px-5 py-4">
              <div className="text-[15px] font-semibold">이의제기 사유 (별지 제4호서식)</div>
              <div className="mt-0.5 text-xs text-muted">AI 초안 · 사용자 확인 완료 · 최종 판단은 금융회사</div>
            </div>
            {draftLines.map((line, i) => (
              <div
                key={i}
                onClick={line.ref ? () => onOpenViewer(line.ref as ViewerId, line.note) : undefined}
                className={`animate-fade-up px-5 py-4 opacity-0 ${i > 0 ? "border-t border-border" : ""} ${line.ref ? "cursor-pointer" : ""}`}
                style={{ animationDelay: `${i * 0.14}s` }}
              >
                <div className="text-[15px] leading-relaxed">{line.text}</div>
                {line.badge && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <div
                      className={`inline-flex h-[22px] items-center rounded-md px-2 text-[11px] font-semibold ${
                        line.ref ? "bg-brand-subtle text-brand" : "bg-surface text-muted"
                      }`}
                    >
                      {line.badge}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {droppedCount > 0 && (
            <div className="rounded-2xl bg-surface px-4 py-3.5 text-[13px] leading-normal text-muted">
              근거가 없어 문장 {droppedCount}개를 넣지 않았어요. 자료를 더 올리면 문장이 늘어나요.
            </div>
          )}

          <div>
            <div className="mb-3 text-[17px] font-semibold tracking-tight">첨부 서류</div>
            <div className="overflow-hidden rounded-2xl border border-border">
              {checklist.map((item, i) => {
                const tag = checklistTag(item)
                return (
                  <div key={item.id} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}>
                    <div className="min-w-0 flex-1 text-[15px]">{item.label}</div>
                    <div
                      className={`flex-none rounded-md px-2 text-[11px] font-semibold leading-[22px] ${
                        tag.tone === "have"
                          ? "bg-success-subtle text-success"
                          : tag.tone === "missing"
                            ? "bg-danger-subtle text-danger"
                            : "bg-surface text-muted"
                      }`}
                    >
                      {tag.label}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-2.5 text-xs leading-normal text-muted">신분증 사본은 여기에 올리지 않아요. 은행에 낼 때 직접 첨부해주세요.</p>
          </div>

          <button
            type="button"
            onClick={onExportPackage}
            className="h-12 rounded-2xl border border-border bg-bg text-[17px] font-bold text-ink"
          >
            제출 패키지 6종 내보내기
          </button>
        </>
      )}
    </div>
  )
}
