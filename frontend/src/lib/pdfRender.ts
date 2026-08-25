/**
 * PDF를 화면에 그린다 — **내려받을 파일 그대로**를 보여주기 위한 것이다.
 *
 * HTML 미리보기는 브라우저 폰트로 그리므로, 서버 컨테이너에 한글 폰트가 없어 PDF가 깨져도
 * 화면에서는 멀쩡하게 보인다(`spec.md` F8-01 개발 주의). **가장 흔한 PDF 사고를 미리보기가
 * 구조적으로 못 잡는다**는 뜻이라, 최종 확인은 실제 PDF를 렌더해서 한다.
 *
 * `<iframe src={blobUrl}>`을 쓰지 않은 이유: **iOS 사파리에서 blob PDF 렌더가 불안정**하다
 * (빈 화면이 되거나 다운로드로 튄다). NFR-05가 360px 모바일 대응을 요구하고 심사위원이
 * 폰으로 열 가능성이 있어 기본 경로로 삼을 수 없다.
 *
 * pdfjs는 **지연 로딩**한다. 마지막 단계에서만 쓰는 코드를 첫 화면 번들에 넣지 않는다.
 */

type RenderTarget = HTMLCanvasElement

let workerReady = false

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist")
  if (!workerReady) {
    // Vite가 워커를 별도 자산으로 빌드하도록 `?url`로 받는다.
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    workerReady = true
  }
  return pdfjs
}

export interface RenderedPage {
  pageNumber: number
  canvas: RenderTarget
}

/**
 * PDF의 모든 면을 캔버스로 그린다.
 *
 * `scale`은 CSS 폭 기준으로 계산해 넘긴다 — 고정 배율을 쓰면 좁은 화면에서 글자가 뭉갠다.
 * 디바이스 픽셀 비율을 곱해 레티나에서도 선명하게 둔다.
 */
export async function renderPdfToCanvases(data: Uint8Array, cssWidth: number): Promise<RenderedPage[]> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data }).promise
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const pages: RenderedPage[] = []

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr })

      const canvas = document.createElement("canvas")
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = "100%"
      canvas.style.height = "auto"

      const context = canvas.getContext("2d")
      if (!context) throw new Error("2d context unavailable")
      await page.render({ canvas, canvasContext: context, viewport }).promise
      page.cleanup()

      pages.push({ pageNumber, canvas })
    }
  } finally {
    // 문서를 붙들고 있으면 워커 메모리가 남는다. 캔버스는 이미 복사된 픽셀이라 무관하다.
    await doc.cleanup()
  }

  return pages
}
