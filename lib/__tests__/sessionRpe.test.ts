/**
 * Session-level RPE single-tap picker (PreSaveSummaryScreen's RPE_CHOICES
 * buttons, Borg CR10-style 1-10). Extracted to toggleSessionRpe so the tap
 * interaction has coverage without a DOM harness (this repo has none — see
 * tests/login-otp-input.test.ts's docstring for the same rationale).
 */
import { describe, it, expect } from 'vitest'
import { toggleSessionRpe } from '../sessionRpe'

describe('toggleSessionRpe', () => {
  it('tapping an unselected value selects it', () => {
    expect(toggleSessionRpe(null, 7)).toBe(7)
  })

  it('tapping the currently-selected value deselects it (re-tap toggles off)', () => {
    expect(toggleSessionRpe(7, 7)).toBeNull()
  })

  it('tapping a different value while one is selected switches the selection', () => {
    expect(toggleSessionRpe(3, 8)).toBe(8)
  })

  it('covers the full 1-10 Borg CR10 range', () => {
    for (let v = 1; v <= 10; v++) {
      expect(toggleSessionRpe(null, v)).toBe(v)
      expect(toggleSessionRpe(v, v)).toBeNull()
    }
  })
})
