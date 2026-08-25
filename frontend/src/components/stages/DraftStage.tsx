import { ChecklistPanel } from "../ChecklistPanel"
import type { ChecklistItem, DraftLine, ViewerId } from "../../types"

interface DraftStageProps {
  drafting: boolean
  draftShown: boolean
  draftLines: DraftLine[]
  checklist: ChecklistItem[]
  /** 미리보기를 거쳐 내려받은 시각. 그 전에는 "확인 완료"라고 적지 않는다 (F8-01 표기). */
  confirmedAt: string | null
  selfHeld: ReadonlySet<string>
  onToggleSelfHeld: (id: string) => void
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

export function DraftStage({
  drafting,
  draftShown,
  draftLines,
  checklist,
  confirmedAt,
  selfHeld,
  onToggleSelfHeld,
  confirmedCount,
  droppedCount,
  onGenerate,
  onOpenViewer,
  onExportPackage,
}: DraftStageProps) {
  return (
    <div className="stagger flex flex-col gap-6">
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
              {/* spec.md F8-01의 하단 표기는 "AI 초안 · 사용자 확인 완료 {시각}"인데, 사용자는 여기까지
                  오는 동안 초안을 확인한 적이 없다 — 생성하면 바로 붙던 문구라 사실이 아니었다.
                  확인 단계(S04-2 미리보기)가 들어오면 그때 "확인 완료 {시각}"을 붙인다.
                  근거: docs/response/backend/draft-preview-and-edit.md §0·§5-2 */}
              <div className="mt-0.5 text-xs text-muted">
                {confirmedAt
                  ? `AI 초안 · 사용자 확인 완료 ${confirmedAt} · 최종 판단은 금융회사`
                  : "AI 초안 · 내려받기 전에 확인해주세요 · 최종 판단은 금융회사"}
              </div>
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
            <div className="text-[17px] font-semibold tracking-tight">첨부 서류</div>
            <p className="mt-1 mb-4 text-[13px] leading-normal text-muted">
              성격이 다른 자료를 한 줄로 세우지 않았어요. 아래 순서대로 무게가 달라요.
            </p>
            <ChecklistPanel checklist={checklist} selfHeld={selfHeld} onToggleSelfHeld={onToggleSelfHeld} />
          </div>

          {/* spec.md F3-07 ③ "따로 챙기실 것" — 서비스가 받지 않는 법정 첨부서류를 내보내기
              직전에 한 번 더 모아 보여준다. 서식에 (서명 또는 인) 란이 있는데 전자서명은
              범위 밖이라 공란으로 나가고, 모르고 파일만 보내면 반려될 수 있다. */}
          <div className="rounded-2xl bg-brand-subtle px-4 py-4">
            <div className="text-[15px] font-semibold">따로 챙기실 것</div>
            <ul className="mt-2.5 flex flex-col gap-2 text-[13px] leading-normal text-ink">
              <li>
                <span className="font-semibold">신청서 자필 서명</span> — 서식에 서명란이 있어요. 전자서명은 지원하지
                않으니 <span className="font-semibold">출력해서 직접 서명한 뒤</span> 제출해주세요. 이메일·팩스로 낼
                때는 서명한 종이를 다시 찍거나 스캔해서 보내시면 돼요.
              </li>
              <li>
                <span className="font-semibold">명의인 신분증 사본</span> — 여기에 올리지 않아요. 은행에 낼 때 직접
                첨부해주세요.
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={onExportPackage}
            className="h-12 rounded-2xl border border-border bg-bg text-[17px] font-bold text-ink"
          >
            제출 패키지 내보내기
          </button>
        </>
      )}
    </div>
  )
}
