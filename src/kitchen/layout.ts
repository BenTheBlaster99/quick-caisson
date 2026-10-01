import { MIN_CAISSON, MAX_CAISSON } from '../domain/rules'
import { cornerInset, slideAlong, wallLength } from './room'
import type {
  BaseRole,
  KitchenColumn,
  KitchenIssue,
  KitchenProfile,
  KitchenProject,
  KitchenWall,
  Opening,
  UpperRole,
  WallId,
} from './types'

export const COLUMN_MIN = MIN_CAISSON
export const COLUMN_MAX = MAX_CAISSON

export type Span = { x: number; width: number; bottom: number; top: number }

export type PlacedColumn = KitchenColumn & { x: number }

export type WorktopRun = { wallId: WallId; x: number; width: number }

export function worktopTop(wall: KitchenWall): number {
  return wall.plinthHeight + wall.baseHeight + wall.worktopThickness
}

export function upperSpan(wall: KitchenWall, rules: KitchenProfile, x: number, width: number): Span {
  const bottom = worktopTop(wall) + wall.backsplashHeight
  return { x, width, bottom, top: bottom + rules.upperHeightMm }
}

export function baseSpan(wall: KitchenWall, x: number, width: number): Span {
  return { x, width, bottom: 0, top: worktopTop(wall) }
}

export function towerSpan(wall: KitchenWall, rules: KitchenProfile, x: number, width: number): Span {
  return { x, width, bottom: 0, top: Math.max(0, wall.ceilingHeight - rules.towerGapMm) }
}

export function overlaps(a: Span, opening: Opening): boolean {
  const xHit = a.x < opening.x + opening.width && a.x + a.width > opening.x
  const yHit = a.bottom < opening.bottom + opening.height && a.top > opening.bottom
  return xHit && yHit
}

export function placeColumns(columns: KitchenColumn[]): PlacedColumn[] {
  return columns.map((column) => ({ ...column }))
}

export function worktopRuns(columns: KitchenColumn[]): WorktopRun[] {
  const runs: WorktopRun[] = []
  const walls = [...new Set(columns.map((column) => column.wallId))]
  for (const wallId of walls) {
    const sorted = columns.filter((column) => column.wallId === wallId).sort((a, b) => a.x - b.x)
    let run: WorktopRun | null = null
    for (const column of sorted) {
      if (column.kind !== 'bas') {
        if (run) runs.push(run)
        run = null
        continue
      }
      if (run && column.x <= run.x + run.width + 2) run.width = column.x + column.width - run.x
      else {
        if (run) runs.push(run)
        run = { wallId, x: column.x, width: column.width }
      }
    }
    if (run) runs.push(run)
  }
  return runs
}

function applianceMin(role: BaseRole, rules: KitchenProfile): number | null {
  if (role === 'evier') return rules.evierMinMm
  if (role === 'plaque' || role === 'four-plaque') return rules.plaqueMinMm
  if (role === 'four') return rules.fourMinMm
  if (role === 'lave-vaisselle') return rules.laveVaisselleMinMm
  return null
}

function overlapWidth(a: { x: number; width: number }, opening: Opening): number {
  const left = Math.max(a.x, opening.x)
  const right = Math.min(a.x + a.width, opening.x + opening.width)
  return Math.max(0, right - left)
}

function note(issues: KitchenIssue[], issue: KitchenIssue) {
  const seen = issues.some((item) => item.columnId === issue.columnId && item.part === issue.part && item.message === issue.message)
  if (!seen) issues.push(issue)
}

export function inspectKitchen(project: KitchenProject): { placed: PlacedColumn[]; issues: KitchenIssue[] } {
  const placed = placeColumns(project.columns.filter((column) => column.wallId !== 'ilot' || project.room.island))
  const issues: KitchenIssue[] = []
  const top = worktopTop(project.wall)

  placed.forEach((column, index) => {
    const label = `Meuble ${index + 1}`
    const length = wallLength(project, column.wallId)
    const inset = cornerInset(project, column.wallId)
    if (column.x < inset || column.x + column.width > length) {
      note(issues, {
        level: 'refus',
        columnId: column.id,
        part: 'meuble',
        overlapMm: column.x < inset ? inset - column.x : column.x + column.width - length,
        message: column.x < inset
          ? `${label} entre dans l'angle de ${inset - column.x} mm.`
          : `${label} dépasse le mur de ${column.x + column.width - length} mm.`,
      })
    }
    for (const other of placed) {
      if (other.wallId !== column.wallId || other.id >= column.id) continue
      const overlap = Math.min(column.x + column.width, other.x + other.width) - Math.max(column.x, other.x)
      if (overlap > 0) {
        note(issues, {
          level: 'refus',
          columnId: column.id,
          part: 'meuble',
          overlapMm: overlap,
          message: `${label} chevauche un autre meuble de ${overlap} mm.`,
        })
      }
    }
    if (column.kind === 'colonne') {
      if (column.tower === 'frigo' && column.width < project.rules.frigoMinMm) {
        note(issues, {
          level: 'refus',
          columnId: column.id,
          part: 'meuble',
          overlapMm: project.rules.frigoMinMm - column.width,
          message: `${label} : le frigo demande ${project.rules.frigoMinMm} mm, ce meuble fait ${column.width} mm.`,
        })
      }
      const body = towerSpan(project.wall, project.rules, column.x, column.width)
      for (const opening of project.openings) {
        if (opening.wallId !== column.wallId) continue
        if (!overlaps(body, opening)) continue
        const mm = overlapWidth(body, opening)
        note(issues, {
          level: 'refus',
          columnId: column.id,
          part: 'meuble',
          overlapMm: mm,
          message: `${label} empiète de ${mm} mm sur ${openingName(opening.kind)}.`,
        })
      }
      noteSwing(issues, column, project, label, top)
      return
    }

    const needed = applianceMin(column.base, project.rules)
    if (needed !== null && column.width < needed) {
      note(issues, {
        level: 'refus',
        columnId: column.id,
        part: 'meuble',
        overlapMm: needed - column.width,
        message: `${label} : ${baseLabel(column.base)} demande ${needed} mm, ce meuble fait ${column.width} mm.`,
      })
    }

    const body = baseSpan(project.wall, column.x, column.width)
    for (const opening of project.openings) {
        if (opening.wallId !== column.wallId) continue
      const across = overlapWidth(body, opening)
      if (across <= 0) continue
      if (opening.kind === 'fenetre') {
        if (opening.bottom < top) {
          note(issues, {
            level: 'refus',
            columnId: column.id,
            part: 'meuble',
            overlapMm: top - opening.bottom,
            message: `${label} : la fenêtre descend de ${top - opening.bottom} mm sous le plan.`,
          })
        }
        continue
      }
      if (overlaps(body, opening)) {
        note(issues, {
          level: 'refus',
          columnId: column.id,
          part: 'meuble',
          overlapMm: across,
          message: `${label} empiète de ${across} mm sur ${openingName(opening.kind)}.`,
        })
      }
    }

    if ((column.base === 'plaque' || column.base === 'four-plaque') && (column.upper === 'haut' || column.upper === 'vitrine' || column.upper === 'micro-ondes')) {
      note(issues, {
        level: 'attention',
        columnId: column.id,
        part: 'haut',
        overlapMm: null,
        message: `${label} : la plaque est sous un meuble haut. Il faut une hotte, ou aucun haut.`,
      })
    }

    if (column.upper !== 'aucun') {
      const upper = upperSpan(project.wall, project.rules, column.x, column.width)
      for (const opening of project.openings) {
        if (opening.wallId !== column.wallId) continue
        if (!overlaps(upper, opening)) continue
        const mm = overlapWidth(upper, opening)
        note(issues, {
          level: 'refus',
          columnId: column.id,
          part: 'haut',
          overlapMm: mm,
          message: `${label} : le meuble haut empiète de ${mm} mm sur ${openingName(opening.kind)}.`,
        })
      }
    }
    noteSwing(issues, column, project, label, top)
  })

  return { placed, issues }
}

function noteSwing(issues: KitchenIssue[], column: PlacedColumn, project: KitchenProject, label: string, top: number) {
  if (!hingedFront(column)) return
  for (const opening of project.openings) {
        if (opening.wallId !== column.wallId) continue
    if (opening.kind !== 'porte' || opening.bottom >= top) continue
    const gapRight = opening.x - (column.x + column.width)
    const gapLeft = column.x - (opening.x + opening.width)
    const touching = (gapRight >= 0 && gapRight <= 40) || (gapLeft >= 0 && gapLeft <= 40)
    if (!touching) continue
    note(issues, {
      level: 'attention',
      columnId: column.id,
      part: 'meuble',
      overlapMm: null,
      message: `${label} : la porte du mur est contre la façade. Elle ne s'ouvre pas entièrement.`,
    })
  }
}

function hingedFront(column: KitchenColumn): boolean {
  if (column.kind === 'colonne') return column.tower === 'rangement'
  return column.base === 'porte' || column.base === 'evier' || column.base === 'bouteilles'
}

export function canCorrectIssue(issue: KitchenIssue): boolean {
  if (issue.columnId === null) return false
  if (issue.level === 'refus' && issue.part === 'haut') return true
  return issue.level === 'attention' && /hotte/.test(issue.message)
}

export function openingName(kind: Opening['kind']): string {
  if (kind === 'fenetre') return 'la fenêtre'
  if (kind === 'porte') return 'la porte'
  return 'la zone interdite'
}

export function baseLabel(role: BaseRole): string {
  if (role === 'porte') return 'la porte'
  if (role === 'tiroirs') return 'les tiroirs'
  if (role === 'evier') return "l'évier"
  if (role === 'plaque') return 'la plaque'
  if (role === 'four') return 'le four'
  if (role === 'four-plaque') return 'le four et la plaque'
  if (role === 'lave-vaisselle') return 'le lave-vaisselle'
  return 'le rangement bouteilles'
}

export function shortBase(role: BaseRole): string {
  if (role === 'porte') return 'Porte'
  if (role === 'tiroirs') return 'Tiroirs'
  if (role === 'evier') return 'Évier'
  if (role === 'plaque') return 'Plaque'
  if (role === 'four') return 'Four'
  if (role === 'four-plaque') return 'Four + plaque'
  if (role === 'lave-vaisselle') return 'Lave-vaisselle'
  return 'Bouteilles'
}

export function moduleTitle(column: KitchenColumn): string {
  if (column.kind === 'colonne') return column.tower === 'frigo' ? 'Frigo' : 'Colonne'
  if (column.upper === 'aucun') return shortBase(column.base)
  return `${shortBase(column.base)} · ${upperLabel(column.upper)}`
}

export function upperLabel(role: UpperRole): string {
  if (role === 'aucun') return 'Aucun haut'
  if (role === 'hotte') return 'Hotte'
  if (role === 'vitrine') return 'Vitrine'
  if (role === 'micro-ondes') return 'Micro-ondes'
  return 'Haut'
}

export function setColumnWidth(project: KitchenProject, index: number, width: number): { ok: true; columns: KitchenColumn[] } | { ok: false; error: string } {
  const column = project.columns[index]
  if (!column) return { ok: false, error: 'Meuble introuvable.' }
  if (!Number.isInteger(width) || width < COLUMN_MIN || width > COLUMN_MAX) {
    return { ok: false, error: `Largeur : la limite est ${COLUMN_MIN}–${COLUMN_MAX} mm.` }
  }
  const room = wallLength(project, column.wallId)
  if (column.x + width > room) return { ok: false, error: `Largeur refusée : le meuble sortirait du mur.` }
  return { ok: true, columns: project.columns.map((item, cursor) => (cursor === index ? { ...item, width } : item)) }
}

export function resizeKitchenWall(project: KitchenProject, _width: number): { ok: true; columns: KitchenColumn[] } | { ok: false; error: string } {
  return { ok: true, columns: project.columns }
}

export function placeColumn(project: KitchenProject, id: string, x: number): KitchenColumn[] {
  const column = project.columns.find((item) => item.id === id)
  if (!column || column.locked) return project.columns
  const mates = project.columns.filter((item) => item.wallId === column.wallId)
  const next = slideAlong(mates, id, column.width, x, cornerInset(project, column.wallId), wallLength(project, column.wallId))
  return project.columns.map((item) => (item.id === id ? { ...item, x: next } : item))
}

export function addKitchenColumn(
  project: KitchenProject,
  wallId: WallId,
  createId: () => string,
): { ok: true; columns: KitchenColumn[]; selectedIndex: number } | { ok: false; error: string } {
  const length = wallLength(project, wallId)
  const inset = cornerInset(project, wallId)
  const blocked = [
    ...project.columns.filter((column) => column.wallId === wallId).map((column) => ({ x: column.x, width: column.width })),
    ...project.openings.filter((opening) => opening.wallId === wallId && opening.kind !== 'fenetre').map((opening) => ({ x: opening.x, width: opening.width })),
  ].sort((a, b) => a.x - b.x)
  let cursor = inset
  let spot = -1
  let width = 600
  for (const item of blocked) {
    if (item.x - cursor >= 300) {
      spot = cursor
      width = Math.min(600, item.x - cursor)
      break
    }
    cursor = Math.max(cursor, item.x + item.width)
  }
  if (spot < 0 && length - cursor >= 300) {
    spot = cursor
    width = Math.min(600, length - cursor)
  }
  if (spot < 0 || width < COLUMN_MIN) return { ok: false, error: 'Ajout refusé : pas de place libre de 300 mm sur ce mur.' }
  const created: KitchenColumn = {
    id: createId(),
    wallId,
    x: spot,
    width,
    locked: false,
    kind: 'bas',
    base: 'porte',
    tower: 'frigo',
    upper: 'aucun',
    handle: 'bouton',
  }
  const columns = [...project.columns, created]
  return { ok: true, columns, selectedIndex: columns.length - 1 }
}

export function removeKitchenColumn(
  columns: KitchenColumn[],
  index: number,
): { ok: true; columns: KitchenColumn[]; selectedIndex: number } | { ok: false; error: string } {
  if (columns.length <= 1) return { ok: false, error: 'Suppression refusée : il reste un seul meuble.' }
  if (index < 0 || index >= columns.length) return { ok: false, error: 'Meuble introuvable.' }
  const next = columns.filter((_, cursor) => cursor !== index)
  return { ok: true, columns: next, selectedIndex: Math.min(index, next.length - 1) }
}
