export type RailMode = 'aucune' | 'haute' | 'basse' | 'double'
export type FrontMode = 'aucune' | 'battantes' | 'coulissantes'
export type FinishId = 'blanc' | 'chene' | 'anthracite'

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
  rail: RailMode
  drawers: number
  pantalonniere: boolean
}

export type Project = {
  format: 'caisson-project'
  version: 1
  wall: Wall
  front: FrontMode
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
