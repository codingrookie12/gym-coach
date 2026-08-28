'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Chart from '@/components/ui/Chart'
import FrequencyHeatmap from '@/components/charts/FrequencyHeatmap'
import WeeklyVolumeBar from '@/components/charts/WeeklyVolumeBar'
import { MUSCLE_GROUPS, TARGET_SETS, type MuscleGroup } from '@/lib/muscleGroups'
import type { HistoryProgress, ExerciseMuscleMeta } from '@/lib/supabase.queries'
import { fetchExerciseMuscleMetaByIds } from '@/lib/supabase.queries'
import {
  aggregateExercises,
  aggregateGroups,
  aggregateWeeklyVolume,
  splitForDay,
  isoDay,
  type ExerciseAggregate,
  type SplitColor,
} from '@/lib/progressAggregation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { loadCoachingPlan } from '@/lib/sessionPlan'
// '@/lib/coaching' (bare) resolves to the OLD lib/coaching.ts — explicit
// '/index' path required (bit Phase 3, see CoachingContextScreen.tsx).
import type { CoachingContext, CoachingFlag, MuscleVolumeStatus } from '@/lib/coaching/index'
import { useCoachingFlagText } from '@/lib/i18n/coachingMessages'
import { getFlagVisualTreatment, getProvenanceOpacity } from '@/components/ui/coachingVisuals'

interface Props {
  // Optional: omitted when this screen is the Reports tab's standalone
  // landing screen (no back arrow, matches the other tab-root screens).
  // Provided when reached via Library → History (an overlay with a real
  // back target) — Phase 4 keeps that entry point alive alongside the new
  // Reports tab placement, not removing a working nav path (see final
  // report's placement-decision note).
  onBack?: () => void
  userId?: string
  userProgramSplitId?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10))
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()
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
  const t = useTranslations('screens.progressHistory')
  const weekdayLetters = [t('weekdayMon'), t('weekdayTue'), t('weekdayWed'), t('weekdayThu'), t('weekdayFri'), t('weekdaySat'), t('weekdaySun')]
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
            🔥 {t('dayStreak', { count: streak })}
          </span>
        )}
      </div>
      <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-mid)', letterSpacing: '0.12em', marginBottom: '8px' }}>
        {t('streakLabel')}
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
        <LegendDot color="push" label={t('splitPush')} />
        <LegendDot color="pull" label={t('splitPull')} />
        <LegendDot color="legs" label={t('splitLegs')} />
        <LegendDot color="mixed" label={t('splitMixed')} />
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

function BalanceRow({
  group,
  groupLabel,
  setsThisWeek,
  engineStatus,
}: {
  group: MuscleGroup
  groupLabel: string
  setsThisWeek: number
  engineStatus?: MuscleVolumeStatus
}) {
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

  // Phase 2's real volume-landmark engine status (MEV/MAV/MRV, keyed by
  // experience level) for this group, when a coaching context loaded
  // successfully — an independent, more precise signal than the static
  // TARGET_SETS band above. Rendered as a small edge indicator using
  // components/ui/coachingVisuals.ts's KIND_VISUALS, the shared kind→visual
  // source of truth (Phase 4 scope item 2), not a bespoke color.
  const engineVisual =
    engineStatus?.zone === 'under-mev'
      ? getFlagVisualTreatment('volume-under-mev')
      : engineStatus?.zone === 'over-mrv'
        ? getFlagVisualTreatment('volume-over-mrv')
        : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(60px, auto) 1fr minmax(44px, auto)', alignItems: 'center', gap: '12px' }}>
      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-primary)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        {groupLabel}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
        {engineVisual && (
          <span
            title={engineStatus?.zone}
            style={{ fontSize: '0.6rem', color: `var(${engineVisual.colorToken})`, lineHeight: 1 }}
          >
            {engineStatus?.zone === 'under-mev' ? '▽' : '△'}
          </span>
        )}
        <span className="font-mono" style={{ fontSize: '0.7rem', color: labelColor, letterSpacing: '0.04em', textAlign: 'right' }}>
          {setsThisWeek}
        </span>
      </div>
    </div>
  )
}

function GroupTile({
  group,
  groupLabel,
  agg,
  active,
  onTap,
}: {
  group: MuscleGroup
  groupLabel: string
  agg: { sessionCount: number; best: { exerciseName: string; deltaLbs: number } | null }
  active: boolean
  onTap: () => void
}) {
  const t = useTranslations('screens.progressHistory')
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
        {groupLabel}
      </span>
      {hasData ? (
        <>
          <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            {t('sessionsCaption', { count: agg.sessionCount })}
          </span>
          {agg.best ? (
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--accent)', letterSpacing: '0.04em' }}>
              ↑ +{agg.best.deltaLbs} {t('lbsAbbrev')}
            </span>
          ) : (
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', letterSpacing: '0.04em' }}>
              {t('steady')}
            </span>
          )}
        </>
      ) : (
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          {t('notTrainedCaption')}
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
  const t = useTranslations('screens.progressHistory')
  const latest = ex.sessions[ex.sessions.length - 1]
  const unit = latest?.unit ?? 'Lbs'
  const isPR = latest?.topWeight === ex.pr
  const chartData = ex.sessions.map(s => ({ x: s.date, y: s.topWeight }))

  const daysAgoLabel = (() => {
    const [y, m, d] = ex.lastTrained.split('-').map(n => parseInt(n, 10))
    const then = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.round((today.getTime() - then.getTime()) / 86400000)
    if (diff === 0) return t('today')
    if (diff === 1) return t('yesterday')
    if (diff < 7) return t('daysAgoShort', { count: diff })
    if (diff < 28) return t('weeksAgoShort', { count: Math.floor(diff / 7) })
    return prettyDate(ex.lastTrained)
  })()

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onTap}
        style={{
          width: '100%',
          minHeight: '44px',
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
              {daysAgoLabel}
            </span>
            {isPR && <span className="tag accent" style={{ fontSize: '0.5rem' }}>{t('pr')}</span>}
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
            <Chart data={chartData} width={70} height={24} showAxis={false} />
          </div>
        )}
        {/* Current weight */}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '64px' }}>
          <div className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', letterSpacing: '0.02em', lineHeight: 1 }}>
            {latest?.topWeight}
          </div>
          <div className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginTop: '2px' }}>
            {unit.toUpperCase()} · {t('pr')} {ex.pr}
          </div>
        </div>
        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-mid)', transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>
          ›
        </span>
      </button>
      {expanded && chartData.length >= 2 && (
        <div style={{ padding: '6px 0 18px' }}>
          <Chart data={chartData} height={140} />
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

/** One coaching-signal row — mirrors CoachingContextScreen.tsx's FlagLine
 *  (plain-language primary + technical caption), reused here rather than
 *  re-deriving new flag-rendering logic, per Phase 4 scope item 2. */
function SignalLine({ flag }: { flag: CoachingFlag }) {
  const t = useTranslations('screens.progressHistory')
  const coachingT = useTranslations('coaching')
  const { technical, plain } = useCoachingFlagText(flag)
  const visual = getFlagVisualTreatment(flag.kind)
  const isInferred = flag.origin === 'inferred-rep-range'

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: `var(${visual.colorToken})`, fontSize: '0.75rem', lineHeight: 1.3, flexShrink: 0, marginTop: '1px' }}>
        {visual.severity === 'warning' ? '⚠' : visual.severity === 'watch' ? '●' : visual.severity === 'positive' ? '↑' : '·'}
      </span>
      <div style={{ flex: 1, minWidth: 0, opacity: isInferred ? getProvenanceOpacity('inferred-rep-range') : 1 }}>
        <p className="font-sans" style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
          {plain}
        </p>
        <p className="font-mono" style={{ fontSize: '0.56rem', color: 'var(--text-secondary)', margin: '3px 0 0 0', letterSpacing: '0.03em' }}>
          {t('technicalLabel')}: {technical}
          {isInferred && <span style={{ marginLeft: '6px', padding: '1px 5px', border: '1px dashed var(--border-2)', borderRadius: '2px' }}>~ {coachingT('provenanceInferred')}</span>}
        </p>
      </div>
    </div>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ProgressHistoryScreen({ onBack, userId, userProgramSplitId }: Props) {
  const t = useTranslations('screens.progressHistory')
  const coachingContextT = useTranslations('screens.coachingContext')
  const vocabMuscleGroups = useTranslations('vocab.muscleGroups')

  const [data, setData] = useState<HistoryProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<MuscleGroup | null>(null)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [exerciseMeta, setExerciseMeta] = useState<Map<string, ExerciseMuscleMeta>>(new Map())

  // Phase 4 scope item 2 — Phase 2's coaching engine, consumed (never
  // recomputed/reinterpreted) for the "current" CoachingContext. There is no
  // stored/queryable per-session annotation history yet (Phase 4 doesn't
  // build one — see final report), so this renders live/current flags only,
  // scoped to whichever split is currently active. Reuses the exact
  // loadCoachingPlan(supabase, userId, splitId) calling pattern
  // CoachingContextScreen.tsx already established in Phase 3.
  const [coachingContext, setCoachingContext] = useState<CoachingContext | null>(null)
  const [coachingLoaded, setCoachingLoaded] = useState(false)

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

  // GYM-92 fix: resolve muscle-group tags for every exercise_id in this
  // history by querying the DB directly (works uniformly for catalog AND
  // custom exercises) — see lib/progressAggregation.ts's docstring.
  useEffect(() => {
    if (!data) return
    const ids = Array.from(new Set(data.exercises.map(e => e.exerciseId).filter((id): id is string => !!id)))
    if (!ids.length) return
    let cancelled = false
    const supabase = createSupabaseBrowserClient()
    fetchExerciseMuscleMetaByIds(supabase, ids)
      .then(meta => {
        if (cancelled) return
        setExerciseMeta(new Map(Object.entries(meta)))
      })
      .catch(() => { /* muscle-group tagging is best-effort — screen still works without it */ })
    return () => { cancelled = true }
  }, [data])

  useEffect(() => {
    if (!userId || !userProgramSplitId) {
      setCoachingLoaded(true)
      return
    }
    let cancelled = false
    const supabase = createSupabaseBrowserClient()
    loadCoachingPlan(supabase, userId, userProgramSplitId)
      .then(({ context }) => {
        if (cancelled) return
        setCoachingContext(context)
        setCoachingLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setCoachingContext(null)
        setCoachingLoaded(true)
      })
    return () => { cancelled = true }
  }, [userId, userProgramSplitId])

  const exerciseAggs = useMemo(() => (data ? aggregateExercises(data, exerciseMeta) : []), [data, exerciseMeta])
  const groupAggs = useMemo(() => aggregateGroups(exerciseAggs), [exerciseAggs])
  const weeklyVolume = useMemo(() => (data ? aggregateWeeklyVolume(data, 10) : []), [data])

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

  const muscleVolumeByGroup = useMemo(() => {
    const m = new Map<string, MuscleVolumeStatus>()
    for (const status of coachingContext?.muscleVolume ?? []) m.set(status.muscleGroup, status)
    return m
  }, [coachingContext])

  const GROUP_LABEL: Record<MuscleGroup, string> = {
    Chest: vocabMuscleGroups('chest'),
    Back: vocabMuscleGroups('back'),
    Shoulders: vocabMuscleGroups('shoulders'),
    Arms: vocabMuscleGroups('arms'),
    Legs: vocabMuscleGroups('legs'),
    Core: vocabMuscleGroups('core'),
  }

  // Coaching signals shown only once the context has finished loading (or
  // failed to — never a stale spinner) so the screen doesn't imply signals
  // are still coming. Empty/near-empty state (Phase 4 scope item 2): fewer
  // than the engine's `established` threshold worth of sessions reads as
  // "still learning", reusing CoachingContextScreen's own tone/copy, rather
  // than silently showing zero flags (which would look identical to "all
  // clear" — a materially different message).
  const showCoachingPanel = coachingLoaded && !!coachingContext
  const dataMaturity = coachingContext?.dataMaturity ?? null

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="safe-top flex items-center gap-4 px-5"
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', padding: '4px', minWidth: '44px', minHeight: '44px' }}
          >
            ←
          </button>
        )}
        <div style={{ flex: 1 }}>
          <span className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
            {t('title')}
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
              {t('noSessionsYet')}
            </p>
            <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', letterSpacing: '0.08em', margin: '12px 0 0 0' }}>
              {t('emptyStateBody')}
            </p>
          </div>
        )}

        {!loading && hasAnyData && (
          <>
            {/* 0. COACHING SIGNALS — Phase 2's engine output, current context only */}
            {showCoachingPanel && (
              <section style={{ marginBottom: '36px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <span className="section-label">{t('coachingSignalsHeading')}</span>
                </div>
                {dataMaturity !== 'established' ? (
                  <div className="card" style={{ padding: '14px', border: '1px dashed var(--border-2)' }}>
                    <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', margin: 0, letterSpacing: '0.02em', lineHeight: 1.5 }}>
                      {dataMaturity === 'limited-history' ? coachingContextT('dataMaturityLimited') : coachingContextT('dataMaturityDeveloping')}
                    </p>
                  </div>
                ) : coachingContext && coachingContext.flags.length > 0 ? (
                  <div className="card" style={{ padding: '0 14px' }}>
                    {coachingContext.flags.map(flag => <SignalLine key={flag.id} flag={flag} />)}
                  </div>
                ) : null}
              </section>
            )}

            {/* 1. TRAINING RHYTHM */}
            <section style={{ marginBottom: '36px' }}>
              <StreakHero trainedOf7={trainedOf7} streak={streak} dots={dotColors} />
            </section>

            {/* 1b. TRAINING FREQUENCY — 90-day heatmap */}
            {data && data.days.length > 0 && (
              <section style={{ marginBottom: '36px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <span className="section-label">{t('frequencyHeading')}</span>
                </div>
                <div className="card" style={{ padding: '14px' }}>
                  <FrequencyHeatmap days={data.days} height={110} />
                </div>
              </section>
            )}

            {/* 2. MUSCLE BALANCE */}
            <section style={{ marginBottom: '36px' }}>
              <div style={{ marginBottom: '14px' }}>
                <span className="section-label">{t('muscleBalanceHeading')}</span>
                <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-mid)', letterSpacing: '0.08em', marginTop: '4px' }}>
                  {t('workingSetsCaption')}
                </div>
              </div>
              <div className="card" style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {MUSCLE_GROUPS.map(g => {
                  const agg = groupAggs.find(a => a.group === g)!
                  return (
                    <BalanceRow
                      key={g}
                      group={g}
                      groupLabel={GROUP_LABEL[g]}
                      setsThisWeek={agg.setsThisWeek}
                      engineStatus={muscleVolumeByGroup.get(g)}
                    />
                  )
                })}
              </div>
            </section>

            {/* 2b. TOTAL VOLUME TREND */}
            {weeklyVolume.some(w => w.volume > 0) && (
              <section style={{ marginBottom: '36px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <span className="section-label">{t('volumeHeading')}</span>
                </div>
                <div className="card" style={{ padding: '14px' }}>
                  <WeeklyVolumeBar weeks={weeklyVolume} height={130} />
                </div>
              </section>
            )}

            {/* 3. PROGRESSION — muscle group drill-down */}
            <section>
              <div style={{ marginBottom: '14px' }}>
                <span className="section-label">{t('progressionHeading')}</span>
                <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-mid)', letterSpacing: '0.08em', marginTop: '4px' }}>
                  {t('tapMuscleHint')}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                {MUSCLE_GROUPS.map(g => {
                  const agg = groupAggs.find(a => a.group === g)!
                  return (
                    <GroupTile
                      key={g}
                      group={g}
                      groupLabel={GROUP_LABEL[g]}
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
                        {t('noGroupSessions', { group: GROUP_LABEL[activeGroup] })}
                      </span>
                    </div>
                  ) : (
                    exercisesInGroup.map(ex => (
                      <ExerciseRow
                        key={ex.exerciseId ?? ex.name}
                        ex={ex}
                        expanded={expandedExercise === (ex.exerciseId ?? ex.name)}
                        onTap={() => setExpandedExercise(expandedExercise === (ex.exerciseId ?? ex.name) ? null : (ex.exerciseId ?? ex.name))}
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
