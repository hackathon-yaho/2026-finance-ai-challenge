interface TypewriterValueProps {
  text: string
  delayMs?: number
  stepMs?: number
}

export function TypewriterValue({ text, delayMs = 0, stepMs = 35 }: TypewriterValueProps) {
  return (
    <span aria-label={text}>
      {Array.from(text).map((char, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="inline-block animate-char-in opacity-0"
          style={{ animationDelay: `${delayMs + i * stepMs}ms` }}
        >
          {char}
        </span>
      ))}
    </span>
  )
}
