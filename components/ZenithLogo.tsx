'use client'

interface ZenithMarkProps {
  size?:      number
  className?: string
}

export function ZenithMark({ size = 26, className }: ZenithMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Dark background — matches --surface-card */}
      <rect width="26" height="26" rx="5" fill="#14171c" />

      {/* Z — three strokes: top bar → diagonal → bottom bar */}
      <path
        d="M7,8 H19 L7,18 H19"
        stroke="#7c95ff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
