'use client'

import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

/**
 * components/ui/Button — Phase 1: thin, typed wrapper around the existing
 * `.btn-primary` / `.btn-secondary` token-driven classes (app/globals.css).
 * Both classes already carry `min-height: 44px` (Phase 1 tap-target fix).
 * Not a rewrite of the visual language — a real component so future
 * screens `import Button` instead of re-typing `className="btn-primary"`
 * + inline overrides by hand, same as every other components/ui/ primitive.
 */
export default function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  const base = variant === 'primary' ? 'btn-primary' : 'btn-secondary'
  return <button className={className ? `${base} ${className}` : base} {...rest} />
}
