import { useEffect, useMemo, useRef, useState } from "react"
import { exportMaskedBlob, getDevicePixelRatio, isInsideBox, loadImage, paintImageWithBoxes } from "../lib/mask"
import { MAX_IMAGE_EDGE } from "../lib/upload"
import type { MaskBox } from "../types"

const dpr = getDevicePixelRatio()

interface MaskingSheetProps {
  fileName: string
  url: string
  width: number
  queueLabel: string | null
  mode?: "new" | "edit"
  onConfirm: (masked: Blob, addedMasking: boolean) => void
  onCancel: () => void
}

export function MaskingSheet({ fileName, url, width, queueLabel, mode = "new", onConfirm, onCancel }: MaskingSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const drawingRef = useRef<{ startX: number; startY: number } | null>(null)
  const [boxes, setBoxes] = useState<MaskBox[]>([])
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  /**
   * 저장(내보내기) 실패. **로드 실패와 구분한다** — 파일은 멀쩡한데 미리보기 크기가 아직
   * 측정되지 않았을 뿐인 경우가 있고(느린 기기·백그라운드 탭), 그때 "이미지가 손상됐다"고
   * 말하면 사용자가 멀쩡한 자료를 버리고 다시 찍으러 간다.
   */
  const [exportFailed, setExportFailed] = useState(false)
  const [exporting, setExporting] = useState(false)
  const wide = width >= 720

  // Load the image once per mounted instance (the parent remounts this component via
  // `key` for each queued file).
  useEffect(() => {
    let cancelled = false
    loadImage(url)
      .then((img) => {
        if (cancelled) return
        imageRef.current = img
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
      })
      .catch(() => {
        // 시그니처 검증을 통과했어도 파일이 깨져 있을 수 있다. 안내 없이 두면
        // "불러오는 중…"에서 영구히 멈춘 것처럼 보인다.
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [url])

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

  // 표시용 캔버스가 아니라 원본에서 다시 그린다 — 내보내기 해상도가 보는 사람의
  // 화면 크기와 DPR에 좌우되면 안 된다 (lib/mask.ts 주석 참고).
  const exportWith = async (applied: MaskBox[]) => {
    const image = imageRef.current
    // 크기가 측정되기 전에 내보내면 마스킹 박스의 배율이 무한대가 되어 가린 영역이
    // 조용히 사라진다 (lib/mask.ts가 그래서 거부한다). 측정될 때까지 아예 시도하지 않는다.
    if (!image || !ready || exporting) return
    setExporting(true)
    setExportFailed(false)
    try {
      const blob = await exportMaskedBlob(image, applied, size, MAX_IMAGE_EDGE)
      onConfirm(blob, applied.length > 0)
    } catch {
      setExporting(false)
      setExportFailed(true)
    }
  }

  const finish = () => {
    if (!ready) return
    if (boxes.length === 0 && mode === "new") {
      setConfirmingSkip(true)
      return
    }
    void exportWith(boxes)
  }

  const confirmSkip = () => {
    void exportWith([])
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
          {/* F3-06 — 위 안내와 같은 크기로 병기한다. 각주로 줄이면 읽히지 않고, 사용자가 "제3자 이름"을
              거래 상대방까지로 넓게 읽으면 구매자–송금인 대조(reason-type-rules.md §2-1)가 통째로 헛돈다.
              가려진 이름은 null로 나가고 대조할 값이 없어진다. */}
          <p className="flex-none rounded-xl bg-brand-subtle px-3.5 py-2.5 text-center text-[13px] leading-normal text-ink">
            <span className="font-semibold">거래 상대방·입금자 이름은 가리지 마세요.</span> 은행이 "구매자와 송금인이 같은
            사람인지" 확인하는 데 쓰여요.
          </p>
          <p className="flex-none text-center text-[13px] font-semibold text-warning">
            "가리기 완료"를 누르면 가린 부분은 되돌릴 수 없어요.
          </p>

          <div
            ref={wrapperRef}
            className="relative min-h-[140px] w-full flex-1 overflow-hidden rounded-2xl border border-border bg-surface"
          >
            {loadFailed ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="text-[15px] font-semibold">이 파일은 열 수 없어요</div>
                <p className="text-[13px] leading-normal text-muted">
                  이미지가 손상됐거나 지원하지 않는 형식이에요. 다른 파일로 다시 시도해주세요.
                </p>
                <button
                  type="button"
                  onClick={onCancel}
                  className="h-11 rounded-xl border border-border px-5 text-[15px] font-semibold text-ink"
                >
                  이 파일 건너뛰기
                </button>
              </div>
            ) : (
              !ready && <div className="flex h-full w-full items-center justify-center text-[13px] text-muted">불러오는 중…</div>
            )}
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
                <button
                  type="button"
                  onClick={confirmSkip}
                  disabled={!ready || exporting}
                  className="h-11 flex-1 rounded-xl bg-danger text-[15px] font-semibold text-white transition-opacity duration-200 disabled:opacity-40"
                >
                  {exporting ? "저장하는 중…" : "그대로 보내기"}
                </button>
              </div>
            </div>
          )}
        </div>

        {exportFailed && (
          <p className="flex-none px-5 pb-2 text-[13px] leading-normal text-warning">
            지금은 저장하지 못했어요. 파일은 그대로 있으니 잠시 뒤 다시 눌러주세요.
          </p>
        )}

        {!confirmingSkip && !loadFailed && (
          <div className="flex flex-none items-center gap-3 border-t border-border px-5 py-4">
            {mode === "new" && (
              <button type="button" onClick={() => setConfirmingSkip(true)} className="text-[13px] font-semibold text-muted underline">
                가리지 않고 보내기
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={finish}
              disabled={!ready || exporting}
              className="h-12 rounded-2xl bg-brand px-6 text-[15px] font-bold text-white transition-opacity duration-200 disabled:opacity-40"
            >
              {exporting ? "저장하는 중…" : mode === "edit" && boxes.length === 0 ? "완료" : "가리기 완료"}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
