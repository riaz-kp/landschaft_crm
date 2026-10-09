/** The company mark from logo.svg, as three stacked blocks. */
export function LogoMark({ className = 'h-8 w-8', color = '#C8B8A2' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="40 40 320 320" className={className} aria-hidden="true">
      <g transform="translate(-85,0)" fill={color}>
        <path d="M125 70 Q125 40 155 40 H245 Q275 40 275 70 V190 H125 Z" />
        <path d="M125 210 H275 V360 H155 Q125 360 125 330 V210 Z" />
        <path d="M295 210 H415 Q445 210 445 240 V330 Q445 360 415 360 H295 V210 Z" />
      </g>
    </svg>
  )
}

/** Mark plus the Landschaft wordmark, for dark backgrounds. */
export function LogoLockup({ sub = 'CRM' }: { sub?: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] ring-1 ring-white/10">
        <LogoMark className="h-6 w-6" />
      </span>
      <span>
        <span className="block font-display text-[15px] font-bold leading-tight tracking-tight text-white">Landschaft</span>
        <span className="block text-[10px] font-semibold uppercase leading-tight tracking-[0.2em] text-[#C8B8A2]">{sub}</span>
      </span>
    </span>
  )
}
