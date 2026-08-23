import { useRef, useState } from "react"
import type { UploadedFile } from "../types"

interface UploadPanelProps {
  uploadedFiles: UploadedFile[]
  maxUploads: number
  uploadsLeft: number
  onSelectFiles: (files: FileList) => void
  onRemoveFile: (id: string) => void
  onPreviewFile: (id: string) => void
  onEditFile: (id: string) => void
  onContinue: () => void
}

export function UploadPanel({
  uploadedFiles,
  maxUploads,
  uploadsLeft,
  onSelectFiles,
  onRemoveFile,
  onPreviewFile,
  onEditFile,
  onContinue,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const full = uploadsLeft === 0

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (!full && e.dataTransfer.files.length > 0) onSelectFiles(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[28px] leading-[1.3] font-bold tracking-tight">자료를 올려주세요</div>
        <p className="mt-1.5 text-[15px] leading-normal text-muted">
          대화·입금 내역·송장 캡처를 올리면 정리해드려요. 계좌번호 같은 정보는 올리기 전에 가릴 수 있어요.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!full) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !full && inputRef.current?.click()}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ${
          full ? "cursor-not-allowed border-border bg-subtle opacity-60" : "cursor-pointer"
        } ${dragOver ? "border-brand bg-brand-subtle" : full ? "" : "border-neutral bg-subtle"}`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-2xl text-brand">＋</div>
        <div className="text-[15px] font-semibold">
          {full ? `${maxUploads}장을 모두 채웠어요` : "여기로 끌어다 놓거나 눌러서 선택하세요"}
        </div>
        <div className="text-xs text-muted">
          {full ? "더 올리려면 아래에서 자료를 지워주세요" : `JPG, PNG · ${uploadsLeft}장 더 올릴 수 있어요 (최대 ${maxUploads}장)`}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          disabled={full}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onSelectFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {uploadedFiles.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border">
          {uploadedFiles.map((file, i) => (
            <div key={file.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <button
                type="button"
                onClick={() => onPreviewFile(file.id)}
                className="h-12 w-12 flex-none overflow-hidden rounded-lg border border-border bg-surface"
              >
                <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{file.name}</div>
                <div className={`mt-0.5 text-xs ${file.masked ? "text-brand" : "text-muted"}`}>
                  {file.masked ? "마스킹 적용됨" : "원본 그대로 전송됨"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onEditFile(file.id)}
                className="flex-none rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink"
              >
                더 가리기
              </button>
              <button type="button" onClick={() => onRemoveFile(file.id)} className="flex-none px-1 text-xl text-muted" aria-label="삭제">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button type="button" onClick={onContinue} className="h-14 flex-1 rounded-2xl bg-brand text-[17px] font-bold text-white">
          {uploadedFiles.length > 0 ? "이 자료로 계속하기" : "자료 없이 계속하기"}
        </button>
      </div>
      <p className="text-xs leading-normal text-muted">자료가 없어도 문진 응답만으로 진행할 수 있어요.</p>
    </div>
  )
}
