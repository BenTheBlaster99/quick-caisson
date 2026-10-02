import { createId } from '../domain/project'
import { placeColumn, resizeKitchenWall } from './layout'
import { readKitchenFinish, readWallFinish } from './finishes'
import { defaultKitchenProfile, readKitchenProfile } from './profile'
import { defaultRoom, wallLength, WALLS } from './room'
import type {
  BaseRole,
  DeckRole,
  HandleId,
  KitchenColumn,
  KitchenProject,
  KitchenRoom,
  KitchenShape,
  KitchenWall,
  LSide,
  Opening,
  OpeningKind,
  TowerRole,
  UpperRole,
  WallFinishId,
  WallId,
} from './types'

const HANDLES: HandleId[] = ['aucune', 'bouton', 'barre']
const BASES: BaseRole[] = ['porte', 'tiroirs', 'four', 'lave-vaisselle']
const UPPERS: UpperRole[] = ['aucun', 'haut', 'hotte', 'vitrine', 'micro-ondes']
const TOWERS: TowerRole[] = ['frigo', 'rangement']
const OPENINGS: OpeningKind[] = ['fenetre', 'porte', 'interdit']
const SHAPES: KitchenShape[] = ['lineaire', 'l', 'u']
const SIDES: LSide[] = ['gauche', 'droite']

const WALL_LIMITS: Record<keyof KitchenWall, { min: number; max: number; label: string }> = {
  width: { min: 1800, max: 6000, label: 'Largeur' },
  ceilingHeight: { min: 2200, max: 3000, label: 'Hauteur sous plafond' },
  baseDepth: { min: 450, max: 700, label: 'Profondeur bas' },
  upperDepth: { min: 250, max: 450, label: 'Profondeur haut' },
  baseHeight: { min: 600, max: 900, label: 'Hauteur des bas' },
  plinthHeight: { min: 0, max: 200, label: 'Socle' },
  worktopThickness: { min: 20, max: 60, label: 'Épaisseur du plan' },
  backsplashHeight: { min: 0, max: 800, label: 'Hauteur de crédence' },
}

export function kitchenWallLimits() {
  return WALL_LIMITS
}

export type KitchenEdit = { ok: true; project: KitchenProject } | { ok: false; error: string }

export function defaultKitchen(): KitchenProject {
  const wall: KitchenWall = {
    width: 3600,
    ceilingHeight: 2500,
    baseDepth: 560,
    upperDepth: 350,
    baseHeight: 720,
    plinthHeight: 100,
    worktopThickness: 38,
    backsplashHeight: 600,
  }
  return {
    format: 'kitchen-project',
    version: 1,
    name: 'Cuisine',
    room: defaultRoom(3600),
    wall,
    openings: [
      { id: 'o1', wallId: 'A', kind: 'fenetre', x: 1200, width: 1400, bottom: 1100, height: 1000, swing: 'gauche' },
    ],
    columns: [
      column('k1', 'A', 0, 600, { base: 'porte', upper: 'haut' }),
      column('k2', 'A', 600, 600, { base: 'tiroirs', upper: 'haut' }),
      column('k3', 'A', 1200, 800, { base: 'porte', deck: 'evier', upper: 'aucun' }),
      column('k4', 'A', 2000, 600, { base: 'four', deck: 'plaque', upper: 'aucun' }),
      column('k5', 'A', 2600, 400, { base: 'porte', upper: 'haut' }),
      column('k6', 'A', 3000, 600, { kind: 'colonne', tower: 'frigo', upper: 'aucun' }),
      column('b1', 'B', 560, 600, { base: 'porte', upper: 'haut' }),
      column('b2', 'B', 1160, 600, { kind: 'colonne', tower: 'rangement', upper: 'aucun' }),
      column('i1', 'ilot', 0, 700, { base: 'porte', upper: 'aucun' }),
      column('i2', 'ilot', 700, 700, { base: 'tiroirs', upper: 'aucun' }),
    ],
    finish: 'blanc',
    rules: defaultKitchenProfile(),
  }
}

function column(
  id: string,
  wallId: WallId,
  x: number,
  width: number,
  options: Partial<Pick<KitchenColumn, 'kind' | 'base' | 'deck' | 'returnWall' | 'tower' | 'upper' | 'handle' | 'locked'>> = {},
): KitchenColumn {
  const kind = options.kind ?? 'bas'
  return {
    id,
    wallId,
    x,
    width,
    locked: options.locked ?? false,
    kind,
    base: options.base ?? 'porte',
    deck: options.deck ?? 'rien',
    returnWall: options.returnWall ?? 'B',
    tower: options.tower ?? 'frigo',
    upper: kind === 'bas' ? (options.upper ?? 'haut') : 'aucun',
    handle: options.handle ?? 'bouton',
  }
}

export function serializeKitchen(project: KitchenProject): string {
  return JSON.stringify(project, null, 2)
}

export function parseKitchen(text: string): KitchenProject {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Ce fichier ne peut pas être lu.')
  }
  if (!isRecord(data) || data.format !== 'kitchen-project' || data.version !== 1) {
    throw new Error("Ce fichier n'est pas une cuisine Caisson.")
  }
  const wall = readWall(data.wall)
  const rules = readKitchenProfile(data.rules)
  const finish = readKitchenFinish(data.finish)
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Cuisine'
  const room = readRoom(data.room, wall.width)
  if (!Array.isArray(data.openings)) throw new Error('Ouvertures illisibles.')
  if (!Array.isArray(data.columns) || data.columns.length === 0) throw new Error('La cuisine doit contenir au moins un meuble.')
  const openings = data.openings
    .map((item, index) => readOpening(item, index, { room, wall }))
    .filter((opening) => opening.wallId !== 'D')
  const columns = fillX(data.columns.map((item, index) => readColumn(item, index)))
  const project: KitchenProject = { format: 'kitchen-project', version: 1, name, room, wall, openings, columns, finish, rules }
  return project
}

export function setKitchenWall(project: KitchenProject, field: keyof KitchenWall, value: number): KitchenEdit {
  const limit = WALL_LIMITS[field]
  if (!Number.isInteger(value) || value < limit.min || value > limit.max) {
    return { ok: false, error: `${limit.label} : la limite est ${limit.min}–${limit.max} mm.` }
  }
  if (field !== 'width') return { ok: true, project: { ...project, wall: { ...project.wall, [field]: value } } }
  const resized = resizeKitchenWall(project, value)
  if (!resized.ok) return resized
  return { ok: true, project: { ...project, wall: { ...project.wall, width: value }, columns: resized.columns } }
}

export function setRoomDepth(project: KitchenProject, depth: number): KitchenEdit {
  if (!Number.isInteger(depth) || depth < 1800 || depth > 6000) {
    return { ok: false, error: 'Profondeur : la limite est 1800–6000 mm.' }
  }
  return { ok: true, project: { ...project, room: { ...project.room, depth } } }
}

export function setShape(project: KitchenProject, shape: KitchenShape): KitchenProject {
  return { ...project, room: { ...project.room, shape } }
}

export function setLSide(project: KitchenProject, lSide: LSide): KitchenProject {
  return { ...project, room: { ...project.room, lSide } }
}

export function setIsland(project: KitchenProject, island: boolean): KitchenProject {
  return { ...project, room: { ...project.room, island } }
}

export function setWallFinish(project: KitchenProject, wallId: 'A' | 'B' | 'C' | 'D', finish: WallFinishId): KitchenProject {
  return { ...project, room: { ...project.room, finishes: { ...project.room.finishes, [wallId]: finish } } }
}

export function moveColumn(project: KitchenProject, id: string, x: number): KitchenProject {
  return { ...project, columns: placeColumn(project, id, x) }
}

export function moveIsland(project: KitchenProject, x: number, z: number): KitchenProject {
  const ix = Math.round(Math.max(400, Math.min(x, project.wall.width - project.room.islandLength - 400)))
  const iz = Math.round(Math.max(project.wall.baseDepth + 200, Math.min(z, project.room.depth - project.room.islandDepth - 200)))
  return { ...project, room: { ...project.room, islandX: ix, islandZ: iz } }
}

export function addOpening(project: KitchenProject, kind: OpeningKind, wallId: WallId = 'A'): KitchenEdit {
  const length = wallLength(project, wallId)
  const width = kind === 'porte' ? 800 : kind === 'fenetre' ? 1200 : 400
  const bottom = kind === 'porte' ? 0 : kind === 'fenetre' ? 1000 : 0
  const height = kind === 'porte' ? 2100 : kind === 'fenetre' ? 1000 : 800
  const x = Math.max(0, Math.min(length - width, Math.round(length / 3)))
  const opening: Opening = { id: createId(), wallId, kind, x, width, bottom, height, swing: 'gauche' }
  const error = openingError(opening, project)
  if (error) return { ok: false, error: 'Ouverture refusée : elle ne tient pas dans ce mur.' }
  return { ok: true, project: { ...project, openings: [...project.openings, opening] } }
}

export function updateOpening(project: KitchenProject, id: string, patch: Partial<Pick<Opening, 'wallId' | 'x' | 'width' | 'bottom' | 'height' | 'kind' | 'swing'>>): KitchenEdit {
  const current = project.openings.find((opening) => opening.id === id)
  if (!current) return { ok: false, error: 'Ouverture introuvable.' }
  const next = { ...current, ...patch }
  if (next.kind === 'porte') next.bottom = 0
  const error = openingError(next, project)
  if (error) return { ok: false, error }
  return {
    ok: true,
    project: { ...project, openings: project.openings.map((opening) => (opening.id === id ? next : opening)) },
  }
}

export function removeOpening(project: KitchenProject, id: string): KitchenProject {
  return { ...project, openings: project.openings.filter((opening) => opening.id !== id) }
}

function openingError(opening: Opening, project: Pick<KitchenProject, 'room' | 'wall'>): string | null {
  if (opening.wallId === 'ilot' || opening.wallId === 'D') return 'Ouverture : ce mur n’existe pas.'
  if (!Number.isInteger(opening.x) || !Number.isInteger(opening.width) || !Number.isInteger(opening.bottom) || !Number.isInteger(opening.height)) {
    return 'Ouverture : indiquez des millimètres entiers.'
  }
  if (opening.width < 100 || opening.height < 100) return 'Ouverture : 100 mm minimum.'
  if (opening.x < 0 || opening.x + opening.width > wallLength(project, opening.wallId)) return 'Ouverture : elle sort de la largeur du mur.'
  if (opening.bottom < 0 || opening.bottom + opening.height > project.wall.ceilingHeight) return 'Ouverture : elle sort de la hauteur du mur.'
  return null
}

function readRoom(value: unknown, width: number): KitchenRoom {
  if (!isRecord(value)) return { ...defaultRoom(width), shape: 'lineaire', island: false }
  const shape = readEnum(value.shape ?? 'lineaire', SHAPES, 'Forme de cuisine inconnue.')
  const depth = integerBetween(value.depth, 1800, 6000, 'Profondeur hors 1800–6000 mm.')
  const island = value.island === true
  const islandLength = integerBetween(value.islandLength ?? 1400, 900, 2400, 'Longueur d’îlot hors 900–2400 mm.')
  const islandDepth = integerBetween(value.islandDepth ?? 700, 500, 1200, 'Profondeur d’îlot hors 500–1200 mm.')
  const islandX = integerBetween(value.islandX ?? Math.round((width - islandLength) / 2), 0, width, 'Position d’îlot hors de la pièce.')
  const islandZ = integerBetween(value.islandZ ?? 1500, 0, depth, 'Position d’îlot hors de la pièce.')
  const lSide = value.lSide === 'droite' ? 'droite' : readEnum(value.lSide ?? 'gauche', SIDES, 'Côté du L inconnu.')
  const finishes = {
    A: readWallFinish(isRecord(value.finishes) ? value.finishes.A : undefined),
    B: readWallFinish(isRecord(value.finishes) ? value.finishes.B : undefined),
    C: readWallFinish(isRecord(value.finishes) ? value.finishes.C : undefined),
    D: readWallFinish(isRecord(value.finishes) ? value.finishes.D : undefined),
  }
  return { shape, depth, island, islandLength, islandDepth, islandX, islandZ, lSide, finishes }
}

function integerBetween(value: unknown, min: number, max: number, message: string): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(message)
  return value as number
}

function readWall(value: unknown): KitchenWall {
  if (!isRecord(value)) throw new Error('Mur cuisine manquant.')
  const wall = {} as KitchenWall
  for (const field of Object.keys(WALL_LIMITS) as (keyof KitchenWall)[]) {
    const limit = WALL_LIMITS[field]
    const raw = value[field]
    if (!Number.isInteger(raw) || (raw as number) < limit.min || (raw as number) > limit.max) {
      throw new Error(`${limit.label} hors ${limit.min}–${limit.max} mm.`)
    }
    wall[field] = raw as number
  }
  return wall
}

function readOpening(value: unknown, index: number, project: Pick<KitchenProject, 'room' | 'wall'>): Opening {
  if (!isRecord(value)) throw new Error(`Ouverture ${index + 1} illisible.`)
  const wallId = typeof value.wallId === 'string' && (WALLS as readonly string[]).includes(value.wallId) && value.wallId !== 'ilot'
    ? value.wallId as WallId
    : 'A'
  const opening: Opening = {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `o${index + 1}`,
    wallId,
    kind: readEnum(value.kind, OPENINGS, `Ouverture ${index + 1} : type inconnu.`),
    x: value.x as number,
    width: value.width as number,
    bottom: value.bottom as number,
    height: value.height as number,
    swing: value.swing === 'droite' ? 'droite' : 'gauche',
  }
  const error = openingError(opening, project)
  if (error) throw new Error(error)
  return opening
}

function readColumn(value: unknown, index: number): KitchenColumn {
  if (!isRecord(value)) throw new Error(`Meuble ${index + 1} illisible.`)
  const width = value.width
  if (!Number.isInteger(width) || (width as number) < 300 || (width as number) > 1200) {
    throw new Error(`Meuble ${index + 1} : largeur hors 300–1200 mm.`)
  }
  const kind = value.kind === 'colonne' ? 'colonne' : value.kind === 'angle' ? 'angle' : 'bas'
  const wallId = typeof value.wallId === 'string' && (WALLS as readonly string[]).includes(value.wallId)
    ? value.wallId as WallId
    : 'A'
  const front = readFront(value.base, index)
  const deck = value.deck === 'evier' || value.deck === 'plaque' || value.deck === 'rien'
    ? value.deck
    : front.deck
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `k${index + 1}`,
    wallId,
    x: Number.isInteger(value.x) ? value.x as number : -1,
    width: width as number,
    locked: value.locked === true,
    kind,
    base: front.base,
    deck,
    returnWall: value.returnWall === 'C' ? 'C' : 'B',
    tower: readEnum(value.tower ?? 'frigo', TOWERS, `Meuble ${index + 1} : colonne inconnue.`),
    upper: kind === 'bas' ? readEnum(value.upper ?? 'aucun', UPPERS, `Meuble ${index + 1} : haut inconnu.`) : 'aucun',
    handle: readHandle(value.handle),
  }
}

function readFront(value: unknown, index: number): { base: BaseRole; deck: DeckRole } {
  if (value === 'evier') return { base: 'porte', deck: 'evier' }
  if (value === 'plaque') return { base: 'tiroirs', deck: 'plaque' }
  if (value === 'four-plaque') return { base: 'four', deck: 'plaque' }
  if (value === 'bouteilles' || value === 'porte' || value == null) return { base: 'porte', deck: 'rien' }
  if (value === 'integre') return { base: 'porte', deck: 'rien' }
  return { base: readEnum(value, BASES, `Meuble ${index + 1} : type bas inconnu.`), deck: 'rien' }
}

function readHandle(value: unknown): HandleId {
  if (value === 'integre') return 'aucune'
  if (value == null) return 'bouton'
  return readEnum(value, HANDLES, 'Poignée inconnue.')
}

function fillX(columns: KitchenColumn[]): KitchenColumn[] {
  const cursors: Partial<Record<WallId, number>> = {}
  return columns.map((column) => {
    if (column.x >= 0) {
      cursors[column.wallId] = Math.max(cursors[column.wallId] ?? 0, column.x + column.width)
      return column
    }
    const x = cursors[column.wallId] ?? 0
    cursors[column.wallId] = x + column.width
    return { ...column, x }
  })
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T
  throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
