import { useEffect, useRef, useState } from "react"
import { renderPdfToCanvases } from "../lib/pdfRender"

interface PdfPreviewProps {
  /** 내려받게 될 파일 그대로. 미리보기와 산출물이 같은 바이트여야 의미가 있다. */
  build: () => Promise<Blob>
  /** 서버가 만드는 텍스트 면이 아직 없으면 그 사실을 알린다 — 빈 곳을 사용자가 오해하지 않도록. */
  textPagesPending: boolean
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; pages: HTMLCanvasElement[] }
  | { kind: "failed"; message: string }

export function PdfPreview({ build, textPagesPending }: PdfPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<State>({ kind: "loading" })

  // `build`는 호출부에서 useCallback으로 고정하고, 보기를 전환하면 이 컴포넌트가
  // 통째로 마운트·언마운트된다. 그래서 여기서 loading으로 되돌릴 필요가 없다.
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const blob = await build()
        const bytes = new Uint8Array(await blob.arrayBuffer())
        // 렌더 폭은 실제 표시 폭에 맞춘다. 고정 배율이면 좁은 화면에서 글자가 뭉갠다.
        const width = hostRef.current?.clientWidth ?? 560
        const rendered = await renderPdfToCanvases(bytes, width)
        if (cancelled) return
        setState({ kind: "ready", pages: rendered.map((page) => page.canvas) })
      } catch (error) {
        if (cancelled) return
        setState({
          kind: "failed",
          message: error instanceof Error ? error.message : "문서를 그리지 못했어요",
        })
      }
    }
    void run()

    return () => {
      cancelled = true
    }
  }, [build])

  useEffect(() => {
    const host = hostRef.current
    if (!host || state.kind !== "ready") return
    host.replaceChildren(...state.pages)
  }, [state])

  return (
    <div className="flex flex-col gap-3">
      {textPagesPending && (
        <p className="rounded-2xl bg-surface px-4 py-3.5 text-[13px] leading-normal text-muted">
          지금은 <b>증빙 원본 이미지 면</b>만 보여요. 신청서·진술서·타임라인·증빙목록은 서버에서
          만들어져 이 앞에 붙어요.
        </p>
      )}

      {state.kind === "loading" && (
        <div className="rounded-2xl border border-dashed border-neutral px-5 py-10 text-center text-[15px] text-muted">
          문서를 그리는 중이에요…
        </div>
      )}

      {state.kind === "failed" && (
        <div className="rounded-2xl bg-warning-subtle px-4 py-3.5 text-[13px] leading-normal text-warning">
          문서를 그리지 못했어요. 정리된 화면으로 확인하고 내려받으셔도 돼요. ({state.message})
        </div>
      )}

      {/* 캔버스는 DOM으로 직접 넣는다 — React가 다시 그리면 렌더한 픽셀이 날아간다. */}
      <div ref={hostRef} className="flex flex-col gap-3 [&>canvas]:rounded-xl [&>canvas]:border [&>canvas]:border-border" />
    </div>
  )
}
