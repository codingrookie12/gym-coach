'use client'

import Chart from '@/components/ui/Chart'
import type { ExerciseProgressionStrip as Data } from '@/lib/supabase.queries'

interface Props {
  data: Data | undefined
  targetWeight?: number | null
}

const pillStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  color: 'var(--text-mid)',
  background: 'var(--surface-2)',
  border: '1px solid var(--border-2)',
  borderRadius: '2px',
  padding: '3px 7px',
}

export default function ExerciseProgressionStrip({ data, targetWeight }: Props) {
  if (!data) return null
  const { pr, last3, chartPoints } = data
  if (!last3.length) return null

  const hasChart = chartPoints.length >= 2
  const showPr = pr !== null && pr.weight !== targetWeight
  const pillsOldestFirst = [...last3].reverse()

  return (
    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {showPr && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
            <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>PR</span>
            <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>
              {pr.weight} {pr.unit}
            </span>
            <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>
              · {pr.date}
            </span>
          </div>
          {hasChart && (
            <div style={{ width: '60px', height: '20px', flexShrink: 0, opacity: 0.85 }}>
              <Chart data={chartPoints} width={60} height={20} showAxis={false} yLabel={`${pr.weight} ${pr.unit} progression`} />
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
          {pillsOldestFirst.length === 1 ? 'LAST' : `LAST ${pillsOldestFirst.length}`}
        </span>
        {pillsOldestFirst.map((s, i) => (
          <span key={i} className="font-mono" style={pillStyle}>
            {s.weight}×{s.reps}
          </span>
        ))}
        {hasChart && !showPr && (
          <div style={{ width: '60px', height: '20px', flexShrink: 0, opacity: 0.85, marginLeft: 'auto' }}>
            <Chart data={chartPoints} width={60} height={20} showAxis={false} yLabel="weight progression" />
          </div>
        )}
      </div>
    </div>
  )
}
