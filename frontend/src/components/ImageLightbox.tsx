import type { UploadedFile } from "../types"
import { Close } from "./icons"

interface ImageLightboxProps {
  file: UploadedFile | null
  width: number
  onClose: () => void
}

export function ImageLightbox({ file, width, onClose }: ImageLightboxProps) {
  if (!file) return null
  const wide = width >= 720

  return (
    <>
      <div onClick={onClose} className="animate-scrim-in fixed inset-0 z-30 cursor-pointer bg-black/56" />
      <div
        className={
          "animate-sheet-up fixed z-[31] flex flex-col bg-bg " +
          (wide
            ? "top-1/2 left-1/2 max-h-[88vh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[20px] shadow-2xl"
            : "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[20px] shadow-2xl")
        }
      >
        <div className="flex items-center gap-3 border-b border-border px-5 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold tracking-tight">{file.name}</div>
            <div className="mt-0.5 text-xs text-muted">{file.masked ? "마스킹 적용됨" : "원본 그대로 전송됨"}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-10 w-10 flex-none items-center justify-center text-muted">
            <Close size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <img src={file.url} alt={file.name} className="w-full rounded-2xl border border-border" />
          <div className="mt-4 text-xs leading-tight text-muted">이 원본은 브라우저 안에만 있어요. 서버에는 남지 않아요.</div>
        </div>
      </div>
    </>
  )
}
