/**
 * 아이콘.
 *
 * **글리프(`‹` `✕` `✓` `＋` `▾`)를 쓰지 않는다.** 폰트마다 굵기·중심·크기가 달라 같은
 * `font-size`를 줘도 자리마다 다르게 앉고, 한글 폰트가 이 문자들을 다 갖고 있지도 않다.
 * 실제로 접기 아이콘(`▾`)이 카드 제목 옆에서 무겁게 튀는 것부터 드러났다.
 *
 * 규칙 세 가지만 지킨다.
 * - **`currentColor`** — 색은 부모의 `text-*`가 정한다. 아이콘이 자기 색을 갖지 않는다
 * - **끝을 둥글린 얇은 선** — 선 굵기는 크기에 비례해 준다(기본 1.7 @ 20px)
 * - **`aria-hidden`** — 의미는 옆의 글자나 버튼의 `aria-label`이 지고, 아이콘은 장식이다
 */

interface IconProps {
  /** 정사각 픽셀 크기. 선 굵기가 여기 비례한다. */
  size?: number
  className?: string
}

function stroke(size: number) {
  // 20px에서 1.7. 작아질수록 가늘어지면 흐려 보이므로 하한을 둔다.
  return Math.max(1.5, (size / 20) * 1.7)
}

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={{ flex: "none" }}
    >
      <g stroke="currentColor" strokeWidth={stroke(size)} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  )
}

/** 뒤로 · 이전 달 */
export function ChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.25 5.75 8.25 10l4 4.25" />
    </Svg>
  )
}

/** 다음 달 */
export function ChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.75 5.75 11.75 10l-4 4.25" />
    </Svg>
  )
}

/** 접기·펼치기. 펼친 상태는 부모가 `rotate-180`으로 뒤집는다. */
export function ChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.75 8.25 10 12.25l4.25-4" />
    </Svg>
  )
}

/** 닫기 */
export function Close(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </Svg>
  )
}

/** 체크 — 완료·보유 표시 */
export function Check(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.75 10.5 8.25 14l7-8" />
    </Svg>
  )
}

/** 자료 추가 */
export function Plus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 4.75v10.5M4.75 10h10.5" />
    </Svg>
  )
}
