'use client'

export interface ChartPoint {
  x: string | number
  y: number
}

interface ChartProps {
  data: ChartPoint[]
  width?: number
  height?: number
  stroke?: string
  showAxis?: boolean
  yLabel?: string
}

/**
 * components/ui/Chart — Phase 1: formalized from components/charts/
 * WeightProgressChart.tsx into the components/ui/ primitive library.
 * Kept intentionally hand-rolled SVG (no charting library dependency) —
 * matches the app's existing minimal-dependency posture and there's
 * nothing on `main` today that would justify pulling one in.
 *
 * Despite the generic name this is still a single line-chart primitive
 * (name kept `Chart` rather than `LineChart` because it's the only chart
 * shape this app needs through Phase 4 — see coachingVisuals.ts's
 * comment for why coaching annotations render as badges/icons on top of
 * this, not as additional chart types).
 */
export default function Chart({
  data,
  width = 320,
  height = 160,
  stroke = 'var(--accent)',
  showAxis = true,
  yLabel,
}: ChartProps) {
  if (data.length < 2) return null

  const padL = showAxis ? 28 : 4
  const padR = 8
  const padT = 8
  const padB = showAxis ? 20 : 4
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  const ys = data.map(d => d.y)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const yRange = yMax - yMin || 1
  // Add 10% headroom so the line doesn't kiss the top/bottom
  const yLo = yMin - yRange * 0.1
  const yHi = yMax + yRange * 0.1
  const yScale = (y: number) => padT + innerH - ((y - yLo) / (yHi - yLo)) * innerH
  const xScale = (i: number) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.y)}`).join(' ')

  // Y axis: 3 ticks (low, mid, high) using actual data range
  const ticks = showAxis ? [yMin, (yMin + yMax) / 2, yMax] : []

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={yLabel ?? 'Progress chart'}>
      {showAxis && ticks.map((t, i) => {
        const y = yScale(t)
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3" />
            <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="9" fontFamily="Space Mono, monospace" fill="var(--text-secondary)">
              {Math.round(t)}
            </text>
          </g>
        )
      })}
      <polyline fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" points={points} />
      {data.map((d, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(d.y)} r={2.5} fill={stroke} />
      ))}
    </svg>
  )
}
