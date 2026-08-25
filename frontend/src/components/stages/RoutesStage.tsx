import { ROUTES } from "../../data"

interface RoutesStageProps {
  showBizNotice: boolean
}

export function RoutesStage({ showBizNotice }: RoutesStageProps) {
  return (
    <div className="stagger flex flex-col gap-6">
      <div>
        <div className="text-[28px] leading-[1.3] font-bold tracking-tight">어디에 내면 되나요</div>
        <p className="mt-1.5 text-[15px] leading-normal text-muted">이의제기는 그 계좌를 관리하는 금융회사에 내는 절차예요.</p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-border">
        {ROUTES.map((route, i) => (
          <div key={route.title} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold tracking-tight">{route.title}</div>
              <div className="mt-0.5 text-[13px] leading-normal text-muted">{route.desc}</div>
            </div>
            <div
              className={`flex-none rounded-md px-2 text-[11px] font-semibold leading-[22px] ${
                route.badge === "official" ? "bg-brand-subtle text-brand" : "bg-surface text-muted"
              }`}
            >
              {route.badge === "official" ? "공식" : "보조"}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-danger-subtle p-4">
        <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-danger text-[13px] font-bold text-white">
          !
        </div>
        <p className="text-[13px] leading-normal">
          <b>협박 연락을 받고 있다면</b>
          <br />
          돈을 보내지 마세요 · 메시지를 지우지 마세요 · 답장하지 마세요
        </p>
      </div>

      {showBizNotice && (
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-[15px] font-semibold">사업 계좌라면 미리 준비해요</div>
          <p className="mt-1 text-[13px] leading-normal text-muted">거래처에 결제 수단을 먼저 알리고, 카드 대금 입금 계좌와 자동이체 출금 계좌를 옮겨두세요.</p>
        </div>
      )}

      {/* 해제 이후 남는 불이익. "제출 준비 완료" 배지와 충돌하지 않도록 준비도 화면이 아니라
          제출 이후 단계에 둔다. 단정하지 않는 톤 — 해제 경로가 실제로 존재한다. */}
      <div className="rounded-2xl bg-surface p-4">
        <div className="text-[15px] font-semibold">지급정지가 풀린 뒤에도 남을 수 있어요</div>
        <p className="mt-1 text-[13px] leading-normal text-muted">
          사기이용계좌 명의인으로 등록되면 은행연합회를 통해 다른 은행에도 공유되어, 신규 계좌 개설이나 카드 발급이
          한동안 제한될 수 있어요. <b>지급정지 해제와는 별도 절차</b>이고, 은행 또는 은행연합회에 등록 해제를 따로
          신청할 수 있어요.
        </p>
      </div>

      <p className="rounded-2xl bg-brand-subtle p-3.5 text-[13px] leading-normal text-brand">
        이 화면은 제출 자료를 정리하는 도구예요. 지급정지 해제 여부는 은행 심사로 결정돼요.
      </p>
    </div>
  )
}
