export type RailMode = 'aucune' | 'haute' | 'basse' | 'double'
export type DoorMode = 'aucune' | 'battante' | 'vitree'
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
}

export type Project = {
  format: 'caisson-project'
  version: 1
  wall: Wall
  finish: FinishId
  caissons: Caisson[]
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
