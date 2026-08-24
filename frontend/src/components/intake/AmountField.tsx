import { formatKoreanAmount } from "../../lib/amount"

/** 원 단위 상한. 이보다 큰 값은 입력 자체를 막는다 — 자릿수를 잘못 누른 경우가 대부분이다. */
const MAX_AMOUNT = 9_999_999_999

interface AmountFieldProps {
  value: number | null
  unknown: boolean
  onChange: (value: number | null) => void
  onToggleUnknown: () => void
}

export function AmountField({ value, unknown, onChange, onToggleUnknown }: AmountFieldProps) {
  const handleChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "")
    const won = Number(digits)
    // 0은 미입력으로 본다. 정지된 입금이 0원일 수는 없고, 앞자리 0을 눌러도 칸이 "0"으로
    // 채워지지 않아야 한다 ("045"를 넣으면 45가 된다).
    if (digits === "" || won === 0) {
      onChange(null)
      return
    }
    onChange(Math.min(won, MAX_AMOUNT))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            inputMode="numeric"
            // 숫자 입력에 붙는 브라우저 자동완성 후보가 금액칸을 가린다.
            autoComplete="off"
            value={unknown || value === null ? "" : value.toLocaleString("ko-KR")}
            onChange={(event) => handleChange(event.target.value)}
            disabled={unknown}
            placeholder="0"
            aria-label="입금액"
            className={`h-11 w-full rounded-2xl border bg-bg pl-[18px] pr-9 text-[15px] font-semibold tabular-nums tracking-tight transition-all duration-[120ms] outline-none placeholder:font-normal placeholder:text-muted disabled:opacity-40 ${
              value !== null && !unknown ? "border-brand" : "border-border"
            }`}
          />
          <span
            className={`pointer-events-none absolute top-1/2 right-[18px] -translate-y-1/2 text-[15px] font-semibold ${
              unknown ? "text-muted opacity-40" : "text-muted"
            }`}
          >
            원
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleUnknown}
          className={`h-11 flex-none rounded-2xl border px-5 text-[15px] font-semibold tracking-tight transition-all duration-[120ms] ${
            unknown ? "border-brand bg-brand text-white" : "border-border bg-bg text-muted"
          }`}
        >
          모름
        </button>
      </div>
      {/* 자릿수를 잘못 눌렀는지 바로 확인할 수 있게 읽어서 되돌려준다. */}
      {!unknown && value !== null && value > 0 && (
        <div className="text-[13px] font-semibold text-brand">{formatKoreanAmount(value)}</div>
      )}
    </div>
  )
}
