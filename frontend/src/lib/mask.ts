import type { MaskBox } from "../types"

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export interface LogicalSize {
  w: number
  h: number
}

export function getDevicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
}

/**
 * Preview painter — on-screen only. Export goes through `exportMaskedBlob`.
 *
 * Draws in logical (CSS) pixels regardless of the canvas's actual backing-store
 * resolution. The canvas's `width`/`height` attributes should be set to
 * `logicalSize * devicePixelRatio` while its CSS size stays at `logicalSize` —
 * otherwise the browser upscales a 1x buffer to fill a high-DPI screen and the
 * image reads as blurry/pixelated on phones.
 */
export function paintImageWithBoxes(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  boxes: MaskBox[],
  logicalSize: LogicalSize,
  opts: { draft?: boolean } = {},
) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const dpr = getDevicePixelRatio()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, logicalSize.w, logicalSize.h)
  ctx.drawImage(image, 0, 0, logicalSize.w, logicalSize.h)

  for (const box of boxes) {
    ctx.fillStyle = opts.draft ? "rgba(15, 15, 20, 0.88)" : "rgb(15, 15, 20)"
    ctx.fillRect(box.x, box.y, box.w, box.h)
    if (opts.draft) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)"
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.strokeRect(box.x, box.y, box.w, box.h)
      ctx.setLineDash([])
    }
  }
}

/**
 * Size the outgoing image: cap the long edge at `maxEdge`, never upscale.
 * Mirrors spec F3-01 step (1) — client-side resize to a 1600px long edge.
 */
export function exportSizeFor(image: HTMLImageElement, maxEdge: number): LogicalSize {
  const w = image.naturalWidth
  const h = image.naturalHeight
  const scale = Math.min(maxEdge / Math.max(w, h), 1)
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

/**
 * Bakes the masks into a fresh image at export resolution and hands back a Blob.
 *
 * The on-screen canvas is sized to *fit the masking sheet*, so exporting it directly
 * would make the outgoing resolution a function of the viewer's screen and DPR — a
 * desktop user on a 1x monitor would ship a ~200px-wide image to the reader. Instead
 * this redraws from the original `image` at `exportSizeFor()` and scales the boxes,
 * which live in the sheet's logical coordinate space, into that space.
 *
 * The masks are destructive here by design: F3-06 requires that a masked region cannot
 * be recovered, so the unmasked original never leaves this function.
 */
export function exportMaskedBlob(
  image: HTMLImageElement,
  boxes: MaskBox[],
  logicalSize: LogicalSize,
  maxEdge: number,
): Promise<Blob> {
  if (logicalSize.w <= 0 || logicalSize.h <= 0) {
    // Would make the box scale non-finite and silently drop every mask — refuse rather
    // than ship an image whose redactions quietly vanished.
    return Promise.reject(new Error("cannot export before the preview has been measured"))
  }

  const out = exportSizeFor(image, maxEdge)
  const canvas = document.createElement("canvas")
  canvas.width = out.w
  canvas.height = out.h

  const ctx = canvas.getContext("2d")
  if (!ctx) return Promise.reject(new Error("2d context unavailable"))

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(image, 0, 0, out.w, out.h)

  const sx = out.w / logicalSize.w
  const sy = out.h / logicalSize.h
  ctx.fillStyle = "rgb(15, 15, 20)"
  for (const box of boxes) {
    ctx.fillRect(box.x * sx, box.y * sy, box.w * sx, box.h * sy)
  }

  return new Promise((resolve, reject) => {
    // PNG rather than JPEG: these are text-heavy screenshots, and JPEG ringing around
    // glyphs costs the reader (F4-01) more than the extra bytes do.
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))), "image/png")
  })
}

export function isInsideBox(box: MaskBox, x: number, y: number): boolean {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h
}
