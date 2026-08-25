import type { PDFDocument } from "pdf-lib"
import type { UploadedFile } from "../types"

/**
 * 제출 패키지 PDF 병합 (spec.md F7-06 · F8-01).
 *
 * **분담**: 텍스트 5종은 **서버가** PDF로 만들고(`POST /api/package/text`), **증빙별 원본
 * 이미지 페이지는 브라우저가** 자기 blob으로 만들어 여기서 병합한다. 원본 이미지는 서버에
 * 존재하지 않으므로(무저장 원칙) 서버가 만들 수 없다.
 *
 * **pdf-lib은 지연 로딩한다.** 내려받을 때만 필요한데 첫 화면 번들에 넣으면 진입 화면이
 * 그만큼 느려진다 — 대부분의 사용자는 마지막 단계까지 가기 전에 이 코드를 쓰지 않는다.
 *
 * **이미지 페이지에 글자를 넣지 않는다.** pdf-lib의 기본 폰트에는 한글이 없어서 캡션을
 * 넣으려면 한글 폰트를 번들에 실어야 하는데(수백 KB), 자료의 순서·설명은 서버가 만드는
 * 4면 증빙자료 목록이 이미 담고 있다. 같은 정보를 위해 폰트를 싣지 않는다.
 */

/** A4 세로 (pt). 서버가 만드는 텍스트 면과 같은 규격이어야 한 문서로 자연스럽다. */
const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 36

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]

/** 실제로 내려받을 때 한 번만 불러온다. */
async function loadPdfLib() {
  return (await import("pdf-lib")).PDFDocument
}

async function embed(pdf: PDFDocument, bytes: Uint8Array) {
  const isPng = PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)
  return isPng ? pdf.embedPng(bytes) : pdf.embedJpg(bytes)
}

/** blob URL에서 바이트를 읽는다. 원본은 브라우저 메모리에만 있다. */
async function readBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  return new Uint8Array(await response.arrayBuffer())
}

/**
 * 이미지 한 장당 A4 한 면. 여백 안에 들어가도록 비율을 유지해 줄이고, **확대하지 않는다**
 * — 작은 캡처를 늘리면 판독이 더 어려워진다.
 */
export async function buildImagePages(files: UploadedFile[]): Promise<PDFDocument> {
  const PDFDocument = await loadPdfLib()
  const pdf = await PDFDocument.create()

  for (const file of files) {
    const image = await embed(pdf, await readBytes(file.url))
    const page = pdf.addPage([A4.width, A4.height])

    const maxWidth = A4.width - MARGIN * 2
    const maxHeight = A4.height - MARGIN * 2
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
    const width = image.width * scale
    const height = image.height * scale

    page.drawImage(image, {
      x: (A4.width - width) / 2,
      y: (A4.height - height) / 2,
      width,
      height,
    })
  }

  return pdf
}

/**
 * 서버 PDF(텍스트 5종) 뒤에 이미지 페이지를 붙여 최종 패키지를 만든다.
 *
 * `serverPdf`가 `null`이면 이미지 페이지만으로 만든다 — 백엔드 `/api/package/text`가
 * 아직 없는 동안에도 프론트 몫이 동작하는지 확인할 수 있어야 한다.
 */
export async function buildPackagePdf(serverPdf: Blob | null, files: UploadedFile[]): Promise<Blob> {
  const PDFDocument = await loadPdfLib()
  const merged = await PDFDocument.create()

  if (serverPdf) {
    const source = await PDFDocument.load(new Uint8Array(await serverPdf.arrayBuffer()))
    const pages = await merged.copyPages(source, source.getPageIndices())
    for (const page of pages) merged.addPage(page)
  }

  if (files.length > 0) {
    const images = await buildImagePages(files)
    const pages = await merged.copyPages(images, images.getPageIndices())
    for (const page of pages) merged.addPage(page)
  }

  // 서버 PDF도 이미지도 없으면 빈 문서가 된다. 빈 PDF를 내려주면 사용자가 원인을 알 수 없다.
  if (merged.getPageCount() === 0) throw new Error("패키지에 넣을 내용이 없습니다")

  const bytes = await merged.save()
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" })
}

export function fileNameFor(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `이의제기패키지_${yyyy}${mm}${dd}.pdf`
}

/** 브라우저에 파일로 넘긴다. blob URL은 반드시 revoke한다 — 안 하면 탭이 닫힐 때까지 남는다. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
