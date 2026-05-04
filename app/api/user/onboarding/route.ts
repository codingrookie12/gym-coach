import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ onboardingCompleted: true })

  const { data, error } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to read onboarding_completed:', error.message)
    return NextResponse.json({ onboardingCompleted: true })
  }

  return NextResponse.json({ onboardingCompleted: data?.onboarding_completed ?? true })
}

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('users')
    .update({ onboarding_completed: true })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to mark onboarding complete:', error.message)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
