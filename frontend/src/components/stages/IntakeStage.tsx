import { INTAKE_PAGES, QUESTIONS } from "../../data"
import type { IntakeAnswers, IntakeField } from "../../types"

// 문항 번호는 페이지가 나뉘어도 스펙 F2-01의 ①~⑥을 그대로 따라간다.
function findQuestion(id: IntakeField) {
  const index = QUESTIONS.findIndex((question) => question.id === id)
  return { question: QUESTIONS[index], no: index + 1 }
}

interface IntakeStageProps {
  page: number
  dir: 1 | -1
  intake: IntakeAnswers
  deadlineNotice: string | null
  deadlineUrgent: boolean
  onPick: (field: IntakeField, value: string) => void
  onGoPage: (page: number) => void
}

export function IntakeStage({ page, dir, intake, deadlineNotice, deadlineUrgent, onPick, onGoPage }: IntakeStageProps) {
  const current = INTAKE_PAGES[page]
  const priorFields = INTAKE_PAGES.slice(0, page).flatMap((prev, prevPage) =>
    prev.fields.map((id) => ({ id, page: prevPage })),
  )

  return (
    <div key={page} className={`flex flex-col gap-7 ${dir === 1 ? "animate-page-next" : "animate-page-prev"}`}>
      <div>
        <div className="flex items-center gap-2">
          {INTAKE_PAGES.map((item, i) => (
            <div
              key={item.title}
              className={`h-1 w-7 rounded-full transition-colors duration-200 ${i <= page ? "bg-brand" : "bg-border"}`}
            />
          ))}
          <div className="text-[12px] font-semibold tabular-nums text-muted">
            {page + 1} / {INTAKE_PAGES.length}
          </div>
        </div>
        <div className="mt-3 text-[28px] leading-[1.3] font-bold tracking-tight">{current.title}</div>
        <p className="mt-1.5 text-[15px] leading-normal text-muted">{current.desc}</p>
      </div>

      {/* F2-02 응답 요약 실시간 표시 — 앞 페이지 답을 계속 보여주고, 탭하면 그 페이지로 돌아간다. */}
      {priorFields.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="text-[13px] font-semibold text-muted">앞서 답한 내용 · 탭하면 고칠 수 있어요</div>
          <div className="flex flex-wrap gap-2">
            {priorFields.map(({ id, page: target }) => {
              const { question } = findQuestion(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onGoPage(target)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] tracking-tight transition-colors duration-[120ms]"
                >
                  <span className="text-muted">{question.short}</span>
                  <span className="font-semibold">{intake[id] ?? "미응답"}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {deadlineNotice && (
        <div
          key={intake.notice}
          className={`animate-deadline-in origin-top rounded-2xl p-4 ${deadlineUrgent ? "bg-danger-subtle" : "bg-brand-subtle"}`}
        >
          <div className={`mb-1 text-[13px] font-semibold ${deadlineUrgent ? "text-danger" : "text-brand"}`}>이의제기 기한</div>
          <div className="text-[15px] leading-normal">{deadlineNotice}</div>
        </div>
      )}

      {current.fields.map((id) => {
        const { question, no } = findQuestion(id)
        return (
          <div key={question.id} className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-subtle text-[13px] font-bold tabular-nums text-brand">
                {no}
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
        )
      })}
    </div>
  )
}
