'use client'

import { useEffect, useMemo, useState } from 'react'
import WeightProgressChart from '@/components/charts/WeightProgressChart'
import { ALL_EXERCISES } from '@/lib/exerciseLibrary'
import type { ExerciseDefinition } from '@/lib/exerciseLibrary'
import { MUSCLE_GROUPS, TARGET_SETS, muscleToGroup, type MuscleGroup } from '@/lib/muscleGroups'
import type { HistoryProgress } from '@/lib/supabase.queries'

interface Props {
  onBack: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10))
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(iso: string): string {
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10))
  const then = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - then.getTime()) / 86400000)
  if (diff === 0) return 'TODAY'
  if (diff === 1) return 'YESTERDAY'
  if (diff < 7) return `${diff}D AGO`
  if (diff < 28) return `${Math.floor(diff / 7)}W AGO`
  return prettyDate(iso)
}

// Lookup table: exercise name → its definition (for muscle + split info)
const EXERCISE_BY_NAME: Map<string, ExerciseDefinition> = new Map(
  ALL_EXERCISES.map(e => [e.name, e])
)

// ─── Aggregations ──────────────────────────────────────────────────────────────

interface ExerciseAggregate {
  name: string
  exercise: ExerciseDefinition | null
  group: MuscleGroup | null
  sessions: { date: string; topWeight: number; topReps: number; sets: number; unit: string }[]
  pr: number // top weight ever
  lastTrained: string // ISO
  deltaLbs: number // weight change vs the session ~30 days earlier
}

function aggregateExercises(progress: HistoryProgress): ExerciseAggregate[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = isoDay(new Date(today.getTime() - 30 * 86400000))

  const out: ExerciseAggregate[] = []
  for (const ex of progress.exercises) {
    const def = EXERCISE_BY_NAME.get(ex.name) ?? null
    const group = def?.primaryMuscles[0] ? muscleToGroup(def.primaryMuscles[0]) : null

    // group sets by date → top weight that day
    const byDate = new Map<string, { topWeight: number; topReps: number; sets: number; unit: string }>()
    for (const s of ex.sets) {
      const cur = byDate.get(s.date)
      if (!cur || s.weight > cur.topWeight) {
        byDate.set(s.date, {
          topWeight: s.weight,
          topReps: cur && cur.topWeight === s.weight && cur.topReps > s.reps ? cur.topReps : s.reps,
          sets: (cur?.sets ?? 0) + 1,
          unit: s.unit,
        })
      } else {
        cur.sets += 1
      }
    }
    const sessions = Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))

    if (!sessions.length) continue

    const pr = Math.max(...sessions.map(s => s.topWeight))
    const lastTrained = sessions[sessions.length - 1].date
    const latest = sessions[sessions.length - 1].topWeight
    const baseline = sessions.find(s => s.date >= thirtyDaysAgo)?.topWeight ?? sessions[0].topWeight
    const deltaLbs = latest - baseline

    out.push({ name: ex.name, exercise: def, group, sessions, pr, lastTrained, deltaLbs })
  }

  // Most recent first
  return out.sort((a, b) => (a.lastTrained < b.lastTrained ? 1 : -1))
}

interface GroupAggregate {
  group: MuscleGroup
  sessionCount: number // unique workout days that hit this muscle in the last 30 days
  setsThisWeek: number
  best: { exerciseName: string; deltaLbs: number } | null // strongest positive delta among exercises in this group
}

function aggregateGroups(byExercise: ExerciseAggregate[]): GroupAggregate[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = isoDay(new Date(today.getTime() - 30 * 86400000))
  const sevenDaysAgo = isoDay(new Date(today.getTime() - 6 * 86400000))

  return MUSCLE_GROUPS.map(group => {
    const exercisesInGroup = byExercise.filter(e => e.group === group)
    const datesHit = new Set<string>()
    let setsThisWeek = 0
    let best: GroupAggregate['best'] = null

    for (const ex of exercisesInGroup) {
      for (const s of ex.sessions) {
        if (s.date >= thirtyDaysAgo) datesHit.add(s.date)
        if (s.date >= sevenDaysAgo) setsThisWeek += s.sets
      }
      if (ex.deltaLbs > 0 && (!best || ex.deltaLbs > best.deltaLbs)) {
        best = { exerciseName: ex.name, deltaLbs: ex.deltaLbs }
      }
    }
    return { group, sessionCount: datesHit.size, setsThisWeek, best }
  })
}

// Derive a workout's split label from the exercises trained that day.
type SplitColor = 'push' | 'pull' | 'legs' | 'mixed' | 'rest'

function splitForDay(date: string, exercises: ExerciseAggregate[]): SplitColor {
  const exHit = exercises.filter(e => e.sessions.some(s => s.date === date))
  if (!exHit.length) return 'rest'
  const counts: Record<string, number> = {}
  for (const e of exHit) {
    const s = e.exercise?.split
    if (s) counts[s] = (counts[s] ?? 0) + 1
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (!top) return 'mixed'
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (top[1] / total >= 0.6) {
    return top[0].toLowerCase() as SplitColor
  }
  return 'mixed'
}

const SPLIT_COLOR: Record<SplitColor, { bg: string; border: string }> = {
  push: { bg: 'var(--accent)', border: 'var(--accent)' },
  pull: { bg: 'var(--accent-dim)', border: 'var(--accent-border)' },
  legs: { bg: 'rgba(232, 99, 58, 0.18)', border: 'var(--rust-border)' },
  mixed: { bg: 'var(--surface-2)', border: 'var(--border)' },
  rest: { bg: 'transparent', border: 'var(--border)' },
}

// ─── Components ────────────────────────────────────────────────────────────────

function StreakHero({ trainedOf7, streak, dots }: { trainedOf7: number; streak: number; dots: SplitColor[] }) {
  const weekdayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  // Re-anchor weekday letters to match the dots (oldest → today)
  const today = new Date()
  const startDow = (today.getDay() + 7 - 6) % 7 // dow of 6 days ago
  const letters = Array.from({ length: 7 }, (_, i) => {
    // standard JS getDay(): 0=Sun…6=Sat. Convert to Mon-first display.
    const dow = (startDow + i) % 7
    const monFirst = (dow + 6) % 7
    return weekdayLetters[monFirst]
  })

  return (
    <div style={{ padding: '4px 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
        <span className="font-display" style={{ fontSize: '2.4rem', color: 'var(--accent)', letterSpacing: '0.04em', lineHeight: 0.9 }}>
          {trainedOf7}<span style={{ color: 'var(--text-secondary)', fontSize: '1.4rem' }}>/7</span>
        </span>
        <div style={{ flex: 1 }} />
        {streak >= 2 && (
          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--rust)', letterSpacing: '0.1em' }}>
            🔥 {streak}-DAY STREAK
          </span>
        )}
      </div>
      <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', marginBottom: '8px' }}>
        DAYS TRAINED · LAST 7
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {dots.map((c, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '100%',
                height: '34px',
                background: SPLIT_COLOR[c].bg,
                border: `1px solid ${SPLIT_COLOR[c].border}`,
                borderRadius: '2px',
                position: 'relative',
              }}
            >
              {i === dots.length - 1 && (
                <div style={{ position: 'absolute', inset: '-2px', border: '1px solid var(--text-primary)', borderRadius: '3px', pointerEvents: 'none' }} />
              )}
            </div>
            <span className="font-mono" style={{ fontSize: '0.5rem', color: i === dots.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)', letterSpacing: '0.06em' }}>
              {letters[i]}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
        <LegendDot color="push" label="PUSH" />
        <LegendDot color="pull" label="PULL" />
        <LegendDot color="legs" label="LEGS" />
        <LegendDot color="mixed" label="MIXED" />
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: SplitColor; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{ width: '8px', height: '8px', background: SPLIT_COLOR[color].bg, border: `1px solid ${SPLIT_COLOR[color].border}`, borderRadius: '1px' }} />
      <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>{label}</span>
    </div>
  )
}

function BalanceRow({ group, setsThisWeek }: { group: MuscleGroup; setsThisWeek: number }) {
  const [lo, hi] = TARGET_SETS[group]
  // Bar geometry: scale to hi * 1.3 so a slightly over-target still fits
  const scaleMax = hi * 1.3
  const pct = Math.min(100, (setsThisWeek / scaleMax) * 100)
  const loPct = (lo / scaleMax) * 100
  const hiPct = (hi / scaleMax) * 100

  const zone: 'under' | 'in' | 'over' =
    setsThisWeek < lo ? 'under' : setsThisWeek <= hi ? 'in' : 'over'
  const barColor =
    zone === 'in' ? 'var(--accent)' : zone === 'under' ? 'var(--text-mid)' : 'var(--rust)'
  const labelColor =
    zone === 'in' ? 'var(--accent)' : zone === 'under' ? 'var(--text-mid)' : 'var(--rust)'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 56px', alignItems: 'center', gap: '12px' }}>
      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
        {group.toUpperCase()}
      </span>
      <div style={{ position: 'relative', height: '18px', background: 'var(--surface-2)', borderRadius: '2px', overflow: 'hidden' }}>
        {/* Target range band */}
        <div
          style={{
            position: 'absolute',
            top: 0, bottom: 0,
            left: `${loPct}%`, width: `${hiPct - loPct}%`,
            background: 'rgba(212, 241, 58, 0.08)',
            borderLeft: '1px dashed var(--accent-border)',
            borderRight: '1px dashed var(--accent-border)',
          }}
        />
        {/* Actual bar */}
        <div
          style={{
            position: 'absolute',
            top: '3px', bottom: '3px',
            left: '2px',
            width: `calc(${pct}% - 4px)`,
            background: barColor,
            borderRadius: '1px',
            minWidth: setsThisWeek > 0 ? '3px' : '0',
            transition: 'width 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
      <span className="font-mono" style={{ fontSize: '0.7rem', color: labelColor, letterSpacing: '0.04em', textAlign: 'right' }}>
        {setsThisWeek}
      </span>
    </div>
  )
}

function GroupTile({
  group,
  agg,
  active,
  onTap,
}: {
  group: MuscleGroup
  agg: GroupAggregate
  active: boolean
  onTap: () => void
}) {
  const hasData = agg.sessionCount > 0
  return (
    <button
      onClick={onTap}
      style={{
        background: active ? 'var(--accent-dim)' : 'var(--surface)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: '2px',
        padding: '12px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: '8px',
        minHeight: '88px',
        transition: 'border-color 0.1s, background 0.1s',
      }}
    >
      <span className="font-display" style={{ fontSize: '1.05rem', color: active ? 'var(--accent)' : 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
        {group.toUpperCase()}
      </span>
      {hasData ? (
        <>
          <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            {agg.sessionCount} SESSION{agg.sessionCount !== 1 ? 'S' : ''} · 30D
          </span>
          {agg.best ? (
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--accent)', letterSpacing: '0.04em' }}>
              ↑ +{agg.best.deltaLbs} LBS
            </span>
          ) : (
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', letterSpacing: '0.04em' }}>
              — STEADY
            </span>
          )}
        </>
      ) : (
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          NOT TRAINED · 30D
        </span>
      )}
    </button>
  )
}

function ExerciseRow({
  ex,
  expanded,
  onTap,
}: {
  ex: ExerciseAggregate
  expanded: boolean
  onTap: () => void
}) {
  const latest = ex.sessions[ex.sessions.length - 1]
  const unit = latest?.unit ?? 'Lbs'
  const isPR = latest?.topWeight === ex.pr
  const chartData = ex.sessions.map(s => ({ x: s.date, y: s.topWeight }))
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onTap}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '12px 0',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-body" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.2, marginBottom: '4px' }}>
            {ex.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
              {daysAgo(ex.lastTrained)}
            </span>
            {isPR && <span className="tag accent" style={{ fontSize: '0.5rem' }}>PR</span>}
            {!isPR && ex.deltaLbs > 0 && (
              <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.05em' }}>
                ↑ +{ex.deltaLbs}
              </span>
            )}
            {ex.deltaLbs < 0 && (
              <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--rust)', letterSpacing: '0.05em' }}>
                ↓ {ex.deltaLbs}
              </span>
            )}
          </div>
        </div>
        {/* Inline sparkline */}
        {chartData.length >= 2 && (
          <div style={{ width: '70px', height: '24px', flexShrink: 0 }}>
            <WeightProgressChart data={chartData} width={70} height={24} showAxis={false} />
          </div>
        )}
        {/* Current weight */}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '64px' }}>
          <div className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', letterSpacing: '0.02em', lineHeight: 1 }}>
            {latest?.topWeight}
          </div>
          <div className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginTop: '2px' }}>
            {unit.toUpperCase()} · PR {ex.pr}
          </div>
        </div>
        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-mid)', transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>
          ›
        </span>
      </button>
      {expanded && chartData.length >= 2 && (
        <div style={{ padding: '6px 0 18px' }}>
          <WeightProgressChart data={chartData} height={140} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)' }}>
              {prettyDate(chartData[0].x as string)}
            </span>
            <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)' }}>
              {prettyDate(chartData[chartData.length - 1].x as string)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ProgressHistoryScreen({ onBack }: Props) {
  const [data, setData] = useState<HistoryProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<MuscleGroup | null>(null)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/history/progress')
      .then(r => r.json())
      .then((d: HistoryProgress) => {
        if (cancelled) return
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setData({ exercises: [], days: [] })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const exerciseAggs = useMemo(() => (data ? aggregateExercises(data) : []), [data])
  const groupAggs = useMemo(() => aggregateGroups(exerciseAggs), [exerciseAggs])

  // Default-select the muscle group with the most recent activity so the screen lands on content
  useEffect(() => {
    if (!exerciseAggs.length || activeGroup) return
    const firstWithGroup = exerciseAggs.find(e => e.group)
    if (firstWithGroup?.group) setActiveGroup(firstWithGroup.group)
  }, [exerciseAggs, activeGroup])

  const exercisesInGroup = useMemo(
    () => exerciseAggs.filter(e => e.group === activeGroup),
    [exerciseAggs, activeGroup]
  )

  // Streak hero data
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dotColors: SplitColor[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    dotColors.push(splitForDay(isoDay(d), exerciseAggs))
  }
  const trainedOf7 = dotColors.filter(c => c !== 'rest').length
  // Streak
  let streak = 0
  const cur = new Date(today)
  if (splitForDay(isoDay(cur), exerciseAggs) === 'rest') cur.setDate(cur.getDate() - 1)
  while (splitForDay(isoDay(cur), exerciseAggs) !== 'rest') {
    streak++
    cur.setDate(cur.getDate() - 1)
    if (streak > 60) break
  }

  const hasAnyData = exerciseAggs.length > 0

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

      <div className="scroll-area" style={{ flex: 1, padding: '20px 20px 32px' }}>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && !hasAnyData && (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-secondary)', letterSpacing: '0.04em', margin: 0 }}>
              NO SESSIONS YET
            </p>
            <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', letterSpacing: '0.08em', margin: '12px 0 0 0' }}>
              Complete a workout to start tracking
            </p>
          </div>
        )}

        {!loading && hasAnyData && (
          <>
            {/* 1. TRAINING RHYTHM */}
            <section style={{ marginBottom: '36px' }}>
              <StreakHero trainedOf7={trainedOf7} streak={streak} dots={dotColors} />
            </section>

            {/* 2. MUSCLE BALANCE */}
            <section style={{ marginBottom: '36px' }}>
              <div style={{ marginBottom: '14px' }}>
                <span className="section-label">MUSCLE BALANCE · THIS WEEK</span>
                <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-mid)', letterSpacing: '0.08em', marginTop: '4px' }}>
                  Working sets per muscle vs. weekly target band
                </div>
              </div>
              <div className="card" style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {MUSCLE_GROUPS.map(g => {
                  const agg = groupAggs.find(a => a.group === g)!
                  return <BalanceRow key={g} group={g} setsThisWeek={agg.setsThisWeek} />
                })}
              </div>
            </section>

            {/* 3. PROGRESSION — muscle group drill-down */}
            <section>
              <div style={{ marginBottom: '14px' }}>
                <span className="section-label">PROGRESSION · BY MUSCLE</span>
                <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-mid)', letterSpacing: '0.08em', marginTop: '4px' }}>
                  Tap a muscle to see exercises and trend lines
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                {MUSCLE_GROUPS.map(g => {
                  const agg = groupAggs.find(a => a.group === g)!
                  return (
                    <GroupTile
                      key={g}
                      group={g}
                      agg={agg}
                      active={activeGroup === g}
                      onTap={() => { setActiveGroup(g); setExpandedExercise(null) }}
                    />
                  )
                })}
              </div>

              {activeGroup && (
                <div className="card" style={{ padding: '0 16px' }}>
                  {exercisesInGroup.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center' }}>
                      <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                        No {activeGroup.toLowerCase()} sessions in last 90 days
                      </span>
                    </div>
                  ) : (
                    exercisesInGroup.map(ex => (
                      <ExerciseRow
                        key={ex.name}
                        ex={ex}
                        expanded={expandedExercise === ex.name}
                        onTap={() => setExpandedExercise(expandedExercise === ex.name ? null : ex.name)}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
