import { ROUTES } from "../../data"

interface RoutesStageProps {
  threatAdded: boolean
}

const BADGE_STYLE: Record<"recommended" | "conditional", string> = {
  recommended: "bg-brand-subtle text-brand",
  conditional: "bg-surface text-muted",
}

const BADGE_LABEL: Record<"recommended" | "conditional", string> = {
  recommended: "권장",
  conditional: "조건부",
}

export function RoutesStage({ threatAdded }: RoutesStageProps) {
  return (
    <div className="flex flex-col gap-4">
      {threatAdded && (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-danger-subtle p-4">
          <div className="text-sm font-bold text-danger">협박 문자를 받았다면</div>
          <p className="text-[13px] leading-relaxed text-ink">지우지 마세요 · 답장하지 마세요 · 캡처해서 별첨으로 추가하세요</p>
        </div>
      )}

      <div className="text-sm font-semibold text-ink">접수 경로</div>
      {ROUTES.map((route) => (
        <div key={route.title} className="flex items-center gap-2.5 rounded-2xl border border-border px-4 py-3.5">
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink">{route.title}</div>
            <div className="mt-0.5 text-xs text-muted">{route.desc}</div>
          </div>
          <div className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${BADGE_STYLE[route.badge]}`}>
            {BADGE_LABEL[route.badge]}
          </div>
        </div>
      ))}

      <p className="mt-2 max-w-[320px] rounded-2xl bg-brand-subtle px-4 py-2.5 text-xs leading-relaxed text-brand">
        이 화면은 제출 자료를 정리하는 도구입니다. 지급정지 해제 여부는 은행 심사로 결정돼요.
      </p>
    </div>
  )
}
