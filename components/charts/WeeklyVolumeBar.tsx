'use client'

interface Week {
  label: string
  volume: number
}

interface Props {
  weeks: Week[]
  width?: number
  height?: number
}

export default function WeeklyVolumeBar({ weeks, width = 320, height = 140 }: Props) {
  if (!weeks.length) return null

  const padL = 28
  const padR = 8
  const padT = 8
  const padB = 22
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  const max = Math.max(...weeks.map(w => w.volume), 1)
  const barW = innerW / weeks.length
  const gap = Math.min(4, barW * 0.2)

  // 3 horizontal grid lines at 0, 50%, 100%
  const ticks = [0, max / 2, max]

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Weekly volume bar chart">
      {ticks.map((t, i) => {
        const y = padT + innerH - (t / max) * innerH
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3" />
            <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="9" fontFamily="Space Mono, monospace" fill="var(--text-secondary)">
              {t >= 1000 ? `${Math.round(t / 100) / 10}k` : Math.round(t)}
            </text>
          </g>
        )
      })}
      {weeks.map((w, i) => {
        const h = w.volume === 0 ? 0 : Math.max(2, (w.volume / max) * innerH)
        const x = padL + i * barW + gap / 2
        const y = padT + innerH - h
        const isLast = i === weeks.length - 1
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW - gap}
              height={h}
              fill={isLast ? 'var(--accent)' : 'var(--accent-dim)'}
              stroke={isLast ? 'var(--accent)' : 'var(--accent-border)'}
              strokeWidth={1}
            />
          </g>
        )
      })}
      {/* X axis: first, mid, last labels only — avoids clutter */}
      {[0, Math.floor(weeks.length / 2), weeks.length - 1].map(i => {
        if (i < 0 || i >= weeks.length) return null
        const x = padL + i * barW + barW / 2
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="9" fontFamily="Space Mono, monospace" fill="var(--text-secondary)">
            {weeks[i].label}
          </text>
        )
      })}
    </svg>
  )
}
