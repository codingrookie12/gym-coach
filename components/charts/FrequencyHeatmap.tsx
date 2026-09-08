'use client'

interface Day {
  date: string // YYYY-MM-DD
  count: number
}

interface Props {
  days: Day[]
  width?: number
  height?: number
}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export default function FrequencyHeatmap({ days, width = 320, height = 120 }: Props) {
  if (!days.length) return null

  // Build a date -> count map. Render exactly 13 weeks ending today (so last column = current week).
  const countMap = new Map(days.map(d => [d.date, d.count]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Start: today - 90 days, then snap to Sunday so weeks align as columns
  const start = new Date(today)
  start.setDate(start.getDate() - 90)
  start.setDate(start.getDate() - start.getDay()) // snap back to Sunday

  const weeks: { date: Date; count: number }[][] = []
  const cursor = new Date(start)
  while (cursor <= today) {
    const week: { date: Date; count: number }[] = []
    for (let d = 0; d < 7; d++) {
      const iso = cursor.toISOString().slice(0, 10)
      week.push({ date: new Date(cursor), count: countMap.get(iso) ?? 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  const padL = 4
  const padR = 4
  const padT = 14 // room for month labels
  const padB = 4
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const cellW = innerW / weeks.length
  const cellH = innerH / 7
  const cellGap = 2

  const maxCount = Math.max(...days.map(d => d.count), 1)

  const opacityFor = (count: number) => {
    if (count === 0) return 0
    if (count >= maxCount) return 1
    return 0.25 + (count / maxCount) * 0.75
  }

  // Month labels: show month only at the first week column where that month starts
  const monthLabels: { x: number; label: string }[] = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const m = week[0].date.getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ x: padL + wi * cellW, label: MONTH_NAMES[m] })
      lastMonth = m
    }
  })

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Training frequency heatmap (last 90 days)">
      {monthLabels.map((ml, i) => (
        <text key={i} x={ml.x} y={10} fontSize="8" fontFamily="Space Mono, monospace" fill="var(--text-secondary)" letterSpacing="0.08em">
          {ml.label}
        </text>
      ))}
      {weeks.map((week, wi) =>
        week.map((cell, di) => {
          if (cell.date > today) return null
          const op = opacityFor(cell.count)
          const x = padL + wi * cellW + cellGap / 2
          const y = padT + di * cellH + cellGap / 2
          return (
            <rect
              key={`${wi}-${di}`}
              x={x}
              y={y}
              width={cellW - cellGap}
              height={cellH - cellGap}
              fill={op === 0 ? 'var(--surface-2)' : 'var(--accent)'}
              fillOpacity={op === 0 ? 1 : op}
              stroke="var(--border)"
              strokeWidth={0.5}
            />
          )
        })
      )}
    </svg>
  )
}
