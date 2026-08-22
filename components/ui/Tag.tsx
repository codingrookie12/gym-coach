'use client'

import type { HTMLAttributes } from 'react'

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'rust'
}

/**
 * components/ui/Tag — Phase 1: thin wrapper around the existing `.tag`
 * class (app/globals.css) — used for badges (e.g. GYM-48 coaching
 * annotations via components/ui/coachingVisuals.ts's `badgeVariant`,
 * Phase 5's usage-count/Community-Pick badges).
 */
export default function Tag({ variant = 'default', className, ...rest }: TagProps) {
  const modifier = variant === 'default' ? '' : ` ${variant}`
  const classes = `tag${modifier}${className ? ` ${className}` : ''}`
  return <span className={classes} {...rest} />
}
