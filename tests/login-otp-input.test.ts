/**
 * GYM — login OTP input sanitation
 *
 * Regression guard for the manual-entry code field on app/login/page.tsx.
 * Supabase's email-OTP length is a per-project dashboard setting (default 6,
 * but configurable) — a disposable test project was found configured to 8.
 * This repo has no local auth config pinning the value, so the input must
 * not hardcode/truncate to exactly 6 digits, or a longer configured code
 * would be silently cut down to an invalid one on every login attempt
 * (typed or autofilled) with no working fallback for email sign-in.
 *
 * Pure-function test only — no React rendering (no jsdom/RTL in this repo).
 */
import { describe, it, expect } from 'vitest'
import { sanitizeOtpInput, MIN_OTP_LENGTH, MAX_OTP_LENGTH } from '@/lib/otp'

describe('sanitizeOtpInput', () => {
  it('strips non-digit characters', () => {
    expect(sanitizeOtpInput('12-34 56')).toBe('123456')
  })

  it('does not truncate an 8-digit code (the observed dev-project length)', () => {
    expect(sanitizeOtpInput('12345678')).toBe('12345678')
  })

  it('truncates at the generous MAX_OTP_LENGTH ceiling, not at 6', () => {
    const tooLong = '1'.repeat(MAX_OTP_LENGTH + 5)
    const result = sanitizeOtpInput(tooLong)
    expect(result).toHaveLength(MAX_OTP_LENGTH)
  })

  it('MIN/MAX bounds are sane (6-digit default is within range)', () => {
    expect(MIN_OTP_LENGTH).toBe(6)
    expect(MAX_OTP_LENGTH).toBeGreaterThanOrEqual(8)
    expect(MAX_OTP_LENGTH).toBeGreaterThanOrEqual(MIN_OTP_LENGTH)
  })

  it('passes a full paste/autofill value through unchanged when within bounds', () => {
    expect(sanitizeOtpInput('654321')).toBe('654321')
  })
})
