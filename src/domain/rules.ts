import type { FinishId } from './types'

/** Carcass, shelves, doors, drawer fronts and drawer boxes. */
export const PANEL = 18
/** Back panel and drawer bottom. */
export const BACK = 8
export const SHELF_SETBACK = 20
export const DRAWER_DEPTH_INSET = 50
/** Drawer box is this much shorter than its front. */
export const DRAWER_BOX_SHORT = 20
export const RAIL_DIAMETER = 25
/** Drop from the underside of the top panel. */
export const RAIL_HIGH_DROP = 80
export const MIN_CAISSON = 300
export const MAX_CAISSON = 1200
export const MIN_SHELVES = 0
export const MAX_SHELVES = 8
export const MIN_DRAWERS = 0
export const MAX_DRAWERS = 6
/** Nominal front height when the column is not drawers-only. */
export const NOMINAL_DRAWER = 200
/** Kept above the drawers when shelves or a rail share the column. */
export const MIN_FREE = 280
/** Nominal pull-out zone for a pantalonnière. */
export const PANTO_ZONE = 800
export const DOOR_SPLIT = 600
export const SLIDING_SPLIT = 2400

export const LIMITS = {
  width: { min: 600, max: 6000, label: 'Largeur' },
  height: { min: 1800, max: 2800, label: 'Hauteur' },
  depth: { min: 300, max: 700, label: 'Profondeur' },
  socle: { min: 0, max: 200, label: 'Socle' },
  ceilingGap: { min: 0, max: 300, label: 'Jeu au plafond' },
} as const

export type WallField = keyof typeof LIMITS

export const FINISHES: { id: FinishId; name: string; color: string }[] = [
  { id: 'blanc', name: 'Blanc', color: '#f3f0e8' },
  { id: 'chene', name: 'Chêne', color: '#c6a36a' },
  { id: 'anthracite', name: 'Anthracite', color: '#3e4246' },
]

export function finishById(id: FinishId) {
  return FINISHES.find((finish) => finish.id === id) ?? FINISHES[0]
}

export function splitEven(total: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(total / count)
  let remainder = total - base * count
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    return base + extra
  })
}
