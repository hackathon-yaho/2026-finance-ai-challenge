interface IntroStageProps {
  onStart: () => void
}

const STAT_PILLS = ["계좌 지급정지 149,176건 · 최근 1년", "보이스피싱은 ▼35.5% 감소", "표준 심사기간 5영업일"]

export function IntroStage({ onStart }: IntroStageProps) {
  return (
    <div className="flex flex-col items-center gap-7 px-1 py-10 text-center">
      <div>
        <div className="mb-2.5 text-[13px] font-semibold tracking-wide text-brand">解氷 · 지급정지 계좌 소명 지원</div>
        <div className="text-[44px] font-bold tracking-tight text-ink">해빙</div>
        <p className="mx-auto mt-3.5 max-w-[320px] text-[17px] leading-relaxed text-muted">
          지급정지된 계좌, 은행 심사역이
          <br />
          5영업일 안에 판단할 수 있는
          <br />
          형태로 정리해드려요
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {STAT_PILLS.map((pill) => (
          <div key={pill} className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-muted">
            {pill}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="h-14 w-full max-w-[280px] rounded-2xl bg-brand text-[17px] font-bold text-white"
      >
        시작하기
      </button>

      <p className="max-w-[320px] rounded-2xl bg-brand-subtle px-4 py-2.5 text-xs leading-relaxed text-brand">
        이 화면은 제출 자료를 정리하는 도구입니다. 지급정지 해제 여부는 은행 심사로 결정돼요.
      </p>
    </div>
  )
}
