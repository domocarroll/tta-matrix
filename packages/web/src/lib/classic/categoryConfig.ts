// Ported from v0-thetipanalyser/utils/categoryUtils.ts
import type { RaceCategory } from './types'

interface CategoryConfig {
  name: string
  color: string
  bgColor: string
}

export const categoryConfig: Record<RaceCategory, CategoryConfig> = {
  SR: { name: 'Sydney', color: '#4285f4', bgColor: 'rgba(66, 133, 244, 0.1)' },
  MR: { name: 'Melbourne', color: 'oklch(0.6 0.2 150)', bgColor: 'oklch(0.6 0.2 150 / 0.1)' },
  BR: { name: 'Brisbane', color: '#e94e37', bgColor: 'rgba(233, 78, 55, 0.1)' },
  PR: { name: 'Perth', color: 'oklch(0.7 0.15 95)', bgColor: 'oklch(0.7 0.15 95 / 0.1)' },
  AR: { name: 'Adelaide', color: 'oklch(0.5 0.25 302)', bgColor: 'oklch(0.5 0.25 302 / 0.1)' },
  OR: { name: 'Other', color: '#5f6368', bgColor: 'rgba(95, 99, 104, 0.1)' }
}

export const CATEGORY_ORDER: RaceCategory[] = ['SR', 'MR', 'BR', 'PR', 'AR', 'OR']

export const getCategoryName = (category: RaceCategory): string =>
  categoryConfig[category]?.name || 'Unknown'
