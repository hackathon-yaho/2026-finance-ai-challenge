import type { MaskBox } from "../types"

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
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

export function exportMasked(canvas: HTMLCanvasElement, image: HTMLImageElement, boxes: MaskBox[], logicalSize: LogicalSize): string {
  paintImageWithBoxes(canvas, image, boxes, logicalSize, { draft: false })
  return canvas.toDataURL("image/png")
}

export function isInsideBox(box: MaskBox, x: number, y: number): boolean {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h
}
