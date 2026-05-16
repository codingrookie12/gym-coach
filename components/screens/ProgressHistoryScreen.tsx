'use client'

import { useEffect, useMemo, useState } from 'react'
import WeightProgressChart from '@/components/charts/WeightProgressChart'
import WeeklyVolumeBar from '@/components/charts/WeeklyVolumeBar'
import FrequencyHeatmap from '@/components/charts/FrequencyHeatmap'
import type { HistoryProgress } from '@/lib/supabase.queries'

interface Props {
  onBack: () => void
}

function prettyWeekLabel(iso: string): string {
  // iso = YYYY-MM-DD; render as M/D
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10))
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()
}

export default function ProgressHistoryScreen({ onBack }: Props) {
  const [data, setData] = useState<HistoryProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [pickedExercise, setPickedExercise] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/history/progress')
      .then(r => r.json())
      .then((d: HistoryProgress) => {
        if (cancelled) return
        setData(d)
        setPickedExercise(d.exercises[0]?.name ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setData({ exercises: [], weeks: [], days: [] })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const lineChartData = useMemo(() => {
    if (!data || !pickedExercise) return []
    const ex = data.exercises.find(e => e.name === pickedExercise)
    if (!ex) return []
    // For the line chart: max weight per session (date)
    const byDate = new Map<string, number>()
    for (const s of ex.sets) {
      const cur = byDate.get(s.date) ?? 0
      if (s.weight > cur) byDate.set(s.date, s.weight)
    }
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, weight]) => ({ x: date, y: weight }))
  }, [data, pickedExercise])

  const weeksForChart = useMemo(() => {
    if (!data) return []
    return data.weeks.map(w => ({ label: prettyWeekLabel(w.label), volume: w.volume }))
  }, [data])

  const hasAnyData = (data?.exercises.length ?? 0) > 0 || (data?.days.length ?? 0) > 0

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="safe-top flex items-center gap-4 px-5"
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', padding: '4px' }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <span className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
            PROGRESS
          </span>
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: '20px' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && !hasAnyData && (
          <div className="card p-4" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-mid)', letterSpacing: '0.08em', margin: 0 }}>
              No sessions logged yet
            </p>
            <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', margin: '8px 0 0 0' }}>
              Complete a workout to see your progress
            </p>
          </div>
        )}

        {!loading && hasAnyData && data && (
          <>
            {/* Line chart section */}
            {data.exercises.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span className="section-label">WEIGHT PROGRESSION</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '8px' }}>
                  {data.exercises.map(ex => (
                    <button
                      key={ex.name}
                      onClick={() => setPickedExercise(ex.name)}
                      className="font-mono"
                      style={{
                        flexShrink: 0,
                        background: pickedExercise === ex.name ? 'var(--accent-dim)' : 'var(--surface-2)',
                        border: `1px solid ${pickedExercise === ex.name ? 'var(--accent-border)' : 'var(--border-2)'}`,
                        color: pickedExercise === ex.name ? 'var(--accent)' : 'var(--text-mid)',
                        borderRadius: '2px',
                        padding: '6px 10px',
                        fontSize: '0.6rem',
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ex.name}
                    </button>
                  ))}
                </div>
                <div className="card" style={{ padding: '12px' }}>
                  {lineChartData.length >= 2 ? (
                    <WeightProgressChart data={lineChartData} />
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                        Need at least 2 sessions to chart
                      </span>
                    </div>
                  )}
                  {lineChartData.length >= 2 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 4px' }}>
                      <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>
                        {prettyDate(lineChartData[0].x as string)}
                      </span>
                      <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>
                        {prettyDate(lineChartData[lineChartData.length - 1].x as string)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Weekly volume */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ marginBottom: '10px' }}>
                <span className="section-label">WEEKLY VOLUME — LAST 12 WEEKS</span>
              </div>
              <div className="card" style={{ padding: '12px' }}>
                <WeeklyVolumeBar weeks={weeksForChart} />
              </div>
            </div>

            {/* Frequency heatmap */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ marginBottom: '10px' }}>
                <span className="section-label">TRAINING FREQUENCY — LAST 90 DAYS</span>
              </div>
              <div className="card" style={{ padding: '12px' }}>
                <FrequencyHeatmap days={data.days} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
