interface ToastProps {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  if (!message) return null

  return (
    <div
      role="status"
      className="animate-toast-in fixed bottom-[104px] left-1/2 z-40 -translate-x-1/2 rounded-2xl bg-ink px-[18px] py-3 text-[15px] font-semibold whitespace-nowrap text-white shadow-lg"
    >
      {message}
    </div>
  )
}
