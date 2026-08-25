import { INTAKE_PAGES, NOTICE_OPTIONS, QUESTIONS, isFieldVisible } from "../../data"
import type { DeadlineInfo } from "../../lib/deadline"
import { chipValue, isAnswered, summaryValue } from "../../lib/intake"
import type { DueNoticeStatus, IntakeAnswers, IntakeField } from "../../types"
import { AmountField } from "../intake/AmountField"
import { DateField } from "../intake/DateField"

// 문항 번호는 페이지가 나뉘어도 스펙 F2-01의 ①~⑥을 그대로 따라간다.
function findQuestion(id: IntakeField) {
  const index = QUESTIONS.findIndex((question) => question.id === id)
  return { question: QUESTIONS[index], no: index + 1 }
}

interface IntakeStageProps {
  page: number
  intake: IntakeAnswers
  deadline: DeadlineInfo | null
  onPick: (field: IntakeField, value: string) => void
  onOpenDate: (field: "when" | "notice") => void
  onToggleWhenUnknown: () => void
  onSetNoticeStatus: (status: DueNoticeStatus) => void
  onSetAmount: (value: number | null) => void
  onToggleAmountUnknown: () => void
  onGoPage: (page: number) => void
}

export function IntakeStage({
  page,
  intake,
  deadline,
  onPick,
  onOpenDate,
  onToggleWhenUnknown,
  onSetNoticeStatus,
  onSetAmount,
  onToggleAmountUnknown,
  onGoPage,
}: IntakeStageProps) {
  const current = INTAKE_PAGES[page]
  const priorFields = INTAKE_PAGES.slice(0, page).flatMap((prev, prevPage) =>
    prev.fields.filter((id) => isFieldVisible(id, intake.kind)).map((id) => ({ id, page: prevPage })),
  )

  return (
    <div key={page} className="stagger flex flex-col gap-7">
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
              const value = summaryValue(intake, id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onGoPage(target)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] tracking-tight transition-colors duration-[120ms]"
                >
                  <span className="text-muted">{question.short}</span>
                  <span className="font-semibold">{value ?? "미응답"}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {deadline && (
        <div
          key={deadline.notice}
          className={`animate-deadline-in origin-top rounded-2xl p-4 ${deadline.urgent ? "bg-danger-subtle" : "bg-brand-subtle"}`}
        >
          <div className={`mb-1 text-[13px] font-semibold ${deadline.urgent ? "text-danger" : "text-brand"}`}>
            이의제기 기한
          </div>
          {/* 법 제7조 근거 안내라 문구를 줄이거나 순화하지 않는다 (lib/deadline.ts 주석 참조). */}
          <div className="text-[15px] leading-normal">{deadline.notice}</div>
        </div>
      )}

      {/* F2-01a — 거래 방식은 물품 거래일 때만 나타난다. */}
      {current.fields.filter((id) => isFieldVisible(id, intake.kind)).map((id) => {
        const { question, no } = findQuestion(id)
        return (
          <div key={question.id} className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold tabular-nums transition-colors duration-200 ${
                  isAnswered(intake, id) ? "bg-brand text-white" : "bg-brand-subtle text-brand"
                }`}
              >
                {no}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[17px] leading-[1.45] font-semibold tracking-tight">{question.label}</div>
                {question.hint && <p className="mt-1 text-[13px] leading-normal text-muted">{question.hint}</p>}
              </div>
            </div>

            {question.input === "date" && (
              <DateField
                value={intake.when}
                placeholder="날짜 선택"
                unknown={intake.whenUnknown}
                onOpen={() => onOpenDate("when")}
                onToggleUnknown={onToggleWhenUnknown}
              />
            )}

            {question.input === "amount" && (
              <AmountField
                value={intake.amount}
                unknown={intake.amountUnknown}
                onChange={onSetAmount}
                onToggleUnknown={onToggleAmountUnknown}
              />
            )}

            {question.input === "notice" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {NOTICE_OPTIONS.map((option) => {
                    const selected = intake.noticeStatus === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onSetNoticeStatus(option.value)}
                        className={`h-11 rounded-full border px-[18px] text-[15px] font-semibold tracking-tight transition-all duration-[120ms] ${
                          selected ? "border-brand bg-brand text-white" : "border-border bg-bg text-ink"
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                {/* 기한은 공고일 + 2개월이라, 통지받은 경우에만 날짜를 더 받는다 (FR-014). */}
                {intake.noticeStatus === "notified" && (
                  <div className="animate-drop-in flex flex-col gap-2">
                    <div className="text-[13px] font-semibold text-muted">공고일</div>
                    <DateField
                      value={intake.noticeDate}
                      placeholder="공고일 선택"
                      onOpen={() => onOpenDate("notice")}
                    />
                  </div>
                )}
              </div>
            )}

            {question.input === "chips" && (
              <div className="flex flex-wrap gap-2">
                {question.options?.map((option) => {
                  const selected = chipValue(intake, question.id) === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onPick(question.id, option)}
                      className={`h-11 rounded-full border px-[18px] text-[15px] font-semibold tracking-tight transition-all duration-[120ms] ${
                        selected ? "border-brand bg-brand text-white" : "border-border bg-bg text-ink"
                      }`}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
