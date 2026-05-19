'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ALL_EXERCISES,
  Equipment,
  Muscle,
  Split,
  findExerciseByName,
} from '@/lib/exerciseLibrary'
import {
  createCustomExercise,
  updateCustomExercise,
  CustomExerciseNameTakenError,
  PendingExercise,
} from '@/lib/customExercises'
import ExerciseMetadataFields, { EQUIPMENT_OPTIONS } from '@/components/ExerciseMetadataFields'

// GYM-68: custom exercise creation/edit. Name is constructed from
// [Equipment] [Movement] [Modifier] per the catalog naming contract
// (CLAUDE.md → "Non-Negotiable Rules"). No free-text name entry.

interface BaseProps {
  userId: string
  onClose: () => void
  onSaved: (exercise: { id: string; name: string; equipment: Equipment; primaryMuscles: Muscle[]; split: Split | null }) => void
}

interface CreateProps extends BaseProps {
  mode: 'create'
  prefillName?: string
}

interface EditProps extends BaseProps {
  mode: 'edit'
  initial: PendingExercise
  onDelete?: () => Promise<void> | void
}

type Props = CreateProps | EditProps

// Best-effort parse of an existing name into (equipment, movement, modifier).
// If the first token matches a known equipment word, peel it off as Equipment;
// remainder is Movement. Parenthesized tails ("(Wide Grip)") become Modifier.
function parseName(name: string): { equipment: Equipment | ''; movement: string; modifier: string } {
  const trimmed = name.trim()
  if (!trimmed) return { equipment: '', movement: '', modifier: '' }

  let movement = trimmed
  let modifier = ''
  const parenMatch = movement.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (parenMatch) {
    movement = parenMatch[1].trim()
    modifier = parenMatch[2].trim()
  }

  // Try compound-word equipment first (e.g. "EZ Bar Curl").
  for (const eq of EQUIPMENT_OPTIONS) {
    const prefix = `${eq} `
    if (movement.toLowerCase().startsWith(prefix.toLowerCase())) {
      return {
        equipment: eq,
        movement: movement.slice(prefix.length).trim(),
        modifier,
      }
    }
  }
  return { equipment: '', movement, modifier }
}

function composeName(equipment: Equipment | '', movement: string, modifier: string): string {
  const parts = [equipment, movement.trim()].filter(Boolean)
  const base = parts.join(' ')
  const mod = modifier.trim()
  return mod ? `${base} ${mod}` : base
}

// Canonical movement tokens, derived from the static catalog. Used for
// autosuggest so users converge on existing spellings ("Bench Press" not
// "Benchpress"). Cached at module level — the catalog is static at build time.
const MOVEMENT_VOCAB: string[] = (() => {
  const tokens = new Set<string>()
  for (const ex of ALL_EXERCISES) {
    // Strip the leading equipment word + any trailing parenthetical, leave the verb.
    let rest = ex.name
    const paren = rest.match(/^(.+?)\s*\([^)]+\)\s*$/)
    if (paren) rest = paren[1]
    for (const eq of EQUIPMENT_OPTIONS) {
      const prefix = `${eq} `
      if (rest.toLowerCase().startsWith(prefix.toLowerCase())) {
        rest = rest.slice(prefix.length)
        break
      }
    }
    rest = rest.trim()
    if (rest) tokens.add(rest)
  }
  return Array.from(tokens).sort()
})()

function suggestMovements(query: string, equipment: Equipment | '', limit = 5): string[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return MOVEMENT_VOCAB
    .filter(t => t.toLowerCase().includes(q))
    // Hide suggestions that would produce a catalog duplicate with the current equipment.
    // Those would fail validation anyway — showing them just confuses.
    .filter(t => !equipment || !findExerciseByName(`${equipment} ${t}`))
    .slice(0, limit)
}

export default function CustomExerciseSheet(props: Props) {
  const { userId, onClose, onSaved, mode } = props
  const initial = mode === 'edit' ? props.initial : null
  const parsedInitial = useMemo(() => {
    if (initial) return parseName(initial.name)
    if (mode === 'create' && props.prefillName) return parseName(props.prefillName)
    return { equipment: '' as Equipment | '', movement: '', modifier: '' }
  }, [initial, mode, props])

  const [equipment, setEquipment] = useState<Equipment | ''>(
    parsedInitial.equipment || (initial?.equipment ?? '')
  )
  const [movement, setMovement] = useState(parsedInitial.movement)
  const [modifier, setModifier] = useState(parsedInitial.modifier)
  const [muscles, setMuscles] = useState<Muscle[]>(initial?.primaryMuscles ?? [])
  const [split, setSplit] = useState<string>(initial?.split ?? 'None')
  const [showSuggest, setShowSuggest] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const onDelete = mode === 'edit' ? (props as EditProps).onDelete : undefined

  const previewName = composeName(equipment, movement, modifier)
  const suggestions = showSuggest ? suggestMovements(movement, equipment) : []

  const validation = useMemo(() => {
    // `modifier` is consumed via `previewName` (declared above this hook),
    // so the eslint hint to drop it from deps would break uniqueness when
    // only the modifier changes.
    void modifier
    if (!equipment) return { ok: false, reason: 'Pick equipment first.' }
    if (!movement.trim()) return { ok: false, reason: 'Add a movement name.' }
    if (movement.trim().toLowerCase() === equipment.toLowerCase()) {
      return { ok: false, reason: 'Movement must be different from equipment (e.g. "Curl", "Row").' }
    }
    if (muscles.length === 0) return { ok: false, reason: 'Pick at least one primary muscle.' }
    if (mode === 'create') {
      const hit = findExerciseByName(previewName)
      if (hit) return { ok: false, reason: `"${hit.name}" already exists in the catalog.` }
    } else if (initial && previewName.toLowerCase() !== initial.name.toLowerCase()) {
      const hit = findExerciseByName(previewName)
      if (hit) return { ok: false, reason: `"${hit.name}" already exists in the catalog.` }
    }
    return { ok: true as const }
  }, [equipment, movement, modifier, muscles, mode, initial, previewName])

  const canSave = validation.ok && !saving

  useEffect(() => {
    setError(null)
  }, [equipment, movement, modifier, muscles, split])

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    const payload = {
      name: previewName,
      equipment: equipment as Equipment,
      primaryMuscles: muscles,
      split: split === 'None' ? null : split,
    }
    try {
      if (mode === 'create') {
        const created = await createCustomExercise(userId, payload)
        onSaved({ ...payload, id: created.id, name: created.name })
      } else {
        await updateCustomExercise(initial!.id, payload)
        onSaved({ ...payload, id: initial!.id })
      }
    } catch (e) {
      if (e instanceof CustomExerciseNameTakenError) {
        setError(`"${payload.name}" already exists in the catalog. Use it from the exercise picker instead.`)
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        setError(`Could not save: ${msg}`)
      }
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderRadius: '8px 8px 0 0',
        zIndex: 50,
        padding: '0 20px 40px',
        maxHeight: '90dvh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 16px', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        <div style={{ flexShrink: 0, marginBottom: '16px' }}>
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>
            {mode === 'create' ? 'NEW CUSTOM EXERCISE' : 'EDIT CUSTOM EXERCISE'}
          </p>
          <h3 className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0, letterSpacing: '0.04em', lineHeight: 1.1 }}>
            {previewName || <span style={{ color: 'var(--text-secondary)' }}>[Equipment] [Movement] [Modifier]</span>}
          </h3>
          <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: '6px 0 0', letterSpacing: '0.04em' }}>
            Format follows the catalog convention.
          </p>
        </div>

        <div className="scroll-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '16px' }}>

          <div>
            <p className="section-label" style={{ margin: '0 0 6px 0' }}>Movement</p>
            <input
              type="text"
              value={movement}
              onChange={e => { setMovement(e.target.value); setShowSuggest(true) }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
              placeholder="Bench Press, Row, Curl, Squat..."
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-2)',
                borderRadius: '2px',
                color: 'var(--text-primary)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.85rem',
                padding: '8px 10px',
                outline: 'none',
              }}
            />
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {suggestions.map(s => (
                  <button
                    key={s}
                    onMouseDown={e => { e.preventDefault(); setMovement(s); setShowSuggest(false) }}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-2)',
                      borderRadius: '2px',
                      color: 'var(--text-mid)',
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '0.58rem',
                      letterSpacing: '0.04em',
                      padding: '3px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <p className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', margin: '6px 0 0', letterSpacing: '0.04em' }}>
              Suggestions are movement names from the catalog — tap to match spelling.
            </p>
          </div>

          <div>
            <p className="section-label" style={{ margin: '0 0 6px 0' }}>Modifier (optional)</p>
            <input
              type="text"
              value={modifier}
              onChange={e => setModifier(e.target.value)}
              placeholder="Close Grip, Incline, Single Arm..."
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-2)',
                borderRadius: '2px',
                color: 'var(--text-primary)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.85rem',
                padding: '8px 10px',
                outline: 'none',
              }}
            />
          </div>

          <ExerciseMetadataFields
            equipment={equipment}
            setEquipment={setEquipment}
            muscles={muscles}
            setMuscles={setMuscles}
            split={split}
            setSplit={setSplit}
          />

          {!validation.ok && (validation.reason) && (
            <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: 0, letterSpacing: '0.04em' }}>
              {validation.reason}
            </p>
          )}
          {error && (
            <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--danger, #d97757)', margin: 0, letterSpacing: '0.04em' }}>
              {error}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, paddingTop: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '2px',
              color: 'var(--text-secondary)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              padding: '12px',
              cursor: 'pointer',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              flex: 2,
              background: canSave ? 'var(--accent)' : 'var(--surface-2)',
              border: `1px solid ${canSave ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '2px',
              color: canSave ? '#0C0B09' : 'var(--text-secondary)',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '1rem',
              letterSpacing: '0.1em',
              padding: '12px',
              cursor: canSave ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {saving ? 'SAVING…' : mode === 'create' ? 'CREATE' : 'SAVE'}
          </button>
        </div>
        {mode === 'edit' && onDelete && (
          <div style={{ flexShrink: 0, paddingTop: '10px', display: 'flex', justifyContent: 'center' }}>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                  Delete this exercise?
                </span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: '2px',
                    color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace',
                    fontSize: '0.6rem', letterSpacing: '0.06em', padding: '6px 10px', cursor: 'pointer',
                  }}
                >
                  NO
                </button>
                <button
                  onClick={() => { void onDelete() }}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px',
                    color: 'var(--danger, #d97757)', fontFamily: 'Space Mono, monospace',
                    fontSize: '0.6rem', letterSpacing: '0.06em', padding: '6px 10px', cursor: 'pointer',
                  }}
                >
                  YES, DELETE
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  fontFamily: 'Space Mono, monospace', fontSize: '0.6rem',
                  letterSpacing: '0.08em', padding: '6px 10px', cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                DELETE EXERCISE
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>
  )
}
