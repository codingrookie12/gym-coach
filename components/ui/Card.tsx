'use client'

import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'accent' | 'rust'
  grain?: boolean
}

/**
 * components/ui/Card — Phase 1: thin wrapper around the existing
 * `.card` / `.card-accent` / `.card-rust` classes (app/globals.css).
 * `grain` opts into the grain-texture overlay (`.grain` + `::after`) —
 * requires `position: relative` on the card, which this component sets.
 */
export default function Card({ variant = 'default', grain = false, className, style, ...rest }: CardProps) {
  const base = variant === 'default' ? 'card' : variant === 'accent' ? 'card-accent' : 'card-rust'
  const classes = [base, grain ? 'grain' : '', className].filter(Boolean).join(' ')
  return <div className={classes} style={{ position: 'relative', ...style }} {...rest} />
}
