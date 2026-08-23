import type { AmountInfo, ViewerId } from "../types"

interface ViewerSheetProps {
  viewer: ViewerId | null
  note: string | null
  width: number
  amountInfo: AmountInfo
  onClose: () => void
}

const TITLES: Record<ViewerId, string> = {
  chat: "구매자와의 대화",
  bank: "입출금 내역",
  shipping: "택배 접수 확인",
  threat: "문자 메시지",
}

const SUBTITLES: Record<ViewerId, string> = {
  chat: "2026.09.01 · 마스킹 후 전송됨",
  bank: "2026.08~09 · 계좌번호 가림",
  shipping: "2026.09.01 · 송장번호 가림",
  threat: "2026.09.02 · 별첨 자료",
}

export function ViewerSheet({ viewer, note, width, amountInfo, onClose }: ViewerSheetProps) {
  if (!viewer) return null
  const wide = width >= 720

  const chatBubbles = [
    { who: "them", text: "이거 아직 판매중이에요?", time: "13:40" },
    { who: "me", text: `네, ${amountInfo.short}에 드릴게요`, time: "13:42" },
    { who: "them", text: "지금 바로 입금할게요", time: "13:44" },
    { who: "me", text: "송장 나오면 바로 알려드릴게요", time: "16:06" },
  ] as const

  const bankRows = [
    { desc: "통신비 자동이체", time: "08.15 09:00", amount: "−54,000원", kind: "out" },
    { desc: "통신비 자동이체", time: "07.15 09:00", amount: "−54,000원", kind: "out" },
    { desc: "물품대금 입금", time: "09.01 14:12", amount: `+${amountInfo.formatted}`, kind: "in" },
  ] as const

  const shippingRows = [
    { k: "접수일시", v: "2026.09.01 16:05" },
    { k: "송장번호", v: "6402-****-1180" },
    { k: "받는 분", v: "김○○" },
    { k: "물품", v: "태블릿 1개" },
  ]

  const threatBubbles = [
    { text: "계좌 풀어드릴 수 있어요", time: "09:08" },
    { text: "20만원만 보내주시면 신고 취하해드릴게요", time: "09:10" },
  ]

  return (
    <>
      <div onClick={onClose} className="animate-scrim-in fixed inset-0 z-30 cursor-pointer bg-black/56" />
      <div
        className={
          "animate-sheet-up fixed z-[31] flex flex-col bg-bg " +
          (wide
            ? "top-1/2 left-1/2 max-h-[84vh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[20px] shadow-2xl"
            : "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[20px] shadow-2xl")
        }
      >
        <div className="flex items-center gap-3 border-b border-border px-5 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold tracking-tight">{TITLES[viewer]}</div>
            <div className="mt-0.5 text-xs text-muted">{SUBTITLES[viewer]}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 flex-none items-center justify-center text-xl text-muted">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {viewer === "chat" && (
            <div className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4">
              <div className="text-center text-[11px] font-medium text-muted">2026년 9월 1일</div>
              {chatBubbles.map((b, i) => (
                <div key={i} className={`flex items-end gap-2 ${b.who === "me" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={
                      "max-w-[78%] rounded-2xl px-3.5 py-3 text-[15px] leading-normal " +
                      (b.who === "me" ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm border border-border bg-bg")
                    }
                  >
                    {b.text}
                  </div>
                  <div className="flex-none text-[11px] tabular-nums text-muted">{b.time}</div>
                </div>
              ))}
            </div>
          )}

          {viewer === "bank" && (
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="flex items-center gap-2 bg-surface px-4 py-3.5">
                <div className="text-[13px] font-semibold">입출금 내역</div>
                <div className="h-3.5 w-16 rounded bg-ink" />
                <div className="text-[11px] text-muted">계좌번호 가림</div>
              </div>
              {bankRows.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 border-t border-border px-4 py-3.5 ${r.kind === "in" ? "bg-brand-subtle" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">{r.desc}</div>
                    <div className="mt-0.5 text-xs tabular-nums text-muted">{r.time}</div>
                  </div>
                  <div className={`flex-none text-[15px] font-bold tabular-nums ${r.kind === "in" ? "text-brand" : ""}`}>{r.amount}</div>
                </div>
              ))}
            </div>
          )}

          {viewer === "shipping" && (
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="bg-surface px-4 py-3.5 text-[13px] font-semibold">택배 접수 확인</div>
              {shippingRows.map((r) => (
                <div key={r.k} className="flex items-center justify-between gap-4 border-t border-border px-4 py-3.5">
                  <div className="flex-none text-[13px] text-muted">{r.k}</div>
                  <div className="text-right text-[15px] font-semibold tabular-nums">{r.v}</div>
                </div>
              ))}
            </div>
          )}

          {viewer === "threat" && (
            <div className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4">
              <div className="text-center text-[11px] font-medium text-muted">010-****-1234 · 2026년 9월 2일</div>
              {threatBubbles.map((b, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="max-w-[78%] rounded-2xl rounded-bl-sm border border-border bg-bg px-3.5 py-3 text-[15px] leading-normal">
                    {b.text}
                  </div>
                  <div className="flex-none text-[11px] tabular-nums text-muted">{b.time}</div>
                </div>
              ))}
              <div className="mt-1 rounded-xl bg-danger-subtle px-3.5 py-3 text-[13px] leading-normal">
                <b>답장하지 마세요.</b> 이 메시지가 소명에 쓰이는 객관적 자료예요.
              </div>
            </div>
          )}

          {note && <div className="mt-4 rounded-2xl bg-brand-subtle px-4 py-3.5 text-[13px] leading-normal text-brand">{note}</div>}

          <div className="mt-4 text-xs leading-tight text-muted">이 원본은 브라우저 안에만 있어요. 서버에는 남지 않아요.</div>
        </div>
      </div>
    </>
  )
}
