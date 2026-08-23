import { QUESTIONS } from "../../data"
import type { IntakeAnswers, IntakeField } from "../../types"

interface IntakeStageProps {
  intake: IntakeAnswers
  deadlineNotice: string | null
  deadlineUrgent: boolean
  onPick: (field: IntakeField, value: string) => void
}

export function IntakeStage({ intake, deadlineNotice, deadlineUrgent, onPick }: IntakeStageProps) {
  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="text-[28px] leading-[1.3] font-bold tracking-tight">상황을 알려주세요</div>
        <p className="mt-1.5 text-[15px] leading-normal text-muted">6개 문항에 답하면 다음으로 넘어갈 수 있어요. 자료가 없어도 진행할 수 있어요.</p>
      </div>

      {deadlineNotice && (
        <div
          key={intake.notice}
          className={`animate-deadline-in origin-top rounded-2xl p-4 ${deadlineUrgent ? "bg-danger-subtle" : "bg-brand-subtle"}`}
        >
          <div className={`mb-1 text-[13px] font-semibold ${deadlineUrgent ? "text-danger" : "text-brand"}`}>이의제기 기한</div>
          <div className="text-[15px] leading-normal">{deadlineNotice}</div>
        </div>
      )}

      {QUESTIONS.map((question, qi) => (
        <div key={question.id} className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-subtle text-[13px] font-bold tabular-nums text-brand">
              {qi + 1}
            </div>
            <div className="text-[17px] leading-[1.45] font-semibold tracking-tight">{question.label}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => {
              const selected = intake[question.id] === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onPick(question.id, option)}
                  className={`h-11 rounded-full border px-[18px] text-[15px] font-semibold tracking-tight transition-all duration-[120ms] ${
                    selected ? "border-ink bg-ink text-white" : "border-border bg-bg text-ink"
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
