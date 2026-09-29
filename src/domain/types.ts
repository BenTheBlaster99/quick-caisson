import type { RuleProfile } from './profile'

export type RailMode = 'aucune' | 'haute' | 'basse' | 'double'
export type DoorMode = 'aucune' | 'battante' | 'vitree' | 'coulissante'
export type FinishId = 'blanc' | 'chene' | 'anthracite'
export type DoorFinishId = FinishId | 'verre'
export type DrawerThickness = 16 | 18

export type Wall = {
  width: number
  height: number
  depth: number
  socle: number
  ceilingGap: number
}

export type Caisson = {
  id: string
  width: number
  shelves: number
  /** Gap under each shelf, from the shelf below or from the bottom of the free zone. */
  shelfGaps: number[]
  rail: RailMode
  /** Empty height under the rail, in mm. Used when a rail is present. */
  hangingGap: number
  drawers: number
  drawerThickness: DrawerThickness
  door: DoorMode
  doorFinish: DoorFinishId
  pantalonniere: boolean
  /** When true, wall and neighbour edits leave this width alone. */
  locked: boolean
}

export type Project = {
  format: 'caisson-project'
  version: 2
  wall: Wall
  finish: FinishId
  caissons: Caisson[]
  /** Construction snapshot. Reopening a file uses this copy, not today's defaults. */
  rules: RuleProfile
}

export type CutRow = {
  caisson: string
  caissonIndex: number
  role: string
  roleOrder: number
  quantity: number
  length: number | null
  width: number | null
  thickness: number | null
  material: string
  edges: string
}
