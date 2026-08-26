import { TIER_SECTIONS } from "../data"
import type { ChecklistItem, ChecklistStatus, MissingEffect } from "../types"
import { Check } from "./icons"

interface ChecklistPanelProps {
  checklist: ChecklistItem[]
  selfHeld: ReadonlySet<string>
  onToggleSelfHeld: (id: string) => void
}

type Tone = "have" | "need" | "quiet"

/**
 * 상태 배지 (spec.md F7-03).
 *
 * **미보유에 붉은색을 쓰지 않는다.** 개인 중고거래자의 사업자등록증, 차용증 없는 대여처럼
 * **애초에 채울 수 없는 항목**이 섞여 있어서, 전부 경고로 칠하면 서비스가 사용자를 탓하는
 * 화면이 된다. 실제로 채울 수 있는 항목(`blocks`)에만 눈에 띄는 색을 준다.
 */
function tagFor(item: { status: ChecklistStatus; whenMissing: MissingEffect }): { label: string; tone: Tone } | null {
  if (item.status === "met") return { label: "보유", tone: "have" }
  // 불일치는 위험 신호가 아니라 소명서에서 설명할 항목이다 (TC-25).
  if (item.status === "needs_explanation") return { label: "설명 필요", tone: "quiet" }
  if (item.status === "unknown") return { label: "확인 불가", tone: "quiet" }
  if (item.whenMissing === "blocks") return { label: "필요", tone: "need" }
  if (item.whenMissing === "notice") return { label: "미보유", tone: "quiet" }
  return null
}

const TONE_CLASS: Record<Tone, string> = {
  have: "bg-success-subtle text-success",
  need: "bg-warning-subtle text-warning",
  quiet: "bg-surface text-muted",
}

function Tag({ tag }: { tag: { label: string; tone: Tone } | null }) {
  if (!tag) return null
  return (
    <div className={`flex-none rounded-md px-2 text-[11px] font-semibold leading-[22px] ${TONE_CLASS[tag.tone]}`}>
      {tag.label}
    </div>
  )
}

/**
 * 서비스에 올리지 않는 자료는 보유 여부를 알 방법이 없어 사용자가 직접 표시한다.
 *
 * **누를 때마다 글자가 바뀌는 버튼을 쓰지 않는다.** "있으면 눌러주세요" ↔ "가지고 있어요"처럼
 * 라벨이 갈리면 그 글자가 **지금 상태**인지 **누르면 될 일**인지 읽는 사람이 알 수 없다.
 * 라벨은 고정하고 체크 표시로 상태를 드러낸다.
 */
function SelfToggle({ held, onClick, label }: { held: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={held}
      onClick={onClick}
      className={`flex h-11 flex-none items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${
        held ? "border-success bg-success-subtle text-success" : "border-border text-muted"
      }`}
    >
      <span
        className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded border-[1.5px] text-[11px] font-bold ${
          held ? "border-success bg-success text-white" : "border-neutral text-transparent"
        }`}
      >
        <Check size={12} />
      </span>
      {label}
    </button>
  )
}

export function ChecklistPanel({ checklist, selfHeld, onToggleSelfHeld }: ChecklistPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      {TIER_SECTIONS.map((section) => {
        const items = checklist.filter((item) => item.tier === section.tier)
        if (items.length === 0) return null

        return (
          <div key={section.tier}>
            <div className="text-[15px] font-semibold tracking-tight">{section.title}</div>
            <p className="mt-1 mb-2.5 text-xs leading-normal text-muted">{section.desc}</p>

            <div className="overflow-hidden rounded-2xl border border-border">
              {items.map((item, i) => (
                <div key={item.id} className={i > 0 ? "border-t border-border" : ""}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1 text-[15px]">{item.label}</div>
                    {item.fulfillBy === "self" && !item.options ? (
                      <SelfToggle
                        held={selfHeld.has(item.id)}
                        onClick={() => onToggleSelfHeld(item.id)}
                        label="챙겼어요"
                      />
                    ) : (
                      <Tag tag={tagFor(item)} />
                    )}
                  </div>

                  {item.note && <p className="px-4 pb-3 text-xs leading-normal text-muted">{item.note}</p>}

                  {/* 같은 토글이라도 준비도를 바꾸는 항목과 본인 확인용 항목이 섞여 있다.
                      무엇이 걸려 있는지 말하지 않으면 왜 눌러야 하는지 알 수 없다. */}
                  {item.whenMissing === "blocks" && item.status !== "met" && (
                    <p className="px-4 pb-3 text-xs leading-normal text-warning">
                      {item.options ? "이 중 하나를 표시해야" : "이 항목을 표시해야"} 제출 준비 완료가 돼요.
                    </p>
                  )}

                  {/* 택일 그룹 — 하나만 충족되면 그룹 전체가 met이다. */}
                  {item.options && (
                    <div className="flex flex-col gap-2 px-4 pb-3.5">
                      {item.options.map((option) => (
                        <div key={option.id} className="flex items-center gap-3 rounded-xl bg-subtle px-3 py-2">
                          <div className="min-w-0 flex-1 text-[13px]">{option.label}</div>
                          {item.fulfillBy === "self" ? (
                            <SelfToggle
                              held={selfHeld.has(option.id)}
                              onClick={() => onToggleSelfHeld(option.id)}
                              label="챙겼어요"
                            />
                          ) : (
                            <Tag tag={tagFor({ status: option.status, whenMissing: "silent" })} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
