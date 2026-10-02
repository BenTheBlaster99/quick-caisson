import { kitchenFinish } from './finishes'
import type { CutRow } from '../domain/types'
import { cutRun, inspectKitchen, upperSpan, worktopRuns, worktopTop } from './layout'
import type { KitchenProject } from './types'

const ROLE = {
  joue: 10,
  dessus: 20,
  dessous: 30,
  fond: 40,
  porte: 50,
  facade: 60,
  plan: 70,
  credence: 80,
  socle: 90,
} as const

export function buildKitchenCutList(project: KitchenProject): CutRow[] {
  const rows: CutRow[] = []
  const material = kitchenFinish(project.finish).name
  const { placed, issues } = inspectKitchen(project)
  const blocked = new Set(
    issues.filter((issue) => issue.level === 'refus' && issue.part === 'meuble').map((issue) => issue.columnId).filter((id): id is string => id !== null),
  )
  const blockedUpper = new Set(
    issues.filter((issue) => issue.level === 'refus' && issue.part === 'haut').map((issue) => issue.columnId).filter((id): id is string => id !== null),
  )
  const carcass = project.rules.carcassMm
  const runs = worktopRuns(project.columns.filter((column) => column.wallId !== 'ilot' || project.room.island))

  placed.forEach((column, index) => {
    if (blocked.has(column.id)) return
    const label = String(index + 1)
    if (column.kind === 'colonne') {
      pushCarcass(rows, project, label, index, column.width, project.wall.ceilingHeight - project.rules.towerGapMm, project.wall.baseDepth, true)
      return
    }
    pushCarcass(rows, project, label, index, column.width, project.wall.baseHeight, project.wall.baseDepth, column.base === 'porte')
    if (column.base === 'tiroirs' || column.base === 'four' || column.base === 'lave-vaisselle') {
      push(rows, {
        caisson: label,
        caissonIndex: index,
        role: 'façade tiroir',
        roleOrder: ROLE.facade,
        quantity: column.base === 'tiroirs' ? 3 : 1,
        ...longSide(column.width, Math.round(project.wall.baseHeight / (column.base === 'tiroirs' ? 3 : 4))),
        thickness: carcass,
        material,
        edges: 'avant',
      })
    }
    if (column.upper !== 'aucun' && !blockedUpper.has(column.id)) {
      const span = upperSpan(project.wall, project.rules, column.x, column.width)
      pushCarcass(rows, project, label, index, column.width, span.top - span.bottom, project.wall.upperDepth, true)
    }
  })

  runs.forEach((run, index) => {
    push(rows, {
      caisson: 'plan',
      caissonIndex: 2000 + index,
      role: 'plan de travail',
      roleOrder: ROLE.plan,
      quantity: 1,
      ...longSide(run.width, run.wallId === 'ilot' ? project.room.islandDepth : project.wall.baseDepth + project.rules.worktopOverhangMm),
      thickness: project.wall.worktopThickness,
      material: 'plan',
      edges: 'avant',
    })
    if (project.wall.plinthHeight > 0) {
      push(rows, {
        caisson: 'plan',
        caissonIndex: 2000 + index,
        role: 'socle avant',
        roleOrder: ROLE.socle,
        quantity: 1,
        ...longSide(run.width, project.wall.plinthHeight),
        thickness: carcass,
        material,
        edges: 'avant',
      })
    }
    if (run.wallId !== 'ilot' && project.wall.backsplashHeight > 0) {
      const top = worktopTop(project.wall)
      const holes = project.openings
        .filter((opening) => opening.wallId === run.wallId && opening.kind === 'fenetre' && opening.bottom < top + project.wall.backsplashHeight && opening.bottom + opening.height > top)
        .map((opening) => ({ x: opening.x, width: opening.width }))
      for (const part of cutRun(run.x, run.width, holes)) {
        push(rows, {
          caisson: 'plan',
          caissonIndex: 2000 + index,
          role: 'crédence',
          roleOrder: ROLE.credence,
          quantity: 1,
          ...longSide(part.width, project.wall.backsplashHeight),
          thickness: project.rules.backsplashMm,
          material: 'crédence',
          edges: 'aucun',
        })
      }
    }
  })

  return rows.sort((a, b) => a.caissonIndex - b.caissonIndex || a.roleOrder - b.roleOrder)
}

function pushCarcass(
  rows: CutRow[],
  project: KitchenProject,
  label: string,
  index: number,
  width: number,
  height: number,
  depth: number,
  door: boolean,
) {
  const material = kitchenFinish(project.finish).name
  const carcass = project.rules.carcassMm
  const inner = width - 2 * carcass
  push(rows, row(label, index, 'joue', ROLE.joue, 2, height, depth, carcass, material))
  push(rows, row(label, index, 'dessus', ROLE.dessus, 1, inner, depth, carcass, material))
  push(rows, row(label, index, 'dessous', ROLE.dessous, 1, inner, depth, carcass, material))
  push(rows, row(label, index, 'fond rapporté', ROLE.fond, 1, height - 2 * carcass, inner, project.rules.backMm, material, 'aucun'))
  if (door) push(rows, row(label, index, 'porte', ROLE.porte, 1, height, width, carcass, material))
}

function row(
  caisson: string,
  caissonIndex: number,
  role: string,
  roleOrder: number,
  quantity: number,
  a: number,
  b: number,
  thickness: number,
  material: string,
  edges: 'avant' | 'aucun' = 'avant',
): CutRow {
  return { caisson, caissonIndex, role, roleOrder, quantity, ...longSide(a, b), thickness, material, edges }
}

function longSide(a: number, b: number): { length: number; width: number } {
  return a >= b ? { length: a, width: b } : { length: b, width: a }
}

function push(rows: CutRow[], row: CutRow) {
  const existing = rows.find((candidate) => same(candidate, row))
  if (existing) existing.quantity += row.quantity
  else rows.push(row)
}

function same(a: CutRow, b: CutRow): boolean {
  return a.caisson === b.caisson && a.role === b.role && a.length === b.length && a.width === b.width && a.thickness === b.thickness && a.material === b.material && a.edges === b.edges
}

export function kitchenHasWorktop(project: KitchenProject): boolean {
  return worktopTop(project.wall) > 0 && worktopRuns(project.columns).length > 0
}
