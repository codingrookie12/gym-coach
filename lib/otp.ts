// Supabase's configured email-OTP length is a per-project dashboard setting
// (default 6, but configurable) — this repo has no local auth config that
// pins it, so the login UI must not hardcode an exact length. MIN is the
// lowest length Supabase will ever send; MAX is a generous ceiling so a
// longer configured code (e.g. 8 digits, observed on the disposable
// gym-coach-dev test project) is never silently truncated into an invalid
// code. The actual correctness check always happens server-side in
// supabase.auth.verifyOtp — this only avoids destroying valid input client-side.
export const MIN_OTP_LENGTH = 6
export const MAX_OTP_LENGTH = 10

export function sanitizeOtpInput(value: string, maxLength: number = MAX_OTP_LENGTH): string {
  return value.replace(/\D/g, '').slice(0, maxLength)
}
