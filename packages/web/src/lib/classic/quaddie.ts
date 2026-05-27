// Ported from v0-thetipanalyser/utils/calculateQuaddie.ts
import type { AggregatedRace, RaceCategory } from '@tta/shared'

export interface QuaddieEntry {
  category: RaceCategory
  races: AggregatedRace[]
}

/**
 * Last 4 races per category (need >= 4), top 3 horses each by total tips.
 */
export function getQuaddieSelections(races: ReadonlyArray<AggregatedRace>): QuaddieEntry[] {
  const racesByCategory: Partial<Record<RaceCategory, AggregatedRace[]>> = {}
  races.forEach((race) => {
    if (!racesByCategory[race.category]) racesByCategory[race.category] = []
    racesByCategory[race.category]!.push(race)
  })

  const quaddieData: QuaddieEntry[] = []
  for (const category in racesByCategory) {
    const cat = category as RaceCategory
    const categoryRaces = racesByCategory[cat]!
    const validRaces = categoryRaces.filter((r) => r.raceNumber >= 1 && r.raceNumber <= 10)
    if (validRaces.length >= 4) {
      const sortedRaces = [...validRaces].sort((a, b) => a.raceNumber - b.raceNumber)
      const lastFourRaces = sortedRaces.slice(-4)
      const quaddieRaces = lastFourRaces.map((race) => ({
        ...race,
        tips: race.tips.slice(0, 3)
      }))
      quaddieData.push({ category: cat, races: quaddieRaces })
    }
  }
  return quaddieData
}
