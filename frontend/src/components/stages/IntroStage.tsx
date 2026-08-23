import { INTRO_STATS } from "../../data"
import { TypewriterValue } from "../TypewriterValue"

interface IntroStageProps {
  wide: boolean
}

const STAT_ROW_STAGGER_MS = 350

export function IntroStage({ wide }: IntroStageProps) {
  return (
    <div className="stagger flex flex-col gap-8 pt-6">
      <div>
        <div className="mb-3 text-[13px] font-semibold text-brand">解氷 · 지급정지 계좌 소명 지원</div>
        <div className={`font-bold tracking-tight ${wide ? "text-[40px] leading-[1.25]" : "text-[28px] leading-[1.25]"}`}>
          지급정지된 계좌,
          <br />
          은행이 5영업일 안에
          <br />
          판단할 수 있게 정리해요
        </div>
        <p className="mt-4 max-w-[520px] text-[17px] leading-relaxed tracking-tight text-muted">
          문진에 답하고 가진 자료를 올리면, 시간순 타임라인과 사실 진술서 초안까지 만들어드려요. 문장마다 어떤 자료에서
          나왔는지 눌러서 확인할 수 있어요.
        </p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-border">
        {INTRO_STATS.map((row, i) => (
          <div key={row.title} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold tracking-tight">{row.title}</div>
              <div className="mt-0.5 text-[13px] leading-normal text-muted">{row.desc}</div>
            </div>
            <div className="flex-none text-[15px] font-bold tabular-nums">
              <TypewriterValue text={row.value} delayMs={i * STAT_ROW_STAGGER_MS} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-danger-subtle p-4">
        <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-danger text-[13px] font-bold text-white">
          !
        </div>
        <p className="text-[13px] leading-normal">
          <b>지금 협박 연락을 받고 있다면</b>
          <br />
          돈을 보내지 마세요 · 메시지를 지우지 마세요 · 답장하지 마세요
        </p>
      </div>

      <p className="text-xs leading-normal text-muted">올린 자료는 서버에 저장되지 않아요. 브라우저 안에서만 보관하고 탭을 닫으면 사라져요.</p>
    </div>
  )
}
