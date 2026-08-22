'use client'

import { useTranslations } from 'next-intl'

interface ChipGridProps<T extends number | string> {
  values: T[]
  selectedValue?: T | null
  onSelect: (value: T) => void
  columns?: number
  formatValue?: (value: T) => string
  /** Shows a dashed "CUSTOM VALUE" chip after the grid when provided. */
  onCustomValue?: () => void
  maxWidth?: number | string
}

/**
 * components/ui/ChipGrid — Phase 1: extracted from its previous inline
 * implementation in ActiveSessionScreen.tsx's WeightInput (the
 * `availableWeights.map(...)` grid — never a standalone component before
 * this pass). Quick-select grid for a small, bounded set of values
 * (weight chips from `exercise.availableWeights`, rep-range chips,
 * plate-count chips, etc.) — for open-ended numeric entry use
 * components/ui/NumberPad instead.
 *
 * Every chip is ≥44px tall (padding-driven, not a fixed height) — the
 * 44×44px tap-target floor from the Phase 1 checker gate.
 */
export default function ChipGrid<T extends number | string>({
  values,
  selectedValue,
  onSelect,
  columns = 4,
  formatValue,
  onCustomValue,
  maxWidth = 320,
}: ChipGridProps<T>) {
  const t = useTranslations('chipGrid')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '8px',
          width: '100%',
          maxWidth,
        }}
      >
        {values.map(value => {
          const isSelected = selectedValue === value
          return (
            <button
              key={value}
              onClick={() => onSelect(value)}
              style={{
                minHeight: '44px',
                padding: '18px 8px',
                borderRadius: '2px',
                cursor: 'pointer',
                background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                color: isSelected ? 'var(--on-accent)' : 'var(--text-primary)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.9rem',
                fontWeight: isSelected ? 700 : 400,
                transition: 'all 0.1s',
              }}
            >
              {formatValue ? formatValue(value) : value}
            </button>
          )
        })}
      </div>

      {onCustomValue && (
        <button
          onClick={onCustomValue}
          style={{
            marginTop: '16px',
            minHeight: '44px',
            background: 'none',
            border: '1px dashed var(--border-2)',
            borderRadius: '2px',
            color: 'var(--text-secondary)',
            fontFamily: 'Space Mono, monospace',
            fontSize: '0.6rem',
            letterSpacing: '0.08em',
            padding: '8px 20px',
            cursor: 'pointer',
          }}
        >
          {t('customValue')}
        </button>
      )}
    </div>
  )
}
