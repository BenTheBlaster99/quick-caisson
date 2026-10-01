export type HandleId = 'aucune' | 'integre' | 'bouton' | 'barre'
export type KitchenFinishId = 'blanc' | 'chene-clair' | 'chene' | 'chene-fonce' | 'gris' | 'noir'
export type WallFinishId = 'blanc' | 'greige' | 'sable' | 'gris' | 'sauge' | 'bleu' | 'terre' | 'noir' | 'carrelage' | 'beton' | 'bois'
export type OpeningKind = 'fenetre' | 'porte' | 'interdit'
export type BaseRole = 'porte' | 'tiroirs' | 'evier' | 'plaque' | 'four' | 'four-plaque' | 'lave-vaisselle' | 'bouteilles'
export type UpperRole = 'aucun' | 'haut' | 'hotte' | 'vitrine' | 'micro-ondes'
export type TowerRole = 'frigo' | 'rangement'
export type KitchenShape = 'lineaire' | 'l' | 'u'
export type WallId = 'A' | 'B' | 'C' | 'D' | 'ilot'

export type KitchenWall = {
  width: number
  ceilingHeight: number
  baseDepth: number
  upperDepth: number
  baseHeight: number
  plinthHeight: number
  worktopThickness: number
  backsplashHeight: number
}

export type WallFinishes = Record<'A' | 'B' | 'C' | 'D', WallFinishId>

export type KitchenRoom = {
  shape: KitchenShape
  depth: number
  island: boolean
  islandLength: number
  islandDepth: number
  islandX: number
  islandZ: number
  finishes: WallFinishes
}

export type Opening = {
  id: string
  wallId: WallId
  kind: OpeningKind
  x: number
  width: number
  bottom: number
  height: number
}

export type KitchenColumn = {
  id: string
  wallId: WallId
  x: number
  width: number
  locked: boolean
  kind: 'bas' | 'colonne'
  base: BaseRole
  tower: TowerRole
  upper: UpperRole
  handle: HandleId
}

export type KitchenProfile = {
  id: string
  version: 1
  carcassMm: number
  backMm: number
  upperHeightMm: number
  worktopOverhangMm: number
  backsplashMm: number
  towerGapMm: number
  evierMinMm: number
  plaqueMinMm: number
  fourMinMm: number
  laveVaisselleMinMm: number
  frigoMinMm: number
}

export type KitchenProject = {
  format: 'kitchen-project'
  version: 1
  name: string
  room: KitchenRoom
  wall: KitchenWall
  openings: Opening[]
  columns: KitchenColumn[]
  finish: KitchenFinishId
  rules: KitchenProfile
}

export type KitchenIssue = {
  level: 'refus' | 'attention'
  columnId: string | null
  part: 'meuble' | 'haut' | null
  overlapMm: number | null
  message: string
}
