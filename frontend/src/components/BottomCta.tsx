interface BottomCtaProps {
  label: string
  disabled: boolean
  onClick: () => void
}

export function BottomCta({ label, disabled, onClick }: BottomCtaProps) {
  return (
    <div className="relative z-2 flex-none bg-gradient-to-t from-white from-60% to-transparent px-5 pt-3.5 pb-5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="h-14 w-full rounded-2xl bg-brand text-lg font-bold text-white disabled:pointer-events-none disabled:opacity-30"
      >
        {label}
      </button>
    </div>
  )
}
