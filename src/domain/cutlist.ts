import { doorCountForCaisson, layoutCaisson, usableHeight } from './layout'
import { BACK, doorFinishById, finishById, PANEL, splitEven } from './rules'
import type { CutRow, Project } from './types'

const ROLE = {
  joue: 10,
  dessus: 20,
  dessous: 30,
  fond: 40,
  etagere: 50,
  dessusTiroirs: 55,
  tringle: 60,
  facade: 70,
  cote: 80,
  devant: 90,
  derriere: 100,
  fondTiroir: 110,
  porte: 130,
  socle: 150,
  retour: 160,
} as const

export function buildCutList(project: Project): CutRow[] {
  const rows: CutRow[] = []
  const material = finishById(project.finish).name
  const height = usableHeight(project.wall)
  const depth = project.wall.depth

  project.caissons.forEach((caisson, index) => {
    const label = String(index + 1)
    const layout = layoutCaisson(project.wall, caisson)
    const inner = layout.interiorWidth

    push(rows, {
      caisson: label,
      caissonIndex: index,
      role: 'joue',
      roleOrder: ROLE.joue,
      quantity: 2,
      ...longSide(height, depth),
      thickness: PANEL,
      material,
      edges: 'avant',
    })
    push(rows, {
      caisson: label,
      caissonIndex: index,
      role: 'dessus',
      roleOrder: ROLE.dessus,
      quantity: 1,
      ...longSide(inner, depth),
      thickness: PANEL,
      material,
      edges: 'avant',
    })
    push(rows, {
      caisson: label,
      caissonIndex: index,
      role: 'dessous',
      roleOrder: ROLE.dessous,
      quantity: 1,
      ...longSide(inner, depth),
      thickness: PANEL,
      material,
      edges: 'avant',
    })
    push(rows, {
      caisson: label,
      caissonIndex: index,
      role: 'fond rapporté',
      roleOrder: ROLE.fond,
      quantity: 1,
      ...longSide(layout.interiorHeight, inner),
      thickness: BACK,
      material,
      edges: 'aucun',
    })

    if (layout.shelves.length > 0) {
      push(rows, {
        caisson: label,
        caissonIndex: index,
        role: 'étagère',
        roleOrder: ROLE.etagere,
        quantity: layout.shelves.length,
        ...longSide(inner, layout.shelfDepth),
        thickness: PANEL,
        material,
        edges: 'avant',
      })
    }

    if (layout.closingShelf) {
      push(rows, {
        caisson: label,
        caissonIndex: index,
        role: 'dessus tiroirs',
        roleOrder: ROLE.dessusTiroirs,
        quantity: 1,
        ...longSide(inner, layout.shelfDepth),
        thickness: PANEL,
        material,
        edges: 'avant',
      })
    }

    if (layout.rails.length > 0) {
      push(rows, {
        caisson: label,
        caissonIndex: index,
        role: 'tringle',
        roleOrder: ROLE.tringle,
        quantity: layout.rails.length,
        length: inner,
        width: null,
        thickness: null,
        material,
        edges: '—',
      })
    }

    const board = caisson.drawerThickness
    for (const drawer of layout.drawers) {
      const boxWidth = inner - 2 * board
      const boxDepth = layout.drawerDepth
      push(rows, {
        caisson: label,
        caissonIndex: index,
        role: 'façade tiroir',
        roleOrder: ROLE.facade,
        quantity: 1,
        ...longSide(inner, drawer.height),
        thickness: board,
        material,
        edges: 'avant',
      })
      push(rows, {
        caisson: label,
        caissonIndex: index,
        role: 'côté tiroir',
        roleOrder: ROLE.cote,
        quantity: 2,
        ...longSide(boxDepth, drawer.boxHeight),
        thickness: board,
        material,
        edges: 'aucun',
      })
      push(rows, {
        caisson: label,
        caissonIndex: index,
        role: 'devant tiroir',
        roleOrder: ROLE.devant,
        quantity: 1,
        ...longSide(boxWidth, drawer.boxHeight),
        thickness: board,
        material,
        edges: 'aucun',
      })
      push(rows, {
        caisson: label,
        caissonIndex: index,
        role: 'derrière tiroir',
        roleOrder: ROLE.derriere,
        quantity: 1,
        ...longSide(boxWidth, drawer.boxHeight),
        thickness: board,
        material,
        edges: 'aucun',
      })
      push(rows, {
        caisson: label,
        caissonIndex: index,
        role: 'fond tiroir',
        roleOrder: ROLE.fondTiroir,
        quantity: 1,
        ...longSide(boxWidth, boxDepth - 2 * board),
        thickness: BACK,
        material,
        edges: 'aucun',
      })
    }

    if (caisson.door !== 'aucune') {
      const count = doorCountForCaisson(caisson.width)
      const widths = splitEven(caisson.width, count)
      const doorMaterial = caisson.door === 'vitree' || caisson.doorFinish === 'verre' ? 'verre' : doorFinishById(caisson.doorFinish).name
      for (const doorWidth of widths) {
        push(rows, {
          caisson: label,
          caissonIndex: index,
          role: 'porte',
          roleOrder: ROLE.porte,
          quantity: 1,
          ...longSide(height, doorWidth),
          thickness: PANEL,
          material: doorMaterial,
          edges: 'avant',
        })
      }
    }
  })

  if (project.wall.socle > 0) {
    push(rows, {
      caisson: 'mur',
      caissonIndex: 1000,
      role: 'socle avant',
      roleOrder: ROLE.socle,
      quantity: 1,
      ...longSide(project.wall.width, project.wall.socle),
      thickness: PANEL,
      material,
      edges: 'avant',
    })
    push(rows, {
      caisson: 'mur',
      caissonIndex: 1000,
      role: 'retour socle',
      roleOrder: ROLE.retour,
      quantity: 2,
      ...longSide(project.wall.depth - PANEL, project.wall.socle),
      thickness: PANEL,
      material,
      edges: 'avant',
    })
  }

  return rows.sort((a, b) => {
    if (a.caissonIndex !== b.caissonIndex) return a.caissonIndex - b.caissonIndex
    if (a.roleOrder !== b.roleOrder) return a.roleOrder - b.roleOrder
    return (b.length ?? 0) - (a.length ?? 0) || (b.width ?? 0) - (a.width ?? 0)
  })
}

/** Longueur is the long side. Largeur is the other side. */
function longSide(a: number, b: number): { length: number; width: number } {
  return a >= b ? { length: a, width: b } : { length: b, width: a }
}

function push(rows: CutRow[], row: CutRow) {
  const existing = rows.find((candidate) => samePart(candidate, row))
  if (existing) existing.quantity += row.quantity
  else rows.push(row)
}

function samePart(a: CutRow, b: CutRow): boolean {
  return (
    a.caisson === b.caisson &&
    a.role === b.role &&
    a.length === b.length &&
    a.width === b.width &&
    a.thickness === b.thickness &&
    a.material === b.material &&
    a.edges === b.edges
  )
}

export function cutRowKey(row: CutRow): string {
  return `${row.caissonIndex}|${row.role}|${row.length}|${row.width}|${row.thickness}`
}

export function formatCutCell(value: number | null, role: string, field: 'length' | 'width' | 'thickness'): string {
  if (role === 'tringle' && field === 'thickness') return 'Ø 25'
  if (value === null) return '—'
  return String(value)
}
