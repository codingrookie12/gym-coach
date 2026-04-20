'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ALL_EXERCISES,
  ExerciseDefinition,
  Equipment,
  Muscle,
  filterExercises,
  getUniqueEquipment,
  getUniqueMuscles,
} from '@/lib/exerciseLibrary'
import { getAllExercises } from '@/lib/routines'
import { Split } from '@/lib/routines'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ExerciseLibraryScreenProps {
  onBack: () => void
  // Optional: highlight which exercises are "in your program"
  activeSplit?: Split
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SPLITS: (Split | 'All')[] = ['All', 'Push', 'Pull', 'Legs']

const EQUIPMENT_OPTIONS = getUniqueEquipment()
const MUSCLE_OPTIONS = getUniqueMuscles()

// Build the set of exercise names in the PPL program
const PROGRAM_EXERCISE_NAMES = new Set(getAllExercises().map(e => e.name))

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'my-exercises' | 'browse' | 'custom'
type SplitFilter = Split | 'All'

// ─── Sub-components ────────────────────────────────────────────────────────────

function SplitChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--surface-2)',
        color: active ? '#0C0B09' : 'var(--text-mid)',
        border: active ? '1px solid var(--accent)' : '1px solid var(--border-2)',
        borderRadius: '2px',
        padding: '5px 12px',
        fontFamily: 'Space Mono, monospace',
        fontSize: '0.6rem',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        transition: 'all 0.1s',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {label.toUpperCase()}
    </button>
  )
}

function ExerciseRow({
  exercise,
  inProgram,
  isCustom,
  onTap,
}: {
  exercise: ExerciseDefinition
  inProgram: boolean
  isCustom: boolean
  onTap: (ex: ExerciseDefinition) => void
}) {
  return (
    <button
      onClick={() => onTap(exercise)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 20px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseDown={e => (e.currentTarget.style.background = 'rgba(212,241,58,0.04)')}
      onMouseUp={e => (e.currentTarget.style.background = 'none')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      onTouchStart={e => (e.currentTarget.style.background = 'rgba(212,241,58,0.04)')}
      onTouchEnd={e => (e.currentTarget.style.background = 'none')}
    >
      {/* Indicator dot */}
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: inProgram ? 'var(--accent)' : 'var(--border-2)',
        flexShrink: 0,
      }} />

      {/* Name + tags */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="font-body"
          style={{
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
            fontWeight: 500,
            lineHeight: 1.3,
            marginBottom: '4px',
          }}
        >
          {exercise.name}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span className="tag">{exercise.equipment}</span>
          {exercise.primaryMuscles.slice(0, 2).map(m => (
            <span key={m} className="tag">{m}</span>
          ))}
          {isCustom && <span className="tag accent">Custom</span>}
          {inProgram && <span className="tag accent">In Program</span>}
        </div>
      </div>

      {/* Mechanic badge */}
      {exercise.mechanic && (
        <span
          className="font-mono"
          style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', flexShrink: 0 }}
        >
          {exercise.mechanic.toUpperCase()}
        </span>
      )}
    </button>
  )
}

// ─── Detail sheet ───────────────────────────────────────────────────────────────

function ExerciseDetailSheet({
  exercise,
  inProgram,
  onClose,
}: {
  exercise: ExerciseDefinition
  inProgram: boolean
  onClose: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 40, animation: 'fadeIn 0.15s ease',
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '8px 8px 0 0',
          zIndex: 50,
          animation: 'slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
          maxHeight: '80dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '4px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <h2 className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', letterSpacing: '0.04em', margin: 0, lineHeight: 1.1 }}>
                {exercise.name}
              </h2>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span className="tag">{exercise.equipment}</span>
                {inProgram && <span className="tag accent">In Program</span>}
                {exercise.isCustom && <span className="tag accent">Custom</span>}
                {exercise.split && <span className="tag">{exercise.split}</span>}
                {exercise.level && (
                  <span className="tag" style={{ textTransform: 'capitalize' }}>{exercise.level}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="scroll-area" style={{ flex: 1, padding: '16px 20px 32px' }}>

          {/* Muscles */}
          <div style={{ marginBottom: '20px' }}>
            <div className="section-label" style={{ marginBottom: '8px' }}>Primary Muscles</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {exercise.primaryMuscles.map(m => (
                <span key={m} className="tag accent">{m}</span>
              ))}
            </div>
          </div>
          {exercise.secondaryMuscles.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '8px' }}>Secondary Muscles</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {exercise.secondaryMuscles.map(m => (
                  <span key={m} className="tag">{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            {exercise.mechanic && (
              <div className="card" style={{ flex: 1, padding: '10px 12px' }}>
                <div className="section-label" style={{ marginBottom: '4px' }}>Mechanic</div>
                <div className="font-body" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{exercise.mechanic}</div>
              </div>
            )}
            {exercise.force && (
              <div className="card" style={{ flex: 1, padding: '10px 12px' }}>
                <div className="section-label" style={{ marginBottom: '4px' }}>Force</div>
                <div className="font-body" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{exercise.force}</div>
              </div>
            )}
          </div>

          {/* Instructions */}
          {exercise.instructions.length > 0 && (
            <div>
              <div className="section-label" style={{ marginBottom: '10px' }}>Instructions</div>
              <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {exercise.instructions.map((step, i) => (
                  <li key={i} className="font-body" style={{ fontSize: '0.9rem', color: 'var(--text-mid)', lineHeight: 1.5 }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Custom Add Form ────────────────────────────────────────────────────────────

function CustomAddForm({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderRadius: '8px 8px 0 0',
        zIndex: 50,
        padding: '20px 20px 40px',
        animation: 'slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>
        <h3 className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', letterSpacing: '0.06em', margin: '0 0 8px' }}>
          CUSTOM EXERCISE
        </h3>
        <p className="font-body" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Custom exercises are defined in <code style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>exercises.json</code> and follow the naming convention in <code style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>exerciseLibrary.ts</code>.
        </p>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', padding: '12px 16px', marginBottom: '20px' }}>
          <div className="section-label" style={{ marginBottom: '6px' }}>Format</div>
          <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-mid)', lineHeight: 1.7 }}>
            {"{"}<br />
            &nbsp;&nbsp;"id": "custom-[slug]",<br />
            &nbsp;&nbsp;"name": "[Equipment] [Movement] [Modifier]",<br />
            &nbsp;&nbsp;"equipment": "Cable | Barbell | ...",<br />
            &nbsp;&nbsp;"primaryMuscles": ["Biceps"],<br />
            &nbsp;&nbsp;"split": "Pull | Push | Legs | null",<br />
            &nbsp;&nbsp;"isCustom": true<br />
            {"}"}
          </div>
        </div>
        <button onClick={onClose} className="btn-secondary">CLOSE</button>
      </div>
    </>
  )
}

// ─── My Exercises Tab ──────────────────────────────────────────────────────────

function MyExercisesTab({
  splitFilter,
  onSelectExercise,
}: {
  splitFilter: SplitFilter
  onSelectExercise: (ex: ExerciseDefinition) => void
}) {
  const programExercises = getAllExercises()

  const filtered = useMemo(() => {
    return splitFilter === 'All'
      ? programExercises
      : programExercises.filter(e => e.split === splitFilter)
  }, [splitFilter, programExercises])

  const groups: { split: Split; exercises: typeof programExercises }[] = useMemo(() => {
    const splits: Split[] = ['Push', 'Pull', 'Legs']
    return splits
      .map(s => ({ split: s, exercises: filtered.filter(e => e.split === s) }))
      .filter(g => g.exercises.length > 0)
  }, [filtered])

  return (
    <div className="scroll-area" style={{ flex: 1, minHeight: 0 }}>
      {groups.map(group => {
        return (
          <div key={group.split}>
            <div style={{
              padding: '10px 20px 8px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
              position: 'sticky',
              top: 0,
              zIndex: 5,
            }}>
              <span className="section-label">{group.split.toUpperCase()} DAY</span>
              <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--border-2)', marginLeft: '8px' }}>
                {group.exercises.length} EXERCISES
              </span>
            </div>
            {group.exercises.map(ex => {
              // Find the matching ExerciseDefinition in ALL_EXERCISES
              const def = ALL_EXERCISES.find(d => d.name === ex.name) ?? {
                id: ex.name,
                name: ex.name,
                equipment: (ex.name.toLowerCase().includes('cable') ? 'Cable'
                  : ex.name.toLowerCase().includes('barbell') ? 'Barbell'
                  : ex.name.toLowerCase().includes('dumbbell') ? 'Dumbbell'
                  : 'Machine') as Equipment,
                primaryMuscles: [] as Muscle[],
                secondaryMuscles: [] as Muscle[],
                split: ex.split,
                mechanic: null,
                force: null,
                level: 'intermediate' as const,
                instructions: [],
                isCustom: false,
              } as ExerciseDefinition
              return (
                <ExerciseRow
                  key={ex.name}
                  exercise={def}
                  inProgram={true}
                  isCustom={def.isCustom}
                  onTap={onSelectExercise}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── Browse Tab ────────────────────────────────────────────────────────────────

function BrowseTab({
  onSelectExercise,
}: {
  onSelectExercise: (ex: ExerciseDefinition) => void
}) {
  const [query, setQuery] = useState('')
  const [splitFilter, setSplitFilter] = useState<SplitFilter>('All')
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | 'All'>('All')
  const [muscleFilter, setMuscleFilter] = useState<string>('All')
  const [showFilters, setShowFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    return filterExercises({
      query: query || undefined,
      split: splitFilter === 'All' ? undefined : splitFilter,
      equipment: equipmentFilter === 'All' ? undefined : equipmentFilter,
      muscle: muscleFilter === 'All' ? undefined : muscleFilter,
    })
  }, [query, splitFilter, equipmentFilter, muscleFilter])

  const activeFilterCount = [
    splitFilter !== 'All',
    equipmentFilter !== 'All',
    muscleFilter !== 'All',
  ].filter(Boolean).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Search bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search exercises..."
            className="input-field"
            style={{ paddingLeft: '36px', paddingRight: query ? '36px' : '12px' }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '1rem', padding: '0', lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div style={{ flexShrink: 0 }}>
        {/* Quick split chips */}
        <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
          {SPLITS.map(s => (
            <SplitChip key={s} label={s} active={splitFilter === s} onClick={() => setSplitFilter(s)} />
          ))}
          <div style={{ flexShrink: 0, width: '1px', background: 'var(--border-2)', margin: '0 4px' }} />
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              background: activeFilterCount > 0 ? 'var(--accent-dim)' : 'var(--surface-2)',
              color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-mid)',
              border: activeFilterCount > 0 ? '1px solid var(--accent-border)' : '1px solid var(--border-2)',
              borderRadius: '2px',
              padding: '5px 12px',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            FILTER
            {activeFilterCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: '#0C0B09',
                borderRadius: '50%', width: '14px', height: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.5rem', fontWeight: 700,
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Equipment */}
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Equipment</div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                <SplitChip label="All" active={equipmentFilter === 'All'} onClick={() => setEquipmentFilter('All')} />
                {EQUIPMENT_OPTIONS.map(eq => (
                  <SplitChip key={eq} label={eq} active={equipmentFilter === eq} onClick={() => setEquipmentFilter(eq)} />
                ))}
              </div>
            </div>

            {/* Muscle */}
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Primary Muscle</div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                <SplitChip label="All" active={muscleFilter === 'All'} onClick={() => setMuscleFilter('All')} />
                {MUSCLE_OPTIONS.map(m => (
                  <SplitChip key={m} label={m} active={muscleFilter === m} onClick={() => setMuscleFilter(m)} />
                ))}
              </div>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setSplitFilter('All'); setEquipmentFilter('All'); setMuscleFilter('All') }}
                style={{ background: 'none', border: '1px solid var(--rust-border)', color: 'var(--rust)', borderRadius: '2px', padding: '7px 12px', fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', cursor: 'pointer', letterSpacing: '0.08em', alignSelf: 'flex-start' }}
              >
                CLEAR FILTERS
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          {results.length} EXERCISE{results.length !== 1 ? 'S' : ''}
          {query && ` · "${query}"`}
        </span>
      </div>

      {/* Results list */}
      <div className="scroll-area" style={{ flex: 1, minHeight: 0 }}>
        {results.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              NO RESULTS
            </div>
            <div className="font-body" style={{ fontSize: '0.85rem', color: 'var(--border-2)' }}>
              Try adjusting your search or filters
            </div>
          </div>
        ) : (
          results.map(ex => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              inProgram={PROGRAM_EXERCISE_NAMES.has(ex.name)}
              isCustom={ex.isCustom}
              onTap={onSelectExercise}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ExerciseLibraryScreen({
  onBack,
  activeSplit,
}: ExerciseLibraryScreenProps) {
  const [tab, setTab] = useState<Tab>('my-exercises')
  const [splitFilter, setSplitFilter] = useState<SplitFilter>(activeSplit ?? 'All')
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition | null>(null)
  const [showCustomForm, setShowCustomForm] = useState(false)

  const programCount = getAllExercises().length
  const totalCount = ALL_EXERCISES.length

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh', background: 'var(--bg)' }}>

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
            EXERCISE LIBRARY
          </span>
        </div>
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          {totalCount} TOTAL
        </span>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {([
          { id: 'my-exercises', label: 'MY EXERCISES', count: programCount },
          { id: 'browse', label: 'BROWSE', count: null },
          { id: 'custom', label: 'CUSTOM', count: null },
        ] as { id: Tab; label: string; count: number | null }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px 10px',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.58rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'color 0.1s, border-color 0.1s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {t.label}
            {t.count !== null && (
              <span style={{
                background: tab === t.id ? 'var(--accent)' : 'var(--surface-2)',
                color: tab === t.id ? '#0C0B09' : 'var(--text-secondary)',
                borderRadius: '2px',
                padding: '1px 5px',
                fontSize: '0.5rem',
                fontWeight: 700,
                transition: 'all 0.1s',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'my-exercises' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Split filter chips */}
          <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', borderBottom: '1px solid var(--border)', overflowX: 'auto', flexShrink: 0 }}>
            {SPLITS.map(s => (
              <SplitChip key={s} label={s} active={splitFilter === s} onClick={() => setSplitFilter(s)} />
            ))}
          </div>
          <MyExercisesTab splitFilter={splitFilter} onSelectExercise={setSelectedExercise} />
        </div>
      )}

      {tab === 'browse' && (
        <BrowseTab onSelectExercise={setSelectedExercise} />
      )}

      {tab === 'custom' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Custom exercises list */}
          <div className="scroll-area" style={{ flex: 1, minHeight: 0 }}>
            {/* Header row */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div className="font-body" style={{ fontSize: '0.9rem', color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: '12px' }}>
                Custom exercises are added directly to <span className="font-mono" style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>exercises.json</span> and must follow the naming convention defined in <span className="font-mono" style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>exerciseLibrary.ts</span>.
              </div>
              <button
                onClick={() => setShowCustomForm(true)}
                style={{
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: '2px',
                  color: 'var(--accent)',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '0.6rem',
                  letterSpacing: '0.1em',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                HOW TO ADD CUSTOM EXERCISE
              </button>
            </div>

            {/* Custom exercises */}
            {ALL_EXERCISES.filter(e => e.isCustom).length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '6px' }}>
                  NO CUSTOM EXERCISES
                </div>
                <div className="font-body" style={{ fontSize: '0.85rem', color: 'var(--border-2)' }}>
                  Add exercises to exercises.json with isCustom: true
                </div>
              </div>
            ) : (
              ALL_EXERCISES.filter(e => e.isCustom).map(ex => (
                <ExerciseRow
                  key={ex.id}
                  exercise={ex}
                  inProgram={PROGRAM_EXERCISE_NAMES.has(ex.name)}
                  isCustom={true}
                  onTap={setSelectedExercise}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Detail sheet */}
      {selectedExercise && (
        <ExerciseDetailSheet
          exercise={selectedExercise}
          inProgram={PROGRAM_EXERCISE_NAMES.has(selectedExercise.name)}
          onClose={() => setSelectedExercise(null)}
        />
      )}

      {/* Custom form sheet */}
      {showCustomForm && <CustomAddForm onClose={() => setShowCustomForm(false)} />}

      {/* Sheet animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  )
}
