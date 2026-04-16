'use client'

import { useState } from 'react'

interface NumberPadProps {
  initialValue?: number | null
  onConfirm: (value: number) => void
  onCancel: () => void
  label?: string
  maxValue?: number
  allowDecimal?: boolean
}

export default function NumberPad({
  initialValue,
  onConfirm,
  onCancel,
  label = 'Enter value',
  maxValue = 999,
  allowDecimal = false,
}: NumberPadProps) {
  const [input, setInput] = useState(initialValue !== null && initialValue !== undefined ? String(initialValue) : '')

  function press(val: string) {
    if (val === '.' && !allowDecimal) return
    if (val === '.' && input.includes('.')) return
    if (input.length >= 6) return
    setInput(prev => {
      if (prev === '0' && val !== '.') return val
      return prev + val
    })
  }

  function backspace() {
    setInput(prev => prev.slice(0, -1))
  }

  function confirm() {
    const num = parseFloat(input)
    if (isNaN(num)) return
    onConfirm(Math.min(num, maxValue))
  }

  const keys = ['1','2','3','4','5','6','7','8','9', allowDecimal ? '.' : '', '0', '⌫']

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(10,10,10,0.95)' }}>
      {/* Label + display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <p className="text-secondary-color font-mono-display text-sm mb-3">{label}</p>
        <div className="font-mono-display text-6xl font-medium tracking-tight" style={{ color: input ? 'var(--text-primary)' : 'var(--text-secondary)', minHeight: '72px' }}>
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
            Cancel
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
