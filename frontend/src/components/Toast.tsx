interface ToastProps {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  if (!message) return null

  return (
    <div
      role="status"
      className="animate-toast-in pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-2xl bg-ink px-[18px] py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-lg"
    >
      {message}
    </div>
  )
}
