'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ALL_EXERCISES,
  ExerciseDefinition,
  Equipment,
  filterExercises,
  getUniqueEquipment,
  getUniqueMuscles,
} from '@/lib/exerciseLibrary'
import { getAllExercisesForProgram, Split } from '@/lib/routines'
import ExerciseDetailSheet from '@/components/ExerciseDetailSheet'
import CustomExerciseSheet from '@/components/CustomExerciseSheet'
import {
  getPendingExercises,
  deleteCustomExercise,
  CustomExerciseInUseError,
  PendingExercise,
} from '@/lib/customExercises'

const SPLITS: (Split | 'All')[] = ['All', 'Push', 'Pull', 'Legs']
const EQUIPMENT_OPTIONS = getUniqueEquipment()
const MUSCLE_OPTIONS = getUniqueMuscles()

type Tab = 'browse' | 'custom'
type SplitFilter = Split | 'All'

interface Props {
  onBack: () => void
  userId: string
  activeProgramId?: string
  preselectedExerciseName?: string | null
}

// Adapt a custom-exercise row from Supabase to the ExerciseDefinition shape
// the row renderer expects. Only the fields the row reads are populated.
function pendingToDefinition(p: PendingExercise): ExerciseDefinition {
  return {
    id: p.id,
    name: p.name,
    equipment: (p.equipment ?? 'Other') as Equipment,
    primaryMuscles: p.primaryMuscles ?? [],
    secondaryMuscles: [],
    split: p.split ?? null,
    mechanic: null,
    force: null,
    level: 'intermediate',
    instructions: [],
    isCustom: true,
  }
}

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
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: inProgram ? 'var(--accent)' : 'var(--border-2)',
        flexShrink: 0,
      }} />
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

function BrowseTab({
  onSelectExercise,
  programExerciseNames,
}: {
  onSelectExercise: (ex: ExerciseDefinition) => void
  programExerciseNames: Set<string>
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

      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
          {SPLITS.map(s => (
            <SplitChip key={s} label={s} active={splitFilter === s} onClick={() => setSplitFilter(s)} />
          ))}
          <div style={{ flexShrink: 0, width: '1px', background: 'var(--border-2)', margin: '0 4px' }} />
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

        {showFilters && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Equipment</div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                <SplitChip label="All" active={equipmentFilter === 'All'} onClick={() => setEquipmentFilter('All')} />
                {EQUIPMENT_OPTIONS.map(eq => (
                  <SplitChip key={eq} label={eq} active={equipmentFilter === eq} onClick={() => setEquipmentFilter(eq)} />
                ))}
              </div>
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Primary Muscle</div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                <SplitChip label="All" active={muscleFilter === 'All'} onClick={() => setMuscleFilter('All')} />
                {MUSCLE_OPTIONS.map(m => (
                  <SplitChip key={m} label={m} active={muscleFilter === m} onClick={() => setMuscleFilter(m)} />
                ))}
              </div>
            </div>
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

      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          {results.length} EXERCISE{results.length !== 1 ? 'S' : ''}
          {query && ` · "${query}"`}
        </span>
      </div>

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
              inProgram={programExerciseNames.has(ex.name)}
              isCustom={ex.isCustom}
              onTap={onSelectExercise}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function ExerciseBrowserScreen({
  onBack,
  userId,
  activeProgramId = 'ppl-default',
  preselectedExerciseName,
}: Props) {
  const [tab, setTab] = useState<Tab>('browse')
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition | null>(null)
  const [customRows, setCustomRows] = useState<PendingExercise[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PendingExercise | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const reloadCustom = useCallback(async () => {
    const rows = await getPendingExercises(userId)
    setCustomRows(rows)
  }, [userId])

  useEffect(() => { void reloadCustom() }, [reloadCustom])

  const pendingCustom = customRows.filter(r => !r.metadataComplete)
  const completeCustom = customRows.filter(r => r.metadataComplete)

  // Catalog exercises marked isCustom=true (app-added, not from free-exercise-db).
  // These are read-only — users can't edit or delete them, but they belong in this
  // tab since they show the "Custom" tag throughout the rest of the app.
  const catalogCustom = useMemo(
    () => ALL_EXERCISES.filter(e => e.isCustom),
    []
  )

  const totalCustomCount = customRows.length + catalogCustom.length

  const totalCount = ALL_EXERCISES.length

  const programExerciseNames = useMemo(
    () => new Set(getAllExercisesForProgram(activeProgramId).map(e => e.name)),
    [activeProgramId]
  )

  // Power-user deep-link: open detail sheet immediately when given a preselected name.
  useEffect(() => {
    if (!preselectedExerciseName) return
    const match = ALL_EXERCISES.find(e => e.name === preselectedExerciseName)
    if (match) setSelectedExercise(match)
  }, [preselectedExerciseName])

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
            EXERCISES
          </span>
        </div>
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          {totalCount} TOTAL
        </span>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {([
          { id: 'browse' as Tab, label: 'BROWSE' },
          { id: 'custom' as Tab, label: 'CUSTOM', count: totalCustomCount },
        ]).map(t => (
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
            {t.count !== undefined && t.count > 0 && (
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

      {tab === 'browse' && (
        <BrowseTab onSelectExercise={setSelectedExercise} programExerciseNames={programExerciseNames} />
      )}

      {tab === 'custom' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={() => setCreateOpen(true)}
              style={{
                width: '100%',
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent-border)',
                borderRadius: '2px',
                color: 'var(--accent)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.65rem',
                letterSpacing: '0.1em',
                padding: '10px',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              + NEW CUSTOM EXERCISE
            </button>
          </div>

          <div className="scroll-area" style={{ flex: 1, minHeight: 0 }}>
            {totalCustomCount === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '6px' }}>
                  NO CUSTOM EXERCISES
                </div>
                <div className="font-body" style={{ fontSize: '0.85rem', color: 'var(--border-2)' }}>
                  Tap &ldquo;+ NEW CUSTOM EXERCISE&rdquo; to add your own
                </div>
              </div>
            ) : (
              <>
                {pendingCustom.length > 0 && (
                  <>
                    <div style={{ padding: '14px 20px 6px', borderBottom: '1px solid var(--border)' }}>
                      <p className="section-label" style={{ margin: 0 }}>
                        NEEDS METADATA · {pendingCustom.length}
                      </p>
                      <p className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', margin: '4px 0 0', letterSpacing: '0.04em' }}>
                        Tap to complete — these won&apos;t appear in history aggregations until done.
                      </p>
                    </div>
                    {pendingCustom.map(p => (
                      <ExerciseRow
                        key={p.id}
                        exercise={pendingToDefinition(p)}
                        inProgram={programExerciseNames.has(p.name)}
                        isCustom={true}
                        onTap={() => setEditing(p)}
                      />
                    ))}
                  </>
                )}

                {completeCustom.length > 0 && (
                  <>
                    <div style={{ padding: '14px 20px 6px', borderBottom: '1px solid var(--border)' }}>
                      <p className="section-label" style={{ margin: 0 }}>
                        YOUR EXERCISES · {completeCustom.length}
                      </p>
                    </div>
                    {completeCustom.map(p => (
                      <ExerciseRow
                        key={p.id}
                        exercise={pendingToDefinition(p)}
                        inProgram={programExerciseNames.has(p.name)}
                        isCustom={true}
                        onTap={() => setEditing(p)}
                      />
                    ))}
                  </>
                )}

                {catalogCustom.length > 0 && (
                  <>
                    <div style={{ padding: '14px 20px 6px', borderBottom: '1px solid var(--border)' }}>
                      <p className="section-label" style={{ margin: 0 }}>
                        CATALOG · {catalogCustom.length}
                      </p>
                      <p className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', margin: '4px 0 0', letterSpacing: '0.04em' }}>
                        App-added exercises not in the standard database.
                      </p>
                    </div>
                    {catalogCustom.map(ex => (
                      <ExerciseRow
                        key={ex.id}
                        exercise={ex}
                        inProgram={programExerciseNames.has(ex.name)}
                        isCustom={true}
                        onTap={() => setSelectedExercise(ex)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {selectedExercise && (
        <ExerciseDetailSheet
          exercise={selectedExercise}
          inProgram={programExerciseNames.has(selectedExercise.name)}
          onClose={() => setSelectedExercise(null)}
        />
      )}

      {createOpen && (
        <CustomExerciseSheet
          mode="create"
          userId={userId}
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false)
            await reloadCustom()
          }}
        />
      )}

      {editing && (
        <CustomExerciseSheet
          mode="edit"
          userId={userId}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await reloadCustom()
          }}
          onDelete={async () => {
            try {
              await deleteCustomExercise(editing.id)
              setEditing(null)
              setDeleteError(null)
              await reloadCustom()
            } catch (e) {
              if (e instanceof CustomExerciseInUseError) {
                setDeleteError("Can't delete — sets have been logged. Rename instead.")
              } else {
                setDeleteError('Delete failed. Try again.')
              }
            }
          }}
        />
      )}

      {deleteError && (
        <div
          onClick={() => setDeleteError(null)}
          style={{
            position: 'fixed', bottom: '20px', left: '20px', right: '20px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '2px', padding: '10px 14px', zIndex: 60,
            fontFamily: 'Space Mono, monospace', fontSize: '0.62rem',
            color: 'var(--text-mid)', cursor: 'pointer',
          }}
        >
          {deleteError}
        </div>
      )}
    </div>
  )
}
