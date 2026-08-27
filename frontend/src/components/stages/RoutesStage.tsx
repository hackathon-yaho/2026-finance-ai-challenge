import { useState } from "react"
import { ROUTES } from "../../data"
import { Check } from "../icons"

interface RoutesStageProps {
  showBizNotice: boolean
  /** 제출 패키지를 실제로 내려받았는지. `packageConfirmedAt`이 채워지는 시점과 같다. */
  packageDownloaded: boolean
  /** 이 화면에서 바로 내보내기를 연다. 4단계로 돌려보내지 않는다. */
  onExportPackage: () => void
}

/**
 * F9-02 트리거 — **문진에 문항을 만들지 않는다.** "고소당하셨나요?" 같은 질문을 전면에
 * 두면 해당 없는 사용자까지 불안해진다. 해당하는 사람만 스스로 고르게 둔다.
 */
const CRIMINAL_SIGNALS = [
  { id: "witness", label: "참고인 조사 통보를 받았어요" },
  { id: "handover", label: "계좌·체크카드·OTP를 다른 사람에게 준 적이 있어요" },
]

export function RoutesStage({ showBizNotice, packageDownloaded, onExportPackage }: RoutesStageProps) {
  const [signals, setSignals] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (id: string) =>
    setSignals((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <div className="stagger flex flex-col gap-6">
      {/**
       * **아직 파일을 안 받은 사람을 여기서 잡는다.**
       *
       * 파일을 못 받고 나가는 실제 경로는 "접수 안내를 읽고 → 다 했다고 느끼고 → 닫는" 것이다.
       * 그래서 이 화면에 **도착하기 전**에 묻지 않고 도착한 자리에 둔다 — 사람은 도착한 뒤에
       * 마음을 정하고, 하단 CTA로 왔든 단계 인디케이터로 건너뛰었든 여기는 똑같이 지난다.
       *
       * **막지 않는다.** 확인 대화상자로 세우면 안내를 먼저 읽으려던 사람까지 멈춰 세우게 되고,
       * 되돌릴 수 있는 행동에 확인을 붙이면 "확인창은 진짜 위험할 때만 뜬다"는 신뢰가 옅어진다.
       * 되돌아갈 수 있다고 설명하는 대신 **그 자리에서 받게** 한다.
       */}
      {!packageDownloaded && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3.5">
          <p className="min-w-0 flex-1 text-[13px] leading-normal">아직 제출 파일을 안 받으셨어요.</p>
          <button
            type="button"
            onClick={onExportPackage}
            className="h-11 flex-none rounded-xl bg-ink px-4 text-[15px] font-semibold text-white"
          >
            지금 받기
          </button>
        </div>
      )}

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

      {/* F9-02 형사 전환 신호 안내 (FR-052).
          법 제7조 제1항 단서상 이의제기가 제한될 수 있는 경우를 알리되,
          **서비스가 해당 여부를 판단하지 않는다.** 판단은 전문가와 수사기관의 몫이다. */}
      <div className="rounded-2xl border border-border p-4">
        <div className="text-[15px] font-semibold">혹시 이런 경우인가요?</div>
        <p className="mt-1 text-[13px] leading-normal text-muted">
          해당하지 않으면 넘어가셔도 돼요. 해당하는 경우에만 안내를 보여드려요.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {CRIMINAL_SIGNALS.map((signal) => {
            const on = signals.has(signal.id)
            return (
              <button
                key={signal.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(signal.id)}
                className={`flex min-h-11 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left ${
                  on ? "border-brand bg-brand-subtle" : "border-border"
                }`}
              >
                <span
                  className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded border-[1.5px] text-[11px] font-bold ${
                    on ? "border-brand bg-brand text-white" : "border-neutral text-transparent"
                  }`}
                >
                  <Check size={12} />
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-normal">{signal.label}</span>
              </button>
            )
          })}
        </div>

        {signals.size > 0 && (
          <div className="animate-drop-in mt-3 rounded-xl bg-surface p-3.5">
            <p className="text-[13px] leading-normal">
              이런 경우에는 <b>소명의 성격이 달라집니다.</b> 통신사기피해환급법 제7조 제1항 단서에 따라, 계좌가
              사기에 이용된 사실을 알았거나 중대한 과실로 알지 못했다고 인정되면 이의제기가 제한될 수 있어요.
            </p>
            <p className="mt-2 text-[13px] leading-normal">
              <b>해당하는지는 저희가 판단하지 않아요.</b> 이 서비스의 범위를 벗어나는 문제라, 변호사 등 전문가와
              먼저 상담하시기를 권해요. 사건 구조를 충분히 설명하지 못하면 참고인에서 입장이 달라지는 경우가
              보고됩니다.
            </p>
            <p className="mt-2 text-xs leading-normal text-muted">
              신고 접수증이나 수사 결과 통지서가 있으면 소명서 화면의 첨부 서류 목록에서 표시해두세요.
            </p>
          </div>
        )}
      </div>

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

      {/* 상단 배지는 진입 화면에만 있다. 접수 화면은 사용자가 실제로 서류를 내러 가는
          자리라 같은 취지의 문장을 여기서 다시 말한다. */}
      <p className="rounded-2xl bg-brand-subtle p-3.5 text-[13px] leading-normal text-brand">
        이 화면은 제출 자료를 정리하는 도구예요. 지급정지 해제 여부는 은행 심사로 결정돼요.
      </p>
    </div>
  )
}
