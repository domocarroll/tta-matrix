import { describe, expect, it } from 'vitest'
import { sanitiseRaces } from '../sanitiseRaces.ts'

describe('sanitiseRaces', () => {
  it('passes valid 1-indexed races through untouched', () => {
    const races = [{ raceNumber: 1 }, { raceNumber: 10 }]
    const out = sanitiseRaces(races)
    expect(out.races).toEqual(races)
    expect(out.flags).toEqual([])
  })

  it('drops race 0 and flags it', () => {
    const out = sanitiseRaces([{ raceNumber: 0 }, { raceNumber: 2 }])
    expect(out.races).toEqual([{ raceNumber: 2 }])
    expect(out.flags).toHaveLength(1)
    expect(out.flags[0].type).toBe('anomaly')
    expect(out.flags[0].description).toContain('0')
  })

  it('drops negative, fractional, and missing race numbers', () => {
    const out = sanitiseRaces([
      { raceNumber: -1 },
      { raceNumber: 2.5 },
      {},
      { raceNumber: 3 }
    ])
    expect(out.races).toEqual([{ raceNumber: 3 }])
    expect(out.flags).toHaveLength(3)
  })

  it('coerces numeric string race numbers', () => {
    const out = sanitiseRaces([{ raceNumber: '4' as unknown as number }])
    expect(out.races).toEqual([{ raceNumber: 4 }])
    expect(out.flags).toEqual([])
  })

  it('drops non-numeric strings', () => {
    const out = sanitiseRaces([{ raceNumber: 'R1' as unknown as number }])
    expect(out.races).toEqual([])
    expect(out.flags).toHaveLength(1)
  })

  it('handles null/undefined input', () => {
    expect(sanitiseRaces(undefined).races).toEqual([])
    expect(sanitiseRaces(null).races).toEqual([])
  })
})
