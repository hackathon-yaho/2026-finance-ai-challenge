interface BottomCtaProps {
  label: string
  disabled: boolean
  width: number
  onClick: () => void
}

export function BottomCta({ label, disabled, width, onClick }: BottomCtaProps) {
  const pad = width >= 640 ? 24 : 20

  return (
    <div className="fixed inset-x-0 bottom-0 z-[8] bg-gradient-to-t from-bg from-[62%] to-transparent pt-6 pb-5">
      <div className="mx-auto flex max-w-[720px]" style={{ padding: `0 ${pad}px` }}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="h-14 flex-1 rounded-2xl bg-brand text-[17px] font-bold tracking-tight text-white transition-opacity duration-200 disabled:pointer-events-none disabled:opacity-30"
        >
          {label}
        </button>
      </div>
    </div>
  )
}
