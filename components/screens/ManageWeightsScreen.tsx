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
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [filter, setFilter] = useState<SplitFilter>('All')

  const allExercises = getAllExercises()

  useEffect(() => {
    fetch('/api/weights/all')
      .then(r => r.json())
      .then(data => {
        setWeights(data.weights ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

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
        style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', padding: '4px' }}
        >
          ←
        </button>
        <div>
          <p className="font-mono-display" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', margin: 0 }}>SETTINGS</p>
          <h1 className="font-mono-display" style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>
            Manage Weights
          </h1>
        </div>
      </div>

      {/* Filter tabs */}
      <div
        className="flex px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)', gap: '8px', flexShrink: 0 }}
      >
        {(['All', 'Push', 'Pull', 'Legs'] as SplitFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              color: filter === f ? '#0A0A0A' : 'var(--text-secondary)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '3px',
              padding: '6px 12px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '0.7rem',
              fontWeight: filter === f ? 600 : 400,
              letterSpacing: '0.08em',
              cursor: 'pointer',
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="scroll-area flex-1 px-5 py-4">
        {splitGroups.map(group => (
          <div key={group.split} style={{ marginBottom: '20px' }}>
            {filter === 'All' && (
              <p
                style={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.15em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'DM Mono, monospace',
                  margin: '0 0 8px 0',
                  paddingBottom: '6px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {group.split.toUpperCase()}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                      padding: '12px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                        {ex.name}
                      </p>
                      {ex.weightConvention && (
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                          {ex.weightConvention}
                        </p>
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
                        padding: '8px 0 8px 12px',
                      }}
                    >
                      {isSaving ? (
                        <div className="spinner" style={{ width: '16px', height: '16px' }} />
                      ) : (
                        <>
                          <span
                            className="font-mono-display"
                            style={{
                              fontSize: '1.1rem',
                              fontWeight: 500,
                              color: w !== null && w !== undefined ? 'var(--accent)' : 'var(--text-secondary)',
                            }}
                          >
                            {w !== null && w !== undefined ? `${w}` : '—'}
                          </span>
                          {w !== null && w !== undefined && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
                              lbs
                            </span>
                          )}
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', marginLeft: '6px' }}>
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

      {/* Number pad for editing */}
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
