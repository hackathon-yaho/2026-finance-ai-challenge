import { useEffect, useMemo, useRef, useState } from "react"
import { exportMasked, getDevicePixelRatio, isInsideBox, loadImage, paintImageWithBoxes } from "../lib/mask"
import type { MaskBox } from "../types"

const dpr = getDevicePixelRatio()

interface MaskingSheetProps {
  fileName: string
  dataUrl: string
  width: number
  queueLabel: string | null
  mode?: "new" | "edit"
  onConfirm: (maskedDataUrl: string, addedMasking: boolean) => void
  onCancel: () => void
}

export function MaskingSheet({ fileName, dataUrl, width, queueLabel, mode = "new", onConfirm, onCancel }: MaskingSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const drawingRef = useRef<{ startX: number; startY: number } | null>(null)
  const [boxes, setBoxes] = useState<MaskBox[]>([])
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  const wide = width >= 720

  // Load the image once per mounted instance (the parent remounts this component via
  // `key` for each queued file).
  useEffect(() => {
    let cancelled = false
    loadImage(dataUrl).then((img) => {
      if (cancelled) return
      imageRef.current = img
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    })
    return () => {
      cancelled = true
    }
  }, [dataUrl])

  // Measure the actual space available for the image — via ResizeObserver rather than
  // hand-computed pixel budgets — so it reacts correctly to *anything* that changes how
  // much room is left (short viewports, landscape orientation, the confirm panel or an
  // extra line of instructions taking space, etc). This is what guarantees the whole
  // photo is always visible without being cropped.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const ready = naturalSize !== null && containerSize.w > 0 && containerSize.h > 0

  const size = useMemo(() => {
    if (!naturalSize || containerSize.w === 0 || containerSize.h === 0) {
      return { w: containerSize.w, h: containerSize.h }
    }
    const scale = Math.min(containerSize.w / naturalSize.w, containerSize.h / naturalSize.h, 1)
    return { w: Math.round(naturalSize.w * scale), h: Math.round(naturalSize.h * scale) }
  }, [naturalSize, containerSize])

  useEffect(() => {
    if (!ready || !canvasRef.current || !imageRef.current) return
    paintImageWithBoxes(canvasRef.current, imageRef.current, boxes, size, { draft: true })
  }, [ready, boxes, size])

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = pointerPos(e)
    const hitIndex = boxes.findIndex((b) => isInsideBox(b, x, y))
    if (hitIndex !== -1) {
      setBoxes((prev) => prev.filter((_, i) => i !== hitIndex))
      return
    }
    drawingRef.current = { startX: x, startY: y }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !imageRef.current) return
    const { x, y } = pointerPos(e)
    const { startX, startY } = drawingRef.current
    const draft: MaskBox = {
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      w: Math.abs(x - startX),
      h: Math.abs(y - startY),
    }
    paintImageWithBoxes(canvasRef.current!, imageRef.current, [...boxes, draft], size, { draft: true })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const { x, y } = pointerPos(e)
    const { startX, startY } = drawingRef.current
    drawingRef.current = null
    const box: MaskBox = {
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      w: Math.abs(x - startX),
      h: Math.abs(y - startY),
    }
    if (box.w > 8 && box.h > 8) {
      setBoxes((prev) => [...prev, box])
    }
  }

  const finish = () => {
    if (boxes.length === 0 && mode === "new") {
      setConfirmingSkip(true)
      return
    }
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    onConfirm(exportMasked(canvas, image, boxes, size), boxes.length > 0)
  }

  const confirmSkip = () => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    onConfirm(exportMasked(canvas, image, [], size), false)
  }

  return (
    <>
      <div className="animate-scrim-in fixed inset-0 z-30 bg-black/56" />
      <div
        className={
          "animate-sheet-up fixed z-[31] flex flex-col bg-bg " +
          (wide
            ? "top-1/2 left-1/2 h-[min(720px,90vh)] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[20px] shadow-2xl"
            : "inset-x-0 bottom-0 h-[92vh] rounded-t-[20px] shadow-2xl")
        }
      >
        <div className="flex flex-none items-center gap-3 border-b border-border px-5 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold tracking-tight">
              {mode === "edit" ? "더 가릴 부분이 있나요?" : "가릴 부분을 표시해주세요"}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted">
              {fileName}
              {queueLabel ? ` · ${queueLabel}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={mode === "edit" ? "편집 취소" : "업로드 취소"}
            className="flex h-10 w-10 flex-none items-center justify-center text-xl text-muted"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 p-5">
          <p className="flex-none text-center text-[13px] leading-normal text-muted">
            계좌번호 · 주민등록번호 · 전화번호 · 주소 · 관련 없는 제3자 이름 위를 드래그해서 가려주세요. 그려진 칸은
            "가리기 완료" 전까지 다시 눌러서 지울 수 있어요.
          </p>
          <p className="flex-none text-center text-[13px] font-semibold text-warning">
            "가리기 완료"를 누르면 가린 부분은 되돌릴 수 없어요.
          </p>

          <div
            ref={wrapperRef}
            className="relative min-h-[140px] w-full flex-1 overflow-hidden rounded-2xl border border-border bg-surface"
          >
            {!ready && <div className="flex h-full w-full items-center justify-center text-[13px] text-muted">불러오는 중…</div>}
            <canvas
              ref={canvasRef}
              width={size.w * dpr}
              height={size.h * dpr}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 touch-none"
              style={{ width: size.w, height: size.h, display: ready ? "block" : "none" }}
            />
          </div>

          {boxes.length > 0 && <div className="flex-none text-xs font-semibold text-brand">{boxes.length}곳을 가렸어요</div>}

          {confirmingSkip && (
            <div className="animate-drop-in w-full flex-none rounded-2xl bg-danger-subtle p-4">
              <div className="text-[15px] font-semibold">가리지 않고 보내시겠어요?</div>
              <p className="mt-1 text-[13px] leading-normal text-muted">
                계좌번호 같은 정보가 그대로 담길 수 있어요. 그래도 원본을 그대로 사용할게요.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingSkip(false)}
                  className="h-11 flex-1 rounded-xl border border-border bg-bg text-[15px] font-semibold text-ink"
                >
                  다시 가리기
                </button>
                <button type="button" onClick={confirmSkip} className="h-11 flex-1 rounded-xl bg-danger text-[15px] font-semibold text-white">
                  그대로 보내기
                </button>
              </div>
            </div>
          )}
        </div>

        {!confirmingSkip && (
          <div className="flex flex-none items-center gap-3 border-t border-border px-5 py-4">
            {mode === "new" && (
              <button type="button" onClick={() => setConfirmingSkip(true)} className="text-[13px] font-semibold text-muted underline">
                가리지 않고 보내기
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={finish} className="h-12 rounded-2xl bg-brand px-6 text-[15px] font-bold text-white">
              {mode === "edit" && boxes.length === 0 ? "완료" : "가리기 완료"}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
