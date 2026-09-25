import { redistribute, sumWidths, wallResizeError, wallWidthRange } from './caissons'
import { applyShelfCount } from './layout'
import { HANGING_DEFAULT, HANGING_MAX, HANGING_MIN, LIMITS, type WallField } from './rules'
import type { Caisson, DoorFinishId, DoorMode, DrawerThickness, FinishId, Project, RailMode, Wall } from './types'

const RAILS: RailMode[] = ['aucune', 'haute', 'basse', 'double']
const DOORS: DoorMode[] = ['aucune', 'battante', 'vitree']
const FINISHES: FinishId[] = ['blanc', 'chene', 'anthracite']
const DOOR_FINISHES: DoorFinishId[] = ['blanc', 'chene', 'anthracite', 'verre']

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultProject(): Project {
  const wall: Wall = {
    width: 3200,
    height: 2500,
    depth: 600,
    socle: 80,
    ceilingGap: 20,
  }
  const seeds = [
    caisson('c1', 800, { shelves: 5 }),
    caisson('c2', 800, { rail: 'double' }),
    caisson('c3', 800, { drawers: 4 }),
    caisson('c4', 800, { shelves: 1, drawers: 2, pantalonniere: true }),
  ]
  return {
    format: 'caisson-project',
    version: 1,
    wall,
    finish: 'chene',
    caissons: seeds.map((item) => applyShelfCount(wall, item, item.shelves)),
  }
}

function caisson(
  id: string,
  width: number,
  options: Partial<Pick<Caisson, 'shelves' | 'rail' | 'drawers' | 'pantalonniere' | 'door' | 'doorFinish' | 'drawerThickness' | 'hangingGap'>> = {},
): Caisson {
  return {
    id,
    width,
    shelves: options.shelves ?? 0,
    shelfGaps: [],
    rail: options.rail ?? 'aucune',
    hangingGap: options.hangingGap ?? HANGING_DEFAULT,
    drawers: options.drawers ?? 0,
    drawerThickness: options.drawerThickness ?? 18,
    door: options.door ?? 'battante',
    doorFinish: options.doorFinish ?? 'chene',
    pantalonniere: options.pantalonniere ?? false,
  }
}

export function usableHeightOf(project: Project): number {
  const wall = project.wall
  return wall.height - wall.socle - wall.ceilingGap
}

export type EditResult = { ok: true; project: Project } | { ok: false; error: string }

export function setWallField(project: Project, field: WallField, value: number): EditResult {
  if (!Number.isInteger(value)) {
    return { ok: false, error: `${LIMITS[field].label} : indiquez un nombre entier de millimètres.` }
  }
  const limit = LIMITS[field]
  const range = field === 'width' ? wallWidthRange(project.caissons.length) : limit
  if (value < range.min || value > range.max) {
    if (field === 'width') return { ok: false, error: wallResizeError(project.caissons.length) }
    return {
      ok: false,
      error: `${limit.label} : la limite est ${limit.min}–${limit.max} mm.`,
    }
  }

  const wall: Wall = { ...project.wall, [field]: value }
  if (field !== 'width') return { ok: true, project: { ...project, wall } }

  const widths = redistribute(
    project.caissons.map((item) => item.width),
    value,
  )
  if (!widths) return { ok: false, error: wallResizeError(project.caissons.length) }

  return {
    ok: true,
    project: {
      ...project,
      wall,
      caissons: project.caissons.map((item, index) => ({ ...item, width: widths[index] })),
    },
  }
}

export function applyWidths(project: Project, widths: number[]): Project {
  return {
    ...project,
    caissons: project.caissons.map((item, index) => ({ ...item, width: widths[index] })),
  }
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2)
}

export function parseProject(text: string): Project {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Ce fichier ne peut pas être lu.')
  }
  if (!isRecord(data)) throw new Error('Fichier illisible.')
  if (data.format !== 'caisson-project' || data.version !== 1) {
    throw new Error("Ce fichier n'est pas un projet Caisson.")
  }

  const wall = readWall(data.wall)
  const finish = readEnum(data.finish, FINISHES, 'Finition inconnue.')
  const legacyDoor = legacyDoorMode(data.front)
  if (!Array.isArray(data.caissons) || data.caissons.length === 0) {
    throw new Error('Le projet doit contenir au moins un caisson.')
  }

  const caissons = data.caissons.map((item, index) => readCaisson(item, index, wall, finish, legacyDoor))
  const total = sumWidths(caissons.map((item) => item.width))
  if (total !== wall.width) {
    throw new Error(`La somme des caissons (${total} mm) ne vaut pas la largeur du mur (${wall.width} mm).`)
  }

  return { format: 'caisson-project', version: 1, wall, finish, caissons }
}

function readWall(value: unknown): Wall {
  if (!isRecord(value)) throw new Error('Mur manquant.')
  return {
    width: readLimit(value.width, 'width'),
    height: readLimit(value.height, 'height'),
    depth: readLimit(value.depth, 'depth'),
    socle: readLimit(value.socle, 'socle'),
    ceilingGap: readLimit(value.ceilingGap, 'ceilingGap'),
  }
}

function readLimit(value: unknown, field: WallField): number {
  const limit = LIMITS[field]
  if (!Number.isInteger(value) || (value as number) < limit.min || (value as number) > limit.max) {
    throw new Error(`${limit.label} hors limites (${limit.min}–${limit.max} mm).`)
  }
  return value as number
}

function legacyDoorMode(value: unknown): DoorMode {
  if (value === 'aucune') return 'aucune'
  if (value === 'battantes' || value === 'coulissantes') return 'battante'
  return 'battante'
}

function readCaisson(
  value: unknown,
  index: number,
  wall: Wall,
  carcass: FinishId,
  legacyDoor: DoorMode,
): Caisson {
  if (!isRecord(value)) throw new Error(`Caisson ${index + 1} illisible.`)
  const id = typeof value.id === 'string' && value.id.trim() ? value.id : `c${index + 1}`
  const width = value.width
  if (!Number.isInteger(width) || (width as number) < 300 || (width as number) > 1200) {
    throw new Error(`Caisson ${index + 1} : largeur hors 300–1200 mm.`)
  }
  const shelves = value.shelves
  const drawers = value.drawers
  if (!Number.isInteger(shelves) || (shelves as number) < 0 || (shelves as number) > 8) {
    throw new Error(`Caisson ${index + 1} : étagères hors 0–8.`)
  }
  if (!Number.isInteger(drawers) || (drawers as number) < 0 || (drawers as number) > 6) {
    throw new Error(`Caisson ${index + 1} : tiroirs hors 0–6.`)
  }
  const pantalonniere = typeof value.pantalonniere === 'boolean' ? value.pantalonniere : false
  const door = value.door === undefined ? legacyDoor : readEnum(value.door, DOORS, `Caisson ${index + 1} : porte inconnue.`)
  const doorFinish =
    value.doorFinish === undefined
      ? carcass
      : readEnum(value.doorFinish, DOOR_FINISHES, `Caisson ${index + 1} : finition de porte inconnue.`)
  const hangingGap = readHanging(value.hangingGap)
  const drawerThickness = readDrawerThickness(value.drawerThickness)
  const base: Caisson = {
    id,
    width: width as number,
    shelves: shelves as number,
    shelfGaps: [],
    rail: readEnum(value.rail, RAILS, `Caisson ${index + 1} : tringle inconnue.`),
    hangingGap,
    drawers: drawers as number,
    drawerThickness,
    door,
    doorFinish,
    pantalonniere,
  }
  const gaps = readShelfGaps(value.shelfGaps, shelves as number)
  if (!gaps) return applyShelfCount(wall, base, shelves as number)
  return { ...base, shelfGaps: gaps }
}

function readHanging(value: unknown): number {
  if (value === undefined) return HANGING_DEFAULT
  if (!Number.isInteger(value) || (value as number) < HANGING_MIN || (value as number) > HANGING_MAX) {
    throw new Error(`Vide sous la tringle hors ${HANGING_MIN}–${HANGING_MAX} mm.`)
  }
  return value as number
}

function readDrawerThickness(value: unknown): DrawerThickness {
  if (value === undefined || value === 18) return 18
  if (value === 16) return 16
  throw new Error('Épaisseur des tiroirs : 16 ou 18 mm.')
}

function readShelfGaps(value: unknown, shelves: number): number[] | null {
  if (value === undefined) return null
  if (!Array.isArray(value) || value.length !== shelves) return null
  if (!value.every((gap) => Number.isInteger(gap) && (gap as number) >= 0)) {
    throw new Error('Écarts d’étagères illisibles.')
  }
  return value as number[]
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T
  throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
