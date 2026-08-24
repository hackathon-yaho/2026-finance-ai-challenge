import { useEffect, useMemo, useState } from "react"
import {
  addMonths,
  formatMonth,
  isoOf,
  monthGrid,
  monthOf,
  shiftDays,
  shiftMonth,
  todayISO,
  WEEKDAYS,
} from "../lib/date"

interface DateSheetProps {
  title: string
  hint: string
  value: string | null
  width: number
  /** 고를 수 있는 마지막 날. 기본은 오늘 — 정지일·공고일은 미래일 수 없다. */
  max?: string
  /** 고를 수 있는 첫 날. 기본은 5년 전 — 달 이동을 무한히 거슬러 가지 않게 막는다. */
  min?: string
  onSelect: (iso: string) => void
  onClose: () => void
}

export function DateSheet({ title, hint, value, width, max, min, onSelect, onClose }: DateSheetProps) {
  const today = todayISO()
  const last = max ?? today
  const first = min ?? addMonths(today, -60)
  const wide = width >= 720

  const [picked, setPicked] = useState<string | null>(value)
  // 처음 열 때 보여줄 달: 이미 고른 날짜가 있으면 그 달, 없으면 고를 수 있는 마지막 달.
  const [view, setView] = useState(() => monthOf(value ?? last))

  // 시트를 Esc로 닫는다. 스크림 클릭과 같은 취소 동작이라 고른 값을 넘기지 않는다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const { lead, days } = useMemo(() => monthGrid(view.year, view.month), [view])

  // 앞 빈칸 + 그 달의 날짜. 앞뒤 달 날짜는 그리지 않는다 — 무엇을 고르는지가 흐려진다.
  const cells = useMemo(
    () => [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)],
    [lead, days],
  )

  const prev = shiftMonth(view.year, view.month, -1)
  const next = shiftMonth(view.year, view.month, 1)
  const prevDisabled = isoOf(prev.year, prev.month, monthGrid(prev.year, prev.month).days) < first
  const nextDisabled = isoOf(next.year, next.month, 1) > last

  const pick = (iso: string) => {
    setPicked(iso)
    setView(monthOf(iso))
  }

  // 지급정지는 대개 최근 일이라, 가장 많이 고를 두 날짜만 위에 꺼내 둔다.
  const quickPicks = [
    { label: "오늘", iso: today },
    { label: "어제", iso: shiftDays(today, -1) },
  ].filter((quick) => quick.iso >= first && quick.iso <= last)

  return (
    <>
      <div onClick={onClose} className="animate-scrim-in fixed inset-0 z-30 cursor-pointer bg-black/56" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          "animate-sheet-up fixed z-[31] flex flex-col bg-bg " +
          // 세로가 짧은 화면(가로 모드)에서 격자가 화면을 넘기면 시트 위쪽과 선택 완료 버튼에
          // 손이 닿지 않는다. 넘칠 때만 시트 안에서 스크롤되게 둔다.
          (wide
            ? "top-1/2 left-1/2 max-h-[92dvh] w-[min(400px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] shadow-2xl"
            : "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[20px] shadow-2xl")
        }
      >
        {!wide && <div className="mx-auto mt-2.5 h-1 w-9 flex-none rounded-full bg-neutral" />}

        <div className="px-5 pt-4">
          <div className="text-[20px] leading-[1.35] font-bold tracking-tight">{title}</div>
          <p className="mt-1 text-[13px] leading-normal text-muted">{hint}</p>
        </div>

        {quickPicks.length > 0 && (
          <div className="flex gap-2 px-5 pt-4">
            {quickPicks.map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => pick(quick.iso)}
                className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold tracking-tight transition-all duration-[120ms] ${
                  picked === quick.iso ? "border-brand bg-brand text-white" : "border-border bg-bg text-muted"
                }`}
              >
                {quick.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 px-3 pt-4">
          <button
            type="button"
            onClick={() => setView(prev)}
            disabled={prevDisabled}
            aria-label="이전 달"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[17px] text-muted transition-colors duration-[120ms] disabled:opacity-25"
          >
            ‹
          </button>
          <div className="flex-1 text-center text-[17px] font-bold tabular-nums tracking-tight">
            {formatMonth(view.year, view.month)}
          </div>
          <button
            type="button"
            onClick={() => setView(next)}
            disabled={nextDisabled}
            aria-label="다음 달"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[17px] text-muted transition-colors duration-[120ms] disabled:opacity-25"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 px-3 pt-2">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`py-1.5 text-center text-[12px] font-semibold ${i === 0 ? "text-danger/70" : "text-muted"}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* key로 달마다 다시 재생시켜, 달을 넘길 때 격자가 바뀐 걸 눈으로 잡을 수 있게 한다. */}
        <div key={`${view.year}-${view.month}`} className="animate-fade-up grid grid-cols-7 px-3 pb-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`lead-${i}`} className="h-11" />

            const iso = isoOf(view.year, view.month, day)
            const disabled = iso > last || iso < first
            const selected = iso === picked
            const isToday = iso === today
            const sunday = i % 7 === 0

            return (
              <div key={iso} className="flex h-11 items-center justify-center">
                <button
                  type="button"
                  onClick={() => pick(iso)}
                  disabled={disabled}
                  aria-label={`${view.month}월 ${day}일`}
                  aria-pressed={selected}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full text-[15px] tabular-nums transition-all duration-[120ms] ${
                    selected
                      ? "bg-brand font-bold text-white"
                      : disabled
                        ? "font-medium text-neutral"
                        : isToday
                          ? "font-bold text-brand"
                          : sunday
                            ? "font-medium text-danger/80"
                            : "font-medium text-ink"
                  }`}
                >
                  {day}
                  {isToday && !selected && (
                    <span className="absolute bottom-1.5 h-[3px] w-[3px] rounded-full bg-brand" />
                  )}
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex flex-none items-center gap-3 px-5 pt-3 pb-5">
          <button
            type="button"
            onClick={() => picked && onSelect(picked)}
            disabled={picked === null}
            className="h-14 flex-1 rounded-2xl bg-brand text-[17px] font-bold tracking-tight text-white transition-opacity duration-200 disabled:opacity-30"
          >
            선택 완료
          </button>
        </div>
      </div>
    </>
  )
}
