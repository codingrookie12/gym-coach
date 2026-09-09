// Session-level RPE (Borg CR10-style, 1-10) single-tap picker logic —
// PreSaveSummaryScreen's RPE_CHOICES buttons. Extracted as a pure function so
// the tap interaction (select / re-tap-to-deselect / switch) has direct
// regression coverage without a DOM/RTL harness — this repo has neither
// (see tests/login-otp-input.test.ts's docstring for the same rationale).
export function toggleSessionRpe(current: number | null, tapped: number): number | null {
  return current === tapped ? null : tapped
}
