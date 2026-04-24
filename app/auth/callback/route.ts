import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    // Capture cookies to set — must go on the response, not next/headers,
    // otherwise they are not sent to the browser on a redirect response.
    const captured: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(c => captured.push(c))
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // On Vercel, x-forwarded-host carries the real public hostname so the
      // redirect lands on the same deployment the user started on.
      const host = request.headers.get('x-forwarded-host') ?? new URL(request.url).host
      const proto = request.headers.get('x-forwarded-proto') ?? 'https'
      const redirectTo =
        process.env.NODE_ENV === 'development'
          ? `${origin}/`
          : `${proto}://${host}/`

      const response = NextResponse.redirect(redirectTo)
      captured.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      )
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
