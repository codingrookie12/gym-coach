'use client'

import { Equipment, Muscle } from '@/lib/exerciseLibrary'

export const EQUIPMENT_OPTIONS: Equipment[] = [
  'Barbell', 'Dumbbell', 'Cable', 'Machine', 'EZ Bar',
  'Bands', 'Kettlebell', 'Bodyweight', 'Other',
]
export const MUSCLE_OPTIONS: Muscle[] = [
  'Chest', 'Shoulders', 'Triceps', 'Biceps', 'Back', 'Lats',
  'Middle Back', 'Lower Back', 'Abdominals', 'Quadriceps',
  'Hamstrings', 'Glutes', 'Calves',
] as Muscle[]
export const SPLIT_OPTIONS: string[] = ['Push', 'Pull', 'Legs', 'None']

interface Props {
  equipment: Equipment | ''
  setEquipment: (e: Equipment) => void
  muscles: Muscle[]
  setMuscles: (m: Muscle[]) => void
  split: string
  setSplit: (s: string) => void
}

export default function ExerciseMetadataFields({
  equipment, setEquipment, muscles, setMuscles, split, setSplit,
}: Props) {
  function toggleMuscle(m: Muscle) {
    setMuscles(muscles.includes(m) ? muscles.filter(x => x !== m) : [...muscles, m])
  }

  return (
    <>
      <div>
        <p className="section-label" style={{ margin: '0 0 8px 0' }}>Equipment</p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {EQUIPMENT_OPTIONS.map(eq => (
            <button
              key={eq}
              onClick={() => setEquipment(eq)}
              style={{
                background: equipment === eq ? 'var(--accent-dim)' : 'var(--surface-2)',
                border: `1px solid ${equipment === eq ? 'var(--accent-border)' : 'var(--border-2)'}`,
                borderRadius: '2px',
                color: equipment === eq ? 'var(--accent)' : 'var(--text-mid)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.6rem',
                letterSpacing: '0.05em',
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              {eq}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="section-label" style={{ margin: '0 0 8px 0' }}>Primary Muscles</p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {MUSCLE_OPTIONS.map(m => (
            <button
              key={m}
              onClick={() => toggleMuscle(m)}
              style={{
                background: muscles.includes(m) ? 'var(--accent-dim)' : 'var(--surface-2)',
                border: `1px solid ${muscles.includes(m) ? 'var(--accent-border)' : 'var(--border-2)'}`,
                borderRadius: '2px',
                color: muscles.includes(m) ? 'var(--accent)' : 'var(--text-mid)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.6rem',
                letterSpacing: '0.05em',
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="section-label" style={{ margin: '0 0 8px 0' }}>Split Day</p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {SPLIT_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSplit(s)}
              style={{
                background: split === s ? 'var(--accent-dim)' : 'var(--surface-2)',
                border: `1px solid ${split === s ? 'var(--accent-border)' : 'var(--border-2)'}`,
                borderRadius: '2px',
                color: split === s ? 'var(--accent)' : 'var(--text-mid)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.6rem',
                letterSpacing: '0.05em',
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
