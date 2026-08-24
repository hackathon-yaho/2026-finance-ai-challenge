/**
 * 날짜는 앱 상태·계약 양쪽에서 "YYYY-MM-DD" 문자열로만 다룬다.
 *
 * api-contract의 `when`·`dueNoticeDate` 형식이 그렇고, Date 객체를 상태에 그대로 넣으면
 * 직렬화·타임존 변환에서 하루가 밀린다. Date는 이 파일 안에서 계산할 때만 쓴다.
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

export function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * "YYYY-MM-DD" → 로컬 자정 Date.
 *
 * `new Date("2026-09-01")`을 쓰면 안 된다 — 하이픈 형식은 UTC로 해석돼 KST에서는
 * 8월 31일 09:00이 되고, 날짜만 비교하는 로직이 하루씩 어긋난다.
 */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

/** "2026.09.01" */
export function formatDot(iso: string): string {
  return iso.replace(/-/g, ".")
}

/** "2026.09.01 (화)" — 통지서의 날짜와 대조하기 쉽게 요일을 같이 보여준다. */
export function formatDotWeekday(iso: string): string {
  return `${formatDot(iso)} (${WEEKDAYS[fromISO(iso).getDay()]})`
}

/** "2026년 9월" */
export function formatMonth(year: number, month: number): string {
  return `${year}년 ${month}월`
}

/**
 * 개월 수를 더한다. 대상 월에 없는 날은 그 월의 말일로 당긴다
 * (12월 31일 + 2개월 = 2월 28일). 기한 계산이 존재하지 않는 날짜를 만들지 않게 한다.
 */
export function addMonths(iso: string, months: number): string {
  const date = fromISO(iso)
  const target = date.getMonth() + months
  const lastDayOfTarget = new Date(date.getFullYear(), target + 1, 0).getDate()
  return toISO(new Date(date.getFullYear(), target, Math.min(date.getDate(), lastDayOfTarget)))
}

export function shiftDays(iso: string, delta: number): string {
  const date = fromISO(iso)
  return toISO(new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta))
}

/** from → to 일수. 둘 다 로컬 자정 기준이라 서머타임과 무관하다. */
export function diffDays(from: string, to: string): number {
  return Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86_400_000)
}

export function monthOf(iso: string): { year: number; month: number } {
  const date = fromISO(iso)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

/** 그 달 1일의 요일(0=일)과 총 일수. 캘린더 격자를 그리는 데 쓴다. */
export function monthGrid(year: number, month: number): { lead: number; days: number } {
  return {
    lead: new Date(year, month - 1, 1).getDay(),
    days: new Date(year, month, 0).getDate(),
  }
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function isoOf(year: number, month: number, day: number): string {
  return toISO(new Date(year, month - 1, day))
}

export { WEEKDAYS }
