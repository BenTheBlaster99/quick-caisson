import { MIN_CAISSON, MAX_CAISSON } from '../domain/rules'
import { cornerInset, footprint, slideAlong, wallLength } from './room'
import type {
  BaseRole,
  DeckRole,
  KitchenColumn,
  KitchenIssue,
  KitchenProfile,
  KitchenProject,
  KitchenWall,
  Opening,
  TowerRole,
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
      if (column.kind === 'colonne') {
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

export type KitchenAdd =
  | { kind: 'bas'; base: BaseRole; deck: DeckRole }
  | { kind: 'colonne'; tower: TowerRole }
  | { kind: 'angle'; returnWall: 'B' | 'C' }

export function returnOccupancy(project: KitchenProject, wallId: WallId): { id: string; x: number; width: number }[] {
  return project.columns
    .filter((column) => column.kind === 'angle' && column.returnWall === wallId)
    .map((column) => ({ id: column.id, x: 0, width: column.width }))
}

export function cutRun(x: number, width: number, holes: { x: number; width: number }[]): { x: number; width: number }[] {
  const end = x + width
  const cuts = holes
    .map((hole) => ({ x: Math.max(x, hole.x), end: Math.min(end, hole.x + hole.width) }))
    .filter((hole) => hole.end - hole.x > 0)
    .sort((a, b) => a.x - b.x)
  const parts: { x: number; width: number }[] = []
  let cursor = x
  for (const hole of cuts) {
    if (hole.x - cursor > 2) parts.push({ x: cursor, width: hole.x - cursor })
    cursor = Math.max(cursor, hole.end)
  }
  if (end - cursor > 2) parts.push({ x: cursor, width: end - cursor })
  return parts
}

function applianceNeed(column: KitchenColumn, rules: KitchenProfile): { mm: number; name: string } | null {
  const needs: { mm: number; name: string }[] = []
  if (column.deck === 'evier') needs.push({ mm: rules.evierMinMm, name: "l'évier" })
  if (column.deck === 'plaque') needs.push({ mm: rules.plaqueMinMm, name: 'la plaque' })
  if (column.base === 'four') needs.push({ mm: rules.fourMinMm, name: 'le four' })
  if (column.base === 'lave-vaisselle') needs.push({ mm: rules.laveVaisselleMinMm, name: 'le lave-vaisselle' })
  if (needs.length === 0) return null
  return needs.sort((a, b) => b.mm - a.mm)[0]!
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
    for (const block of returnOccupancy(project, column.wallId)) {
      if (block.id === column.id) continue
      const overlap = Math.min(column.x + column.width, block.x + block.width) - Math.max(column.x, block.x)
      if (overlap > 0) {
        note(issues, {
          level: 'refus',
          columnId: column.id,
          part: 'meuble',
          overlapMm: overlap,
          message: `${label} entre dans le meuble d'angle de ${overlap} mm.`,
        })
      }
    }
    if (column.kind === 'angle') {
      const along = wallLength(project, 'A')
      const expected = column.returnWall === 'C' ? along - column.width : 0
      if (column.wallId !== 'A' || column.x !== expected) {
        note(issues, {
          level: 'refus',
          columnId: column.id,
          part: 'meuble',
          overlapMm: Math.abs(column.x - expected),
          message: `${label} : le meuble d'angle doit rester dans l'angle.`,
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
      noteDoor(issues, column, project, label, top)
      return
    }

    const needed = applianceNeed(column, project.rules)
    if (needed !== null && column.width < needed.mm) {
      note(issues, {
        level: 'refus',
        columnId: column.id,
        part: 'meuble',
        overlapMm: needed.mm - column.width,
        message: `${label} : ${needed.name} demande ${needed.mm} mm, ce meuble fait ${column.width} mm.`,
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

    if (column.deck === 'plaque' && (column.upper === 'haut' || column.upper === 'vitrine' || column.upper === 'micro-ondes')) {
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
    noteDoor(issues, column, project, label, top)
  })

  return { placed, issues }
}

function noteDoor(issues: KitchenIssue[], column: PlacedColumn, project: KitchenProject, label: string, top: number) {
  const boxes = columnBoxes(project, column)
  for (const opening of project.openings) {
    if (opening.kind !== 'porte' || opening.bottom >= top) continue
    if (opening.wallId === column.wallId && hingedFront(column)) {
      const gap = opening.swing === 'droite'
        ? column.x - (opening.x + opening.width)
        : opening.x - (column.x + column.width)
      if (gap >= 0 && gap <= 40) {
        note(issues, {
          level: 'attention',
          columnId: column.id,
          part: 'meuble',
          overlapMm: null,
          message: `${label} : la charnière est de ce côté. La porte du mur ne s'ouvre pas entièrement.`,
        })
      }
    }
    if (opening.wallId === column.wallId) continue
    const sweep = footprint(project.room, project.wall.width, opening.wallId, opening.x, opening.width, opening.width)
    for (const box of boxes) {
      const overlap = rectOverlap(box, sweep)
      if (overlap <= 0) continue
      const side = opening.swing === 'droite' ? 'droite' : 'gauche'
      note(issues, {
        level: 'attention',
        columnId: column.id,
        part: 'meuble',
        overlapMm: overlap,
        message: `${label} : la porte, charnière à ${side}, couvre ce meuble de ${overlap} mm.`,
      })
    }
  }
}

function columnBoxes(project: KitchenProject, column: PlacedColumn): { x: number; z: number; w: number; d: number }[] {
  const into = column.wallId === 'ilot' ? project.room.islandDepth : project.wall.baseDepth
  const boxes = [footprint(project.room, project.wall.width, column.wallId, column.x, column.width, into)]
  if (column.kind === 'angle') {
    boxes.push(footprint(project.room, project.wall.width, column.returnWall, 0, column.width, into))
  }
  return boxes
}

function rectOverlap(
  a: { x: number; z: number; w: number; d: number },
  b: { x: number; z: number; w: number; d: number },
): number {
  const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const z = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z)
  if (x <= 0 || z <= 0) return 0
  return Math.round(Math.min(x, z))
}

function hingedFront(column: KitchenColumn): boolean {
  if (column.kind === 'colonne') return column.tower === 'rangement'
  return column.base === 'porte'
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
  if (role === 'four') return 'le four'
  return 'le lave-vaisselle'
}

export function shortBase(role: BaseRole): string {
  if (role === 'porte') return 'Porte'
  if (role === 'tiroirs') return 'Tiroirs'
  if (role === 'four') return 'Four'
  return 'Lave-vaisselle'
}

export function moduleTitle(column: KitchenColumn): string {
  if (column.kind === 'angle') return 'Angle'
  if (column.kind === 'colonne') return column.tower === 'frigo' ? 'Frigo' : 'Colonne'
  const deck = column.deck === 'evier' ? 'Évier' : column.deck === 'plaque' ? 'Plaque' : ''
  const front = deck ? `${shortBase(column.base)} · ${deck}` : shortBase(column.base)
  if (column.upper === 'aucun') return front
  return `${front} · ${upperLabel(column.upper)}`
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
  if (column.kind === 'angle') {
    const along = wallLength(project, 'A')
    if (width > along) return { ok: false, error: 'Largeur refusée : le meuble sortirait du mur.' }
    const x = column.returnWall === 'C' ? along - width : 0
    return { ok: true, columns: project.columns.map((item, cursor) => (cursor === index ? { ...item, width, x, wallId: 'A' } : item)) }
  }
  if (column.x + width > room) return { ok: false, error: `Largeur refusée : le meuble sortirait du mur.` }
  return { ok: true, columns: project.columns.map((item, cursor) => (cursor === index ? { ...item, width } : item)) }
}

export function resizeKitchenWall(project: KitchenProject, _width: number): { ok: true; columns: KitchenColumn[] } | { ok: false; error: string } {
  return { ok: true, columns: project.columns }
}

export function placeColumn(project: KitchenProject, id: string, x: number): KitchenColumn[] {
  const column = project.columns.find((item) => item.id === id)
  if (!column || column.locked) return project.columns
  if (column.kind === 'angle') {
    const along = wallLength(project, 'A')
    const pinned = column.returnWall === 'C' ? along - column.width : 0
    return project.columns.map((item) => (item.id === id ? { ...item, x: pinned, wallId: 'A' } : item))
  }
  const ghosts = returnOccupancy(project, column.wallId).map((block) => ({ id: `${block.id}-retour`, x: block.x, width: block.width }))
  const mates = [...project.columns.filter((item) => item.wallId === column.wallId), ...ghosts]
  const next = slideAlong(mates, id, column.width, x, cornerInset(project, column.wallId), wallLength(project, column.wallId))
  return project.columns.map((item) => (item.id === id ? { ...item, x: next } : item))
}

export function swapColumn(
  project: KitchenProject,
  id: string,
  direction: -1 | 1,
): { ok: true; columns: KitchenColumn[] } | { ok: false; error: string } {
  const column = project.columns.find((item) => item.id === id)
  if (!column) return { ok: false, error: 'Meuble introuvable.' }
  if (column.kind === 'angle' || column.locked) return { ok: false, error: 'Ce meuble reste en place.' }
  const mates = project.columns
    .filter((item) => item.wallId === column.wallId && item.kind !== 'angle')
    .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
  const index = mates.findIndex((item) => item.id === id)
  const other = mates[index + direction]
  if (!other || other.locked) return { ok: false, error: 'Pas de voisin à échanger.' }
  const left = column.x <= other.x ? column : other
  const right = left.id === column.id ? other : column
  const movingLeft = right
  const movingRight = left
  const xLeft = left.x
  const xRight = left.x + movingLeft.width
  return {
    ok: true,
    columns: project.columns.map((item) => {
      if (item.id === movingLeft.id) return { ...item, x: xLeft }
      if (item.id === movingRight.id) return { ...item, x: xRight }
      return item
    }),
  }
}

export function addKitchenColumn(
  project: KitchenProject,
  wallId: WallId,
  spec: KitchenAdd,
  createId: () => string,
): { ok: true; columns: KitchenColumn[]; selectedIndex: number } | { ok: false; error: string } {
  if (spec.kind === 'angle') return addAngle(project, spec.returnWall, createId)
  const length = wallLength(project, wallId)
  const inset = cornerInset(project, wallId)
  const blocked = [
    ...project.columns.filter((column) => column.wallId === wallId).map((column) => ({ x: column.x, width: column.width })),
    ...returnOccupancy(project, wallId),
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
    kind: spec.kind,
    base: spec.kind === 'bas' ? spec.base : 'porte',
    deck: spec.kind === 'bas' ? spec.deck : 'rien',
    returnWall: 'B',
    tower: spec.kind === 'colonne' ? spec.tower : 'frigo',
    upper: 'aucun',
    handle: 'bouton',
  }
  const columns = [...project.columns, created]
  return { ok: true, columns, selectedIndex: columns.length - 1 }
}

function addAngle(
  project: KitchenProject,
  returnWall: 'B' | 'C',
  createId: () => string,
): { ok: true; columns: KitchenColumn[]; selectedIndex: number } | { ok: false; error: string } {
  const shape = project.room.shape
  const side = project.room.lSide
  const allowed = returnWall === 'B'
    ? shape === 'u' || (shape === 'l' && side !== 'droite')
    : shape === 'u' || (shape === 'l' && side === 'droite')
  if (!allowed) return { ok: false, error: "Meuble d'angle : ce coin n'existe pas dans cette pièce." }
  const along = wallLength(project, 'A')
  const width = Math.min(900, along, wallLength(project, returnWall))
  if (width < 600) return { ok: false, error: "Meuble d'angle : le coin est trop court." }
  const x = returnWall === 'C' ? along - width : 0
  const taken = (wallId: WallId, start: number) => project.columns.some((column) => {
    if (column.wallId !== wallId) return false
    return start < column.x + column.width && start + width > column.x
  }) || returnOccupancy(project, wallId).some((block) => start < block.x + block.width && start + width > block.x)
  if (taken('A', x) || taken(returnWall, 0)) return { ok: false, error: "Meuble d'angle : le coin est déjà occupé." }
  const created: KitchenColumn = {
    id: createId(),
    wallId: 'A',
    x,
    width,
    locked: false,
    kind: 'angle',
    base: 'porte',
    deck: 'rien',
    returnWall,
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
