'use client'

import { useState, useEffect } from 'react'
import { getAllExercises, Exercise, Split } from '@/lib/routines'
import NumberPad from '@/components/NumberPad'
import LoadingScreen from '@/components/LoadingScreen'

interface ManageWeightsScreenProps {
  onBack: () => void
}

type SplitFilter = Split | 'All'

export default function ManageWeightsScreen({ onBack }: ManageWeightsScreenProps) {
  const [weights, setWeights] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [filter, setFilter] = useState<SplitFilter>('All')

  const allExercises = getAllExercises()

  useEffect(() => {
    setLoading(true)
    fetch('/api/weights/all')
      .then(r => r.json())
      .then(data => {
        setWeights(data.weights ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [refreshKey])

  async function handleSetWeight(value: number) {
    if (!editingExercise) return
    const name = editingExercise.name
    setSaving(name)
    setEditingExercise(null)

    try {
      await fetch('/api/weights/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise: name, weight: value }),
      })
      setWeights(prev => ({ ...prev, [name]: value }))
    } catch (e) {
      console.error('Save failed:', e)
    }
    setSaving(null)
  }

  const filteredExercises = filter === 'All'
    ? allExercises
    : allExercises.filter(ex => ex.split === filter)

  const splitGroups: { split: Split; exercises: Exercise[] }[] = (
    [
      { split: 'Push' as Split, exercises: filteredExercises.filter(e => e.split === 'Push') },
      { split: 'Pull' as Split, exercises: filteredExercises.filter(e => e.split === 'Pull') },
      { split: 'Legs' as Split, exercises: filteredExercises.filter(e => e.split === 'Legs') },
    ] as { split: Split; exercises: Exercise[] }[]
  ).filter(g => g.exercises.length > 0)

  if (loading) return <LoadingScreen message="Loading weights..." />

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>

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
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>SETTINGS</p>
          <h1 className="font-display" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
            Manage Weights
          </h1>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: '2px', color: 'var(--text-mid)', fontFamily: 'Bebas Neue, sans-serif', fontSize: '0.9rem', letterSpacing: '0.1em', padding: '6px 12px', cursor: 'pointer' }}
        >
          ↻ SYNC
        </button>
      </div>

      {/* Filter tabs */}
      <div
        className="flex px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)', gap: '6px', flexShrink: 0 }}
      >
        {(['All', 'Push', 'Pull', 'Legs'] as SplitFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--accent)' : 'var(--surface-2)',
              color: filter === f ? '#0C0B09' : 'var(--text-secondary)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '2px',
              padding: '6px 14px',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '0.95rem',
              fontWeight: filter === f ? 700 : 400,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="scroll-area flex-1 px-5 py-3">
        {splitGroups.map(group => (
          <div key={group.split} style={{ marginBottom: '18px' }}>
            {filter === 'All' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
                <span className="font-display" style={{ fontSize: '1rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                  {group.split.toUpperCase()}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {group.exercises.map((ex, i) => {
                const w = weights[ex.name]
                const isSaving = saving === ex.name
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p className="font-sans" style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                        {ex.name}
                      </p>
                      {ex.weightConvention && (
                        <p className="section-label" style={{ margin: 0 }}>{ex.weightConvention}</p>
                      )}
                    </div>

                    <button
                      onClick={() => setEditingExercise(ex)}
                      disabled={isSaving}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px 0 8px 14px',
                      }}
                    >
                      {isSaving ? (
                        <div className="spinner" />
                      ) : (
                        <>
                          <span className="font-display" style={{
                            fontSize: '1.2rem',
                            color: w !== null && w !== undefined ? 'var(--accent)' : 'var(--text-secondary)',
                            letterSpacing: '0.02em',
                            lineHeight: 1,
                          }}>
                            {w !== null && w !== undefined ? `${w}` : '—'}
                          </span>
                          {w !== null && w !== undefined && (
                            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>lbs</span>
                          )}
                          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--border-2)', marginLeft: '6px' }}>
                            ✎
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Number pad */}
      {editingExercise && (
        <NumberPad
          initialValue={weights[editingExercise.name] ?? null}
          onConfirm={handleSetWeight}
          onCancel={() => setEditingExercise(null)}
          label={editingExercise.name}
          maxValue={999}
          allowDecimal={true}
        />
      )}
    </div>
  )
}
