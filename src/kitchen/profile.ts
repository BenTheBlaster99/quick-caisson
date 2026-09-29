import type { KitchenProfile } from './types'

/** Defaults for a straight kitchen. A saved file keeps its own copy. */
export function defaultKitchenProfile(): KitchenProfile {
  return {
    id: 'kitchen-default',
    version: 1,
    carcassMm: 18,
    backMm: 8,
    upperHeightMm: 720,
    worktopOverhangMm: 20,
    backsplashMm: 10,
    towerGapMm: 20,
    evierMinMm: 600,
    plaqueMinMm: 600,
    fourMinMm: 600,
    laveVaisselleMinMm: 600,
    frigoMinMm: 600,
  }
}

const BOUNDS = {
  carcassMm: { min: 8, max: 40 },
  backMm: { min: 3, max: 20 },
  upperHeightMm: { min: 400, max: 1200 },
  worktopOverhangMm: { min: 0, max: 50 },
  backsplashMm: { min: 0, max: 30 },
  towerGapMm: { min: 0, max: 80 },
  evierMinMm: { min: 300, max: 1200 },
  plaqueMinMm: { min: 300, max: 1200 },
  fourMinMm: { min: 300, max: 1200 },
  laveVaisselleMinMm: { min: 300, max: 1200 },
  frigoMinMm: { min: 300, max: 1200 },
} as const

export function readKitchenProfile(value: unknown): KitchenProfile {
  if (value === undefined) return defaultKitchenProfile()
  if (!isRecord(value)) throw new Error('Profil cuisine illisible.')
  if (value.version !== undefined && value.version !== 1) throw new Error('Version de profil cuisine inconnue.')
  const next: KitchenProfile = { ...defaultKitchenProfile(), version: 1 }
  if (typeof value.id === 'string' && value.id.trim()) next.id = value.id.trim()
  for (const field of Object.keys(BOUNDS) as (keyof typeof BOUNDS)[]) {
    if (value[field] === undefined) continue
    const raw = value[field]
    const bound = BOUNDS[field]
    if (!Number.isInteger(raw) || (raw as number) < bound.min || (raw as number) > bound.max) {
      throw new Error(`Profil cuisine : ${field} hors ${bound.min}–${bound.max}.`)
    }
    next[field] = raw as number
  }
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
