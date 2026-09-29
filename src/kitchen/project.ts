import { createId } from '../domain/project'
import { inspectKitchen, resizeKitchenWall } from './layout'
import { readKitchenFinish } from './finishes'
import { defaultKitchenProfile, readKitchenProfile } from './profile'
import type {
  BaseRole,
  HandleId,
  KitchenColumn,
  KitchenProject,
  KitchenWall,
  Opening,
  OpeningKind,
  TowerRole,
  UpperRole,
} from './types'

const HANDLES: HandleId[] = ['aucune', 'integre', 'bouton', 'barre']
const BASES: BaseRole[] = ['porte', 'tiroirs', 'evier', 'plaque', 'four', 'four-plaque', 'lave-vaisselle', 'bouteilles']
const UPPERS: UpperRole[] = ['aucun', 'haut', 'hotte', 'vitrine', 'micro-ondes']
const TOWERS: TowerRole[] = ['frigo', 'rangement']
const OPENINGS: OpeningKind[] = ['fenetre', 'porte', 'interdit']

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
    wall,
    openings: [
      { id: 'o1', kind: 'fenetre', x: 1200, width: 1400, bottom: 1100, height: 1000 },
    ],
    columns: [
      column('k1', 600, { base: 'porte', upper: 'haut' }),
      column('k2', 600, { base: 'tiroirs', upper: 'haut' }),
      column('k3', 800, { base: 'evier', upper: 'aucun' }),
      column('k4', 600, { base: 'four-plaque', upper: 'aucun' }),
      column('k5', 400, { base: 'bouteilles', upper: 'haut' }),
      column('k6', 600, { kind: 'colonne', tower: 'frigo', upper: 'aucun' }),
    ],
    finish: 'blanc',
    rules: defaultKitchenProfile(),
  }
}

function column(
  id: string,
  width: number,
  options: Partial<Pick<KitchenColumn, 'kind' | 'base' | 'tower' | 'upper' | 'handle' | 'locked'>> = {},
): KitchenColumn {
  return {
    id,
    width,
    locked: options.locked ?? false,
    kind: options.kind ?? 'bas',
    base: options.base ?? 'porte',
    tower: options.tower ?? 'frigo',
    upper: options.kind === 'colonne' ? 'aucun' : (options.upper ?? 'haut'),
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
  if (!Array.isArray(data.openings)) throw new Error('Ouvertures illisibles.')
  if (!Array.isArray(data.columns) || data.columns.length === 0) throw new Error('La cuisine doit contenir au moins un meuble.')
  const openings = data.openings.map((item, index) => readOpening(item, index, wall))
  const columns = data.columns.map((item, index) => readColumn(item, index))
  const project: KitchenProject = { format: 'kitchen-project', version: 1, name, wall, openings, columns, finish, rules }
  const broken = inspectKitchen(project).issues.find((issue) => issue.message.startsWith('La somme'))
  if (broken) throw new Error(broken.message)
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

export function addOpening(project: KitchenProject, kind: OpeningKind): KitchenEdit {
  const width = kind === 'porte' ? 800 : kind === 'fenetre' ? 1200 : 400
  const bottom = kind === 'porte' ? 0 : kind === 'fenetre' ? 1000 : 0
  const height = kind === 'porte' ? 2100 : kind === 'fenetre' ? 1000 : 800
  const x = Math.max(0, Math.min(project.wall.width - width, Math.round(project.wall.width / 3)))
  if (width > project.wall.width || bottom + height > project.wall.ceilingHeight) {
    return { ok: false, error: 'Ouverture refusée : elle ne tient pas dans ce mur.' }
  }
  const opening: Opening = { id: createId(), kind, x, width, bottom, height }
  return { ok: true, project: { ...project, openings: [...project.openings, opening] } }
}

export function updateOpening(project: KitchenProject, id: string, patch: Partial<Pick<Opening, 'x' | 'width' | 'bottom' | 'height' | 'kind'>>): KitchenEdit {
  const current = project.openings.find((opening) => opening.id === id)
  if (!current) return { ok: false, error: 'Ouverture introuvable.' }
  const next = { ...current, ...patch }
  const error = openingError(next, project.wall)
  if (error) return { ok: false, error }
  return {
    ok: true,
    project: { ...project, openings: project.openings.map((opening) => (opening.id === id ? next : opening)) },
  }
}

export function removeOpening(project: KitchenProject, id: string): KitchenProject {
  return { ...project, openings: project.openings.filter((opening) => opening.id !== id) }
}

function openingError(opening: Opening, wall: KitchenWall): string | null {
  if (!Number.isInteger(opening.x) || !Number.isInteger(opening.width) || !Number.isInteger(opening.bottom) || !Number.isInteger(opening.height)) {
    return 'Ouverture : indiquez des millimètres entiers.'
  }
  if (opening.width < 100 || opening.height < 100) return 'Ouverture : 100 mm minimum.'
  if (opening.x < 0 || opening.x + opening.width > wall.width) return 'Ouverture : elle sort de la largeur du mur.'
  if (opening.bottom < 0 || opening.bottom + opening.height > wall.ceilingHeight) return 'Ouverture : elle sort de la hauteur du mur.'
  return null
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

function readOpening(value: unknown, index: number, wall: KitchenWall): Opening {
  if (!isRecord(value)) throw new Error(`Ouverture ${index + 1} illisible.`)
  const opening: Opening = {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `o${index + 1}`,
    kind: readEnum(value.kind, OPENINGS, `Ouverture ${index + 1} : type inconnu.`),
    x: value.x as number,
    width: value.width as number,
    bottom: value.bottom as number,
    height: value.height as number,
  }
  const error = openingError(opening, wall)
  if (error) throw new Error(error)
  return opening
}

function readColumn(value: unknown, index: number): KitchenColumn {
  if (!isRecord(value)) throw new Error(`Meuble ${index + 1} illisible.`)
  const width = value.width
  if (!Number.isInteger(width) || (width as number) < 300 || (width as number) > 1200) {
    throw new Error(`Meuble ${index + 1} : largeur hors 300–1200 mm.`)
  }
  const kind = value.kind === 'colonne' ? 'colonne' : 'bas'
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `k${index + 1}`,
    width: width as number,
    locked: value.locked === true,
    kind,
    base: readEnum(value.base ?? 'porte', BASES, `Meuble ${index + 1} : type bas inconnu.`),
    tower: readEnum(value.tower ?? 'frigo', TOWERS, `Meuble ${index + 1} : colonne inconnue.`),
    upper: kind === 'colonne' ? 'aucun' : readEnum(value.upper ?? 'aucun', UPPERS, `Meuble ${index + 1} : haut inconnu.`),
    handle: readEnum(value.handle ?? 'bouton', HANDLES, `Meuble ${index + 1} : poignée inconnue.`),
  }
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T
  throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
