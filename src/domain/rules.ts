import { defaultProfile } from './profile'
import type { DoorFinishId, FinishId } from './types'

const defaults = defaultProfile()

/** Default carcass thickness. Layout and the cut list read the project snapshot. */
export const PANEL = defaults.carcassMm
/** Default back panel and drawer bottom. */
export const BACK = defaults.backMm
export const SHELF_SETBACK = defaults.shelfSetbackMm
export const DRAWER_DEPTH_INSET = defaults.drawerDepthInsetMm
/** Drawer box is this much shorter than its front. */
export const DRAWER_BOX_SHORT = defaults.drawerBoxShortMm
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
export const DOOR_SPLIT = defaults.doorSplitMm
export const HANGING_MIN = defaults.hangingMinMm
export const HANGING_MAX = defaults.hangingMaxMm
export const HANGING_DEFAULT = defaults.hangingDefaultMm
export const DRAWER_THICKNESSES = [16, 18] as const

export const LIMITS = {
  width: { min: 600, max: 6000, label: 'Largeur' },
  height: { min: 1800, max: 3600, label: 'Hauteur' },
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

export const DOOR_FINISHES: { id: DoorFinishId; name: string; color: string }[] = [
  ...FINISHES,
  { id: 'verre', name: 'verre', color: '#d5ebe8' },
]

export function finishById(id: FinishId) {
  return FINISHES.find((finish) => finish.id === id) ?? FINISHES[0]
}

export function doorFinishById(id: DoorFinishId) {
  return DOOR_FINISHES.find((finish) => finish.id === id) ?? DOOR_FINISHES[0]
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
