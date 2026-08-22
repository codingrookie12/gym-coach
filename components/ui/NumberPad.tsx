'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface NumberPadProps {
  initialValue?: number | null
  onConfirm: (value: number) => void
  onCancel: () => void
  /** Overrides the localized default label ("Enter value" / "Ingresa un valor"). */
  label?: string
  maxValue?: number
  allowDecimal?: boolean
}

/**
 * components/ui/NumberPad — GYM-19/GYM-29/Phase 1: extracted from its
 * previous standalone location (components/NumberPad.tsx) into the formal
 * components/ui/ primitive library. Behavior unchanged — same full-screen
 * numeric-entry pattern used for weight/rep entry across ActiveSessionScreen,
 * PreSaveSummaryScreen, and ManageWeightsScreen.
 *
 * Token-driven (var(--surface-2)/var(--accent)/etc. via the .numpad-btn
 * classes in globals.css — themes automatically). Every key is a
 * .numpad-btn, min-height 64px — well above the 44×44px tap-target floor.
 * Locale-aware: default label + Cancel button read from the `numberPad`
 * message namespace so this works correctly even inside not-yet-rebuilt
 * screens (next-intl's provider is app-root, not per-screen).
 */
export default function NumberPad({
  initialValue,
  onConfirm,
  onCancel,
  label,
  maxValue = 999,
  allowDecimal = false,
}: NumberPadProps) {
  const t = useTranslations('numberPad')
  const [input, setInput] = useState(initialValue !== null && initialValue !== undefined ? String(initialValue) : '')
  const [replaceOnNext, setReplaceOnNext] = useState(initialValue !== null && initialValue !== undefined)

  function press(val: string) {
    if (val === '.' && !allowDecimal) return
    if (val === '.' && input.includes('.')) return
    if (input.length >= 6) return
    if (replaceOnNext) {
      setReplaceOnNext(false)
      setInput(val === '.' ? '0.' : val)
      return
    }
    setInput(prev => {
      if (prev === '0' && val !== '.') return val
      return prev + val
    })
  }

  function backspace() {
    setReplaceOnNext(false)
    setInput(prev => prev.slice(0, -1))
  }

  function confirm() {
    const num = parseFloat(input)
    if (isNaN(num)) return
    onConfirm(Math.min(num, maxValue))
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowDecimal ? '.' : '', '0', '⌫']

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(12,11,9,0.97)' }}>
      {/* Label + display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <p className="section-label" style={{ marginBottom: '10px' }}>{label ?? t('defaultLabel')}</p>
        <div className="font-display" style={{ fontSize: '5rem', letterSpacing: '0.02em', lineHeight: 1, color: input ? 'var(--text-primary)' : 'var(--text-secondary)', minHeight: '80px' }}>
          {input || '—'}
        </div>
      </div>

      {/* Keypad */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-2 mb-2">
          {keys.map((key, i) => (
            <button
              key={i}
              className={`numpad-btn ${key === '⌫' ? 'delete' : ''}`}
              onClick={() => key === '⌫' ? backspace() : key ? press(key) : null}
              disabled={!key}
              style={!key ? { visibility: 'hidden' } : {}}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="numpad-btn"
            onClick={onCancel}
            style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}
          >
            {t('cancel')}
          </button>
          <button
            className="numpad-btn accent"
            onClick={confirm}
            disabled={!input || isNaN(parseFloat(input))}
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  )
}
