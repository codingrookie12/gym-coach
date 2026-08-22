import { describe, it, expect } from 'vitest'
import { computeDataMaturity } from '../dataMaturity'

describe('computeDataMaturity', () => {
  it('is limited-history for a very new account', () => {
    expect(computeDataMaturity(0)).toBe('limited-history')
    expect(computeDataMaturity(3)).toBe('limited-history')
  })

  it('is developing for a mid-history account', () => {
    expect(computeDataMaturity(4)).toBe('developing')
    expect(computeDataMaturity(11)).toBe('developing')
  })

  it('is established once history accrues past the threshold', () => {
    expect(computeDataMaturity(12)).toBe('established')
    expect(computeDataMaturity(200)).toBe('established')
  })
})
