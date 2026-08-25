import { useMemo, useState } from "react"
import { MAX_RAW_TEXT, TEXT_ENTRY_EXAMPLE, scrubPii } from "../lib/textEntry"

interface TextEntryPanelProps {
  /** 판독이 통째로 실패해 자동 전환된 경우인지 (F4-05). 문구가 달라진다. */
  fromFailure: boolean
  onSubmit: (text: string) => void
  onBack: () => void
}

/**
 * 텍스트 직접 입력 화면 (S02-1 · spec.md F3-04).
 *
 * 캡처가 없어도, 판독이 실패해도 여기서 진행할 수 있다. **자료가 없다고 막다른 길이 되면
 * 안 된다**는 것이 이 경로의 존재 이유다 (P-02·P-06).
 */
export function TextEntryPanel({ fromFailure, onSubmit, onBack }: TextEntryPanelProps) {
  const [text, setText] = useState("")
  const trimmed = text.trim()
  const tooShort = trimmed.length > 0 && trimmed.length < 10

  // 무엇이 가려지는지 **보내기 전에** 보여준다. 모르고 보내면 글이 왜 바뀌었는지 알 수 없다.
  const masked = useMemo(() => scrubPii(text).masked, [text])

  return (
    <div className="stagger flex flex-col gap-5">
      <div>
        <div className="text-[28px] leading-[1.3] font-bold tracking-tight">
          {fromFailure ? "글로 알려주세요" : "글로 직접 쓰기"}
        </div>
        <p className="mt-1.5 text-[15px] leading-normal text-muted">
          {fromFailure
            ? "올리신 자료를 읽지 못했어요. 기억나는 대로 적어주시면 그걸로 정리해드릴게요."
            : "캡처가 없어도 괜찮아요. 있었던 일을 순서대로 적어주시면 타임라인으로 정리해드려요."}
        </p>
      </div>

      <div className="rounded-2xl bg-surface p-4">
        <div className="text-[13px] font-semibold">이렇게 적으시면 돼요</div>
        <p className="mt-1.5 text-[13px] leading-normal text-muted">{TEXT_ENTRY_EXAMPLE}</p>
      </div>

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_RAW_TEXT))}
          rows={9}
          placeholder="언제, 무슨 거래였고, 얼마를 받았는지 적어주세요."
          className="w-full resize-none rounded-2xl border border-neutral bg-bg p-4 text-[15px] leading-relaxed"
        />
        <div className="mt-1.5 flex items-center gap-3">
          {tooShort && <span className="text-xs text-muted">조금만 더 적어주세요.</span>}
          <span className="ml-auto text-xs tabular-nums text-muted">
            {trimmed.length} / {MAX_RAW_TEXT}
          </span>
        </div>
      </div>

      {masked.length > 0 && (
        <p className="rounded-2xl bg-brand-subtle px-4 py-3.5 text-[13px] leading-normal">
          <b>{masked.join(" · ")}는 가리고 보낼게요.</b> 소명에 필요하지 않은 정보예요.
        </p>
      )}

      {/* 날짜를 지어내지 않는다는 것을 미리 알린다 — 나중에 "확인 필요"가 뜨는 이유이기도 하다. */}
      <p className="text-xs leading-normal text-muted">
        적어주신 시점은 "9월 1일쯤"처럼 그대로 남겨요. 말씀하지 않은 정확한 시각을 저희가 만들지
        않아요. 그래서 다음 화면에서 날짜를 한 번 확인해주셔야 해요.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-12 rounded-2xl border border-border bg-bg px-4 text-[15px] font-semibold text-ink"
        >
          자료 올리기로
        </button>
        <button
          type="button"
          onClick={() => onSubmit(trimmed)}
          disabled={trimmed.length < 10}
          className="h-12 flex-1 rounded-2xl bg-brand text-[17px] font-bold text-white transition-opacity duration-200 disabled:opacity-40"
        >
          이 내용으로 정리하기
        </button>
      </div>
    </div>
  )
}
