import { redistribute, setCaissonWidth, sumWidths } from '../domain/caissons'
import { MIN_CAISSON, MAX_CAISSON } from '../domain/rules'
import type {
  BaseRole,
  KitchenColumn,
  KitchenIssue,
  KitchenProfile,
  KitchenProject,
  KitchenWall,
  Opening,
  UpperRole,
} from './types'

export const COLUMN_MIN = MIN_CAISSON
export const COLUMN_MAX = MAX_CAISSON

export type Span = { x: number; width: number; bottom: number; top: number }

export type PlacedColumn = KitchenColumn & { x: number }

export type WorktopRun = { x: number; width: number }

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
  let x = 0
  return columns.map((column) => {
    const placed = { ...column, x }
    x += column.width
    return placed
  })
}

export function worktopRuns(columns: KitchenColumn[]): WorktopRun[] {
  const runs: WorktopRun[] = []
  let x = 0
  let run: WorktopRun | null = null
  for (const column of columns) {
    if (column.kind === 'bas') {
      if (!run) run = { x, width: 0 }
      run.width += column.width
    } else if (run) {
      runs.push(run)
      run = null
    }
    x += column.width
  }
  if (run) runs.push(run)
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
  const placed = placeColumns(project.columns)
  const issues: KitchenIssue[] = []
  const total = sumWidths(project.columns.map((column) => column.width))
  const top = worktopTop(project.wall)
  if (total !== project.wall.width) {
    note(issues, {
      level: 'refus',
      columnId: null,
      part: null,
      overlapMm: Math.abs(project.wall.width - total),
      message: `La somme des meubles (${total} mm) ne vaut pas la largeur du mur (${project.wall.width} mm).`,
    })
  }

  placed.forEach((column, index) => {
    const label = `Meuble ${index + 1}`
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
  const result = setCaissonWidth(
    project.columns.map((column) => column.width),
    index,
    width,
    project.columns.map((column) => column.locked),
  )
  if (!result.ok) return result
  return {
    ok: true,
    columns: project.columns.map((column, cursor) => ({ ...column, width: result.widths[cursor] })),
  }
}

export function resizeKitchenWall(project: KitchenProject, width: number): { ok: true; columns: KitchenColumn[] } | { ok: false; error: string } {
  const widths = redistribute(
    project.columns.map((column) => column.width),
    width,
    project.columns.map((column) => column.locked),
  )
  if (!widths) return { ok: false, error: 'Largeur refusée : les meubles verrouillés ne laissent pas assez de jeu.' }
  return {
    ok: true,
    columns: project.columns.map((column, index) => ({ ...column, width: widths[index] })),
  }
}

export function addKitchenColumn(
  columns: KitchenColumn[],
  createId: () => string,
): { ok: true; columns: KitchenColumn[]; selectedIndex: number } | { ok: false; error: string } {
  const unlocked = columns.map((column, index) => ({ column, index })).filter((item) => !item.column.locked)
  if (unlocked.length === 0) return { ok: false, error: 'Ajout refusé : tous les meubles sont verrouillés.' }
  let best = unlocked[0]
  for (const item of unlocked) if (item.column.width > best.column.width) best = item
  const left = Math.floor(best.column.width / 2)
  const right = best.column.width - left
  if (left < COLUMN_MIN || right < COLUMN_MIN) {
    return { ok: false, error: `Ajout refusé : aucun meuble ne peut être coupé en deux parties d'au moins ${COLUMN_MIN} mm.` }
  }
  const next = columns.map((column) => ({ ...column }))
  next[best.index] = { ...next[best.index], width: left }
  next.splice(best.index + 1, 0, {
    ...best.column,
    id: createId(),
    width: right,
    locked: false,
    kind: 'bas',
    base: 'porte',
    upper: 'aucun',
  })
  return { ok: true, columns: next, selectedIndex: best.index + 1 }
}

export function removeKitchenColumn(
  columns: KitchenColumn[],
  index: number,
): { ok: true; columns: KitchenColumn[]; selectedIndex: number } | { ok: false; error: string } {
  if (columns.length <= 1) return { ok: false, error: 'Suppression refusée : il reste un seul meuble.' }
  if (index < 0 || index >= columns.length) return { ok: false, error: 'Meuble introuvable.' }
  const locked = columns.map((column) => column.locked)
  const order: number[] = []
  if (index < columns.length - 1) {
    for (let cursor = index + 1; cursor < columns.length; cursor += 1) order.push(cursor)
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) order.push(cursor)
  const recipient = order.find((cursor) => !locked[cursor])
  if (recipient === undefined) return { ok: false, error: 'Suppression refusée : les autres meubles sont verrouillés.' }
  const merged = columns[recipient].width + columns[index].width
  if (merged > COLUMN_MAX) return { ok: false, error: `Suppression refusée : le meuble voisin passerait à ${merged} mm.` }
  const next = columns.filter((_, cursor) => cursor !== index)
  const recipientIndex = recipient > index ? recipient - 1 : recipient
  next[recipientIndex] = { ...next[recipientIndex], width: merged }
  return { ok: true, columns: next, selectedIndex: recipientIndex }
}
