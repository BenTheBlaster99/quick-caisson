export type RuleProfile = {
  id: string
  version: 1
  carcassMm: number
  shelfMm: number
  backMm: number
  shelfSetbackMm: number
  drawerDepthInsetMm: number
  drawerBoxShortMm: number
  doorSplitMm: number
  hangingMinMm: number
  hangingMaxMm: number
  hangingDefaultMm: number
  /** How far two sliding leaves overlap. Hinged doors ignore it. */
  slidingOverlapMm: number
}

/** Sarah's dressing defaults. A saved project keeps its own copy of these numbers. */
export function defaultProfile(): RuleProfile {
  return {
    id: 'caisson-default',
    version: 1,
    carcassMm: 18,
    shelfMm: 18,
    backMm: 8,
    shelfSetbackMm: 20,
    drawerDepthInsetMm: 50,
    drawerBoxShortMm: 20,
    doorSplitMm: 600,
    hangingMinMm: 400,
    hangingMaxMm: 1600,
    hangingDefaultMm: 900,
    slidingOverlapMm: 30,
  }
}

const BOUNDS: Record<Exclude<keyof RuleProfile, 'id' | 'version'>, { min: number; max: number }> = {
  carcassMm: { min: 8, max: 40 },
  shelfMm: { min: 8, max: 40 },
  backMm: { min: 3, max: 20 },
  shelfSetbackMm: { min: 0, max: 80 },
  drawerDepthInsetMm: { min: 0, max: 120 },
  drawerBoxShortMm: { min: 0, max: 80 },
  doorSplitMm: { min: 200, max: 2000 },
  hangingMinMm: { min: 0, max: 3000 },
  hangingMaxMm: { min: 0, max: 3000 },
  hangingDefaultMm: { min: 0, max: 3000 },
  slidingOverlapMm: { min: 0, max: 80 },
}

export function profileBound(field: keyof typeof BOUNDS): { min: number; max: number } {
  return BOUNDS[field]
}

export function readProfile(value: unknown): RuleProfile {
  if (value === undefined) return defaultProfile()
  if (!isRecord(value)) throw new Error('Profil de règles illisible.')
  if (value.version !== undefined && value.version !== 1) throw new Error('Version de profil inconnue.')
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : defaultProfile().id
  const next: RuleProfile = { ...defaultProfile(), id, version: 1 }
  for (const field of Object.keys(BOUNDS) as (keyof typeof BOUNDS)[]) {
    if (value[field] === undefined) continue
    const raw = value[field]
    const bound = BOUNDS[field]
    if (!Number.isInteger(raw) || (raw as number) < bound.min || (raw as number) > bound.max) {
      throw new Error(`Profil : ${field} hors ${bound.min}–${bound.max}.`)
    }
    next[field] = raw as number
  }
  if (next.hangingMinMm > next.hangingDefaultMm || next.hangingDefaultMm > next.hangingMaxMm) {
    throw new Error('Profil : le vide sous la tringle est hors de ses limites.')
  }
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
