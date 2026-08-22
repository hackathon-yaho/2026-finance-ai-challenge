import { QUESTIONS } from "../../data"
import type { IntakeAnswers, IntakeField } from "../../types"

interface IntakeStageProps {
  intake: IntakeAnswers
  onSelect: (field: IntakeField, value: string) => void
}

export function IntakeStage({ intake, onSelect }: IntakeStageProps) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-muted">
        5개 문항에 답하면 다음 단계로 넘어갈 수 있어요. 자료가 없어도 진행할 수 있어요.
      </p>

      {QUESTIONS.map((question, index) => (
        <div key={question.id} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-subtle text-xs font-bold text-brand">
              {index + 1}
            </span>
            <span className="text-base font-semibold text-ink">{question.label}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => {
              const selected = intake[question.id] === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onSelect(question.id, option)}
                  className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    selected ? "border-ink bg-ink text-white" : "border-border bg-white text-ink"
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
