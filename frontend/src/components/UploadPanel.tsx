import { useRef, useState } from "react"
import { EvidenceGuide } from "./EvidenceGuide"
import type { UploadedFile } from "../types"
import { Close, Plus } from "./icons"

interface UploadPanelProps {
  /** 문진의 거래 성격. 사유별 업로드 안내(F3-07)의 입력이다. */
  kind: string | null
  uploadedFiles: UploadedFile[]
  maxUploads: number
  uploadsLeft: number
  onSelectFiles: (files: FileList) => void
  onRemoveFile: (id: string) => void
  onPreviewFile: (id: string) => void
  onEditFile: (id: string) => void
  /** F3-04 진입점. 캡처가 없는 사용자가 여기서 빠져나간다. */
  onOpenTextEntry: () => void
}

export function UploadPanel({
  kind,
  uploadedFiles,
  maxUploads,
  uploadsLeft,
  onSelectFiles,
  onRemoveFile,
  onPreviewFile,
  onEditFile,
  onOpenTextEntry,
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
    <div className="stagger flex flex-col gap-5">
      <div>
        <div className="text-[28px] leading-[1.3] font-bold tracking-tight">자료를 올려주세요</div>
        <p className="mt-1.5 text-[15px] leading-normal text-muted">
          대화·입금 내역·송장 캡처를 올리면 정리해드려요. 계좌번호 같은 정보는 올리기 전에 가릴 수 있어요.
        </p>
      </div>

      {/* F3-07 — 빈 업로드 박스만 두지 않는다. 사유별 목록을 파일 선택 영역 **위**에 둔다. */}
      <EvidenceGuide kind={kind} />

      {/* spec.md F10-03 — 진입 화면에서 본 보존 지침을 사용자는 여기까지 오면 기억하지 못한다.
          자료를 모으는 이 순간이 실제로 지워지는 시점이라 한 번 더 노출한다. 이미 지운
          사용자를 위한 복구 경로도 함께 둔다 (F5-04 대체 증빙의 앞단). */}
      <div className="rounded-2xl bg-surface p-4">
        <div className="text-[15px] font-semibold">가진 자료를 지우지 마세요</div>
        <p className="mt-1 text-[13px] leading-normal text-muted">
          정리가 끝날 때까지 대화방을 나가거나 메시지를 지우지 마세요. 남은 기록이 그대로 소명 근거가 돼요.
        </p>
        <div className="mt-3 text-[13px] font-semibold">이미 지웠다면 여기를 찾아보세요</div>
        <ul className="mt-1 flex flex-col gap-1 text-[13px] leading-normal text-muted">
          <li>· 메신저 — 대화 백업 기능으로 복원되는 경우가 있어요</li>
          <li>· 중고거래 앱 — 앱 안의 거래 내역에서 다시 캡처할 수 있어요</li>
          <li>· 문자 — 통신사 문자 보관함에 남아 있을 수 있어요</li>
          <li>· 은행 앱 — 입출금 내역은 언제든 다시 캡처할 수 있어요</li>
        </ul>
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
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <Plus size={24} />
        </div>
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
              <button type="button" onClick={() => onRemoveFile(file.id)} className="flex flex-none items-center justify-center px-1 text-muted" aria-label="삭제">
                <Close size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 다음으로 넘어가는 버튼은 하단 고정 CTA가 맡는다 (App). 같은 일을 하는 버튼을 둘 두면
          어느 쪽이 진짜인지 알 수 없고, 하단 CTA가 비활성으로 남아 막힌 화면처럼 보인다. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-normal text-muted">
        <span>캡처가 없으신가요?</span>
        <button type="button" onClick={onOpenTextEntry} className="-my-2 h-11 font-semibold text-brand underline">
          글로 직접 쓰기
        </button>
        <span>· 자료가 없어도 문진 응답만으로 진행할 수 있어요.</span>
      </div>

      {/**
       * 예시 자료 내려받기.
       *
       * 기능명세서 §5가 심사위원에게 "샘플 이미지 업로드"를 시키면서 **그 샘플을 어디서
       * 구하는지는 안 알려줬다.** 배포 URL만 받은 사람은 올릴 것이 없어 [자료 없이
       * 계속하기]로 빠지고, 판독·타임라인·소명서가 통째로 안 보인다.
       *
       * **본문이 아니라 꼬리에 둔다.** 실제 사용자에게는 필요 없는 링크라 업로드 동선을
       * 가리면 안 된다. "합성 이미지"를 문구에 박아, 자기 자료를 올리러 온 사람이 이걸
       * 올려야 하는 줄 알고 헷갈리지 않게 한다.
       *
       * `download` 속성은 같은 출처에서만 동작한다 — 파일을 `public/`에 두는 이유다.
       * URL은 ASCII로 두고(한글 경로는 서버·브라우저마다 인코딩이 갈린다) 내려받는
       * 이름만 한글로 준다.
       */}
      <a
        href="/samples/haebing-sample-evidence.zip"
        download="해빙-예시자료.zip"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-normal text-muted"
      >
        <span>어떻게 정리되는지 먼저 보고 싶으세요?</span>
        <span className="font-semibold text-brand underline">예시 자료 내려받기</span>
        <span>· 실제 인물·계좌가 아닌 합성 이미지예요 (1.2MB)</span>
      </a>
    </div>
  )
}
