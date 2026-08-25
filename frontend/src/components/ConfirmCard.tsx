import { useState } from "react"
import { isBlocking } from "../lib/cards"
import { formatDot } from "../lib/date"
import type { CardEdits, Confidence, ExtractedCard, SourceType, ViewerId } from "../types"

interface ConfirmCardProps {
  card: ExtractedCard
  onConfirm: (eventId: string) => void
  onEdit: (eventId: string, patch: CardEdits) => void
  onRemove: (eventId: string) => void
  onOpenViewer: (id: ViewerId) => void
}

const SOURCE_LABEL: Record<SourceType, string> = {
  chat: "대화",
  bank: "입출금",
  shipping: "배송",
  threat: "협박",
  autopay: "자동이체",
  // 추측하지 않고 내린 정상 값이다. 오류처럼 보이게 하지 않는다.
  unknown: "미분류",
  // 백엔드가 문진 응답으로 만든 카드다. "판독했다"고 읽히면 안 된다.
  intake: "직접 답한 내용",
}

/** autopay는 별도 뷰어가 없어 계좌 화면을 쓴다. */
const VIEWER: Record<SourceType, ViewerId> = {
  chat: "chat",
  bank: "bank",
  autopay: "bank",
  shipping: "shipping",
  threat: "threat",
  unknown: "chat",
  // 볼 원본이 없다. `[원본 보기]` 자체를 숨기므로 이 값은 쓰이지 않는다.
  intake: "chat",
}

/**
 * 신뢰도 배지는 **높음 / 확인 필요** 두 값으로만 렌더한다 (api-contract).
 * `medium`을 따로 표시하면 사용자가 판단할 것이 하나 더 늘 뿐이다.
 */
function confidenceLabel(level: Confidence): { text: string; low: boolean } {
  return level === "high" ? { text: "높음", low: false } : { text: "확인 필요", low: true }
}

function formatAmount(value: number | null): string {
  return value === null ? "미상" : `${value.toLocaleString("ko-KR")}원`
}

/**
 * **없는 시각을 만들어 보여주지 않는다.**
 *
 * 텍스트 직접 입력(F3-04)은 날짜만 있고 시각이 없는 값을 만든다 — 사용자가 "9월 1일쯤"
 * 이라고만 했기 때문이다. 이걸 `new Date()`에 통째로 넣으면 자정으로 해석돼 화면에
 * "09:00"이 찍힌다(UTC 자정의 KST 표기). 사용자가 말하지 않은 시각이 문서 만드는 화면에
 * 나타나는 것이라 F3-04의 수용 기준을 정면으로 어긴다.
 */
function formatWhen(value: string | null): string {
  if (!value) return "미상"
  const day = formatDot(value.slice(0, 10))
  // 날짜만 있는 값(YYYY-MM-DD)은 날짜만 보여준다.
  if (!value.includes("T")) return day
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${day} ${hh}:${mm}`
}

interface FieldRowProps {
  label: string
  value: string
  /** 값이 null이면 신뢰도를 읽지 않는다 — 의미 없는 값이다 (계약의 해석 규칙). */
  confidence: Confidence | null
  hasValue: boolean
  /**
   * 카드를 확인·수정한 뒤에는 신뢰도 배지를 감춘다. 신뢰도는 **AI가 얼마나 확신하며 읽었나**인데,
   * 사용자가 방금 그 값을 보고 확인했으면 더 이상 사용자에게 물을 것이 없다. 그대로 두면
   * 본인이 직접 고쳐 넣은 값 옆에 "확인 필요"가 붙어 무엇을 더 해야 하는지 모르게 된다.
   */
  settled: boolean
  onEdit?: () => void
}

function FieldRow({ label, value, confidence, hasValue, settled, onEdit }: FieldRowProps) {
  const badge = !settled && hasValue && confidence ? confidenceLabel(confidence) : null

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-[68px] flex-none text-[13px] text-muted">{label}</div>
      <div className={`min-w-0 flex-1 text-[15px] tabular-nums ${hasValue ? "" : "text-muted"}`}>{value}</div>
      {badge && (
        <div
          className={`flex-none rounded-md px-2 text-[11px] font-semibold leading-[22px] ${
            badge.low ? "bg-warning-subtle text-warning" : "bg-surface text-muted"
          }`}
        >
          {badge.text}
        </div>
      )}
      {onEdit && (
        <button type="button" onClick={onEdit} className="h-11 w-11 flex-none text-[13px] font-semibold text-brand underline">
          고치기
        </button>
      )}
    </div>
  )
}

export function ConfirmCard({ card, onConfirm, onEdit, onRemove, onOpenViewer }: ConfirmCardProps) {
  const [editing, setEditing] = useState<keyof CardEdits | null>(null)
  const [buffer, setBuffer] = useState("")

  const confirmed = card.confirmation_status !== "pending"
  const corrected = card.confirmation_status === "user_corrected"
  const blocking = isBlocking(card)

  const startEdit = (field: keyof CardEdits, current: string) => {
    setEditing(field)
    setBuffer(current)
  }

  const commit = () => {
    if (!editing) return
    const raw = buffer.trim()
    if (editing === "amount") {
      const digits = raw.replace(/[^\d]/g, "")
      // 비우면 "미상"으로 되돌린다. 확인 불가한 값을 임의로 채우지 않는다.
      onEdit(card.event_id, { amount: digits === "" ? null : Number(digits) })
    } else if (editing === "occurred_at") {
      onEdit(card.event_id, { occurred_at: raw === "" ? null : raw })
    } else {
      onEdit(card.event_id, { [editing]: raw === "" ? null : raw })
    }
    setEditing(null)
  }

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors duration-200 ${
        blocking ? "border-warning bg-warning-subtle" : confirmed ? "border-brand-subtle bg-brand-subtle" : "border-border bg-bg"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex-none rounded-md bg-surface px-2 text-[11px] font-semibold leading-[22px] text-muted">
              {SOURCE_LABEL[card.source_type]}
            </div>
            {confirmed && (
              <div className="flex-none rounded-md bg-success-subtle px-2 text-[11px] font-semibold leading-[22px] text-success">
                {corrected ? "사용자 수정" : "확인 완료"}
              </div>
            )}
          </div>
          <div className="mt-1.5 text-[15px] leading-normal font-semibold tracking-tight">{card.summary}</div>
        </div>
      </div>

      <div className="mt-2 divide-y divide-border">
        <FieldRow
          label="일시"
          value={editing === "occurred_at" ? "" : formatWhen(card.occurred_at)}
          confidence={card.field_confidence.occurred_at}
          hasValue={card.occurred_at !== null}
          settled={confirmed}
          onEdit={() => startEdit("occurred_at", card.occurred_at ?? "")}
        />
        {(card.amount !== null || card.source_type === "bank") && (
          <FieldRow
            label="금액"
            value={formatAmount(card.amount)}
            confidence={card.field_confidence.amount}
            hasValue={card.amount !== null}
            settled={confirmed}
            onEdit={() => startEdit("amount", card.amount === null ? "" : String(card.amount))}
          />
        )}
        {/* 이름 2종은 별도 행으로 나눈다. "상대방" 한 칸이면 사용자가 무엇을 고치는지 모른다. */}
        {(card.counterparty_name !== null || card.source_type === "chat") && (
          <FieldRow
            label="대화 상대"
            value={card.counterparty_name ?? "비어 있음"}
            confidence={card.field_confidence.counterparty_name}
            hasValue={card.counterparty_name !== null}
            settled={confirmed}
            onEdit={() => startEdit("counterparty_name", card.counterparty_name ?? "")}
          />
        )}
        {(card.payer_name !== null || card.source_type === "bank") && (
          <FieldRow
            label="입금자"
            value={card.payer_name ?? "비어 있음"}
            confidence={card.field_confidence.payer_name}
            hasValue={card.payer_name !== null}
            settled={confirmed}
            onEdit={() => startEdit("payer_name", card.payer_name ?? "")}
          />
        )}
        {card.identifiers.tracking_no === "MASKED" && (
          <FieldRow label="운송장" value="있음 (번호는 읽지 않았어요)" confidence={null} hasValue={false} settled={confirmed} />
        )}
      </div>

      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={buffer}
            inputMode={editing === "amount" ? "numeric" : "text"}
            onChange={(e) => setBuffer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") setEditing(null)
            }}
            placeholder={editing === "occurred_at" ? "2026-09-01T14:12:00+09:00" : "비우면 미상으로 둬요"}
            className="h-11 min-w-0 flex-1 rounded-xl border border-neutral bg-bg px-3 text-[15px]"
          />
          <button type="button" onClick={commit} className="h-11 flex-none rounded-xl bg-ink px-4 text-[15px] font-semibold text-white">
            저장
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="h-11 flex-none rounded-xl border border-border px-3 text-[15px] text-muted"
          >
            취소
          </button>
        </div>
      )}

      {blocking && (
        <p className="mt-2.5 text-xs leading-normal text-warning">
          판독 신뢰도가 낮아요. 이 카드를 확인해야 다음 단계로 갈 수 있어요.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* 텍스트로 쓴 카드는 볼 원본이 없다(`source_image_index === null`). 버튼을 두면
            눌렀을 때 갈 곳이 없고, 있지도 않은 자료가 있는 것처럼 보인다. */}
        {card.source_image_index !== null && (
          <button
            type="button"
            onClick={() => onOpenViewer(VIEWER[card.source_type])}
            className="h-11 rounded-xl border border-border bg-bg px-4 text-[15px] font-semibold text-ink"
          >
            원본 보기
          </button>
        )}
        {!confirmed && (
          <button
            type="button"
            onClick={() => onConfirm(card.event_id)}
            className="h-11 rounded-xl bg-ink px-4 text-[15px] font-semibold text-white"
          >
            맞아요
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(card.event_id)}
          className="ml-auto h-11 px-2 text-[13px] font-semibold text-muted underline"
        >
          이 자료 빼기
        </button>
      </div>
    </div>
  )
}
