import { EVIDENCE_META } from "../../data"
import type { EvidenceId, EvidenceState, TimelineEvent } from "../../types"

interface EvidenceStageProps {
  evidence: EvidenceState
  onToggle: (id: EvidenceId) => void
  onAddThreat: () => void
  analyzing: boolean
  analyzed: boolean
  onAnalyze: () => void
  timeline: TimelineEvent[]
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

export function EvidenceStage({
  evidence,
  onToggle,
  onAddThreat,
  analyzing,
  analyzed,
  onAnalyze,
  timeline,
}: EvidenceStageProps) {
  return (
    <div className="flex flex-col gap-5">
      {evidence.threat && (
        <div className="animate-banner-drop flex items-start gap-2.5 rounded-2xl bg-danger-subtle p-3.5 opacity-0">
          <div className="flex h-5 w-5 flex-none items-center justify-center rounded-md bg-danger text-[13px] font-bold text-white">
            !
          </div>
          <p className="text-[13px] leading-relaxed text-ink">
            <b>이 문자를 지우지 마세요.</b> 답장하지 말고 그대로 보존해서 소명자료로 첨부해요.
          </p>
        </div>
      )}

      <p className="text-sm leading-relaxed text-muted">
        가진 자료를 최대한 포함해주세요. 체크를 해제하면 타임라인에서 빠져요.
      </p>

      <div className="flex flex-col gap-2.5">
        {EVIDENCE_META.map((card) => {
          const included = evidence[card.id]
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onToggle(card.id)}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left ${
                included ? "border-brand-subtle bg-brand-subtle" : "border-border bg-white"
              }`}
            >
              <div
                className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border-[1.5px] text-[13px] font-bold text-white ${
                  included ? "border-brand bg-brand opacity-100" : "border-neutral bg-neutral opacity-0"
                }`}
              >
                ✓
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-ink">{card.title}</div>
                <div className="mt-0.5 text-xs text-muted">{card.time}</div>
              </div>
              <div className="flex-none rounded-full bg-surface px-2 py-1 text-[11px] font-semibold text-muted">
                {card.kindLabel}
              </div>
            </button>
          )
        })}
      </div>

      {!evidence.threat && (
        <button
          type="button"
          onClick={onAddThreat}
          className="self-start rounded-full border border-danger px-3.5 py-2 text-[13px] font-semibold text-danger"
        >
          협박성 문자를 받았다면 추가하기
        </button>
      )}

      <button type="button" onClick={onAnalyze} className="h-12 rounded-2xl bg-ink text-[15px] font-semibold text-white">
        {analyzing ? <LoadingDots /> : <span>{analyzed ? "다시 분석하기" : "증거 분석하기"}</span>}
      </button>

      {analyzed && (
        <div className="mt-1 flex flex-col gap-0.5">
          <div className="mb-2.5 text-sm font-semibold text-ink">타임라인으로 재구성했어요</div>
          {timeline.map((event, index) => (
            <div
              key={`${event.time}-${index}`}
              className="animate-fade-up flex gap-3 opacity-0"
              style={{ animationDelay: `${index * 0.12}s` }}
            >
              <div
                className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${
                  event.gap ? "bg-danger" : event.threat ? "bg-warning" : "bg-brand"
                }`}
              />
              <div className="flex-1 pb-4">
                <div className="text-[11px] tabular-nums text-muted">{event.time}</div>
                <div
                  className={`mt-0.5 text-sm leading-snug ${
                    event.gap
                      ? "animate-shake-x rounded-[10px] border-[1.5px] border-dashed border-danger bg-danger-subtle px-2.5 py-2 font-semibold text-danger"
                      : "text-ink"
                  }`}
                >
                  {event.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
