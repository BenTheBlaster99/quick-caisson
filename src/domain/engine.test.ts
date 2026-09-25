import { describe, expect, it } from 'vitest'
import { addCaisson, redistribute, removeCaisson, setCaissonWidth, sumWidths } from './caissons'
import { buildCutList, formatCutCell } from './cutlist'
import { layoutCaisson, slidingLeafCount, usableHeight } from './layout'
import { defaultProject, parseProject, serializeProject } from './project'
import type { Caisson, Project } from './types'

function project(partial: Partial<Project> & Pick<Project, 'wall' | 'caissons'>): Project {
  return {
    format: 'caisson-project',
    version: 1,
    front: 'aucune',
    finish: 'blanc',
    ...partial,
  }
}

function box(id: string, width: number, extra: Partial<Caisson> = {}): Caisson {
  return {
    id,
    width,
    shelves: 0,
    rail: 'aucune',
    drawers: 0,
    pantalonniere: false,
    ...extra,
  }
}

describe('usable height', () => {
  it('subtracts the plinth and the ceiling gap', () => {
    expect(usableHeight({ width: 2400, height: 2500, depth: 600, socle: 80, ceilingGap: 20 })).toBe(2400)
  })
})

describe('caisson widths', () => {
  it('takes a width change from the caisson on the right', () => {
    const result = setCaissonWidth([800, 800, 800], 0, 900)
    expect(result).toEqual({ ok: true, widths: [900, 700, 800] })
  })

  it('makes the last caisson trade with the one on its left', () => {
    const result = setCaissonWidth([800, 800, 800], 2, 900)
    expect(result).toEqual({ ok: true, widths: [800, 700, 900] })
  })

  it('refuses a width outside 300–1200 mm', () => {
    expect(setCaissonWidth([800, 800], 0, 200).ok).toBe(false)
    expect(setCaissonWidth([800, 800], 0, 1400).ok).toBe(false)
  })

  it('refuses an edit that would push the neighbour outside the limits', () => {
    const result = setCaissonWidth([800, 400], 0, 1000)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/droite/)
  })

  it('refuses changing the only caisson away from the wall width', () => {
    const result = setCaissonWidth([1000], 0, 800)
    expect(result.ok).toBe(false)
  })

  it('splits the widest caisson in half', () => {
    const result = addCaisson(
      [box('a', 800), box('b', 500), box('c', 700, { shelves: 3 })],
      () => 'new',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.caissons.map((item) => item.width)).toEqual([400, 400, 500, 700])
      expect(result.caissons[1].id).toBe('new')
      expect(result.caissons[1].shelves).toBe(0)
      expect(result.caissons[0].shelves).toBe(0)
      expect(result.selectedIndex).toBe(1)
    }
  })

  it('copies the interior of the split caisson', () => {
    const result = addCaisson([box('a', 500), box('b', 900, { drawers: 3, rail: 'haute' })], () => 'new')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.caissons.map((item) => item.width)).toEqual([500, 450, 450])
      expect(result.caissons[2]).toMatchObject({ drawers: 3, rail: 'haute' })
    }
  })

  it('refuses a split when a half would be under 300 mm', () => {
    const result = addCaisson([box('a', 500), box('b', 500)], () => 'new')
    expect(result.ok).toBe(false)
  })

  it('gives a removed width to the right neighbour', () => {
    const result = removeCaisson([box('a', 400), box('b', 500), box('c', 400)], 0)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.caissons.map((item) => item.width)).toEqual([900, 400])
      expect(result.caissons[0].id).toBe('b')
    }
  })

  it('gives the last caisson to its left neighbour', () => {
    const result = removeCaisson([box('a', 400), box('b', 500), box('c', 400)], 2)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.caissons.map((item) => item.width)).toEqual([400, 900])
  })

  it('refuses a removal that would pass 1200 mm', () => {
    expect(removeCaisson([box('a', 800), box('b', 800)], 0).ok).toBe(false)
  })

  it('refuses removing the final caisson', () => {
    expect(removeCaisson([box('a', 1000)], 0).ok).toBe(false)
  })

  it('absorbs a wall-width change from the right', () => {
    expect(redistribute([800, 800, 800], 3000)).toEqual([800, 1000, 1200])
    expect(redistribute([800, 800, 800], 2100)).toEqual([800, 800, 500])
    expect(redistribute([800, 800, 800], 3600)).toEqual([1200, 1200, 1200])
    expect(redistribute([800, 800, 800], 6000)).toBeNull()
    expect(redistribute([800, 800, 800], 899)).toBeNull()
    const grown = redistribute([800, 800, 800], 3000)
    expect(grown && sumWidths(grown)).toBe(3000)
  })
})

describe('interiors', () => {
  const wall = { width: 1000, height: 2000, depth: 400, socle: 100, ceilingGap: 100 }

  it('spaces shelves on integer gaps', () => {
    const layout = layoutCaisson(wall, box('a', 1000, { shelves: 2 }))
    expect(layout.interiorHeight).toBe(1764)
    expect(layout.shelves.map((shelf) => shelf.top)).toEqual([612, 1206])
    expect(layout.warnings).toEqual([])
  })

  it('places the high rail 80 mm under the top panel', () => {
    const layout = layoutCaisson(wall, box('a', 1000, { rail: 'haute' }))
    expect(layout.rails.map((rail) => rail.axis)).toEqual([1702])
  })

  it('fills a drawers-only column', () => {
    const layout = layoutCaisson(wall, box('a', 1000, { drawers: 2 }))
    expect(layout.drawers.map((drawer) => drawer.height)).toEqual([882, 882])
    expect(layout.drawers[1].bottom).toBe(18 + 882)
    expect(layout.drawers[0].boxHeight).toBe(862)
  })

  it('keeps a free zone when shelves share the column with drawers', () => {
    const layout = layoutCaisson(wall, box('a', 1000, { drawers: 2, shelves: 2 }))
    expect(layout.drawerZone).toBe(400)
    expect(layout.shelves).toHaveLength(2)
    expect(layout.warnings).toEqual([])
  })

  it('leaves the default dressing without warnings', () => {
    const current = defaultProject()
    for (const caisson of current.caissons) {
      expect(layoutCaisson(current.wall, caisson).warnings).toEqual([])
    }
    expect(sumWidths(current.caissons.map((item) => item.width))).toBe(current.wall.width)
  })
})

describe('cut list', () => {
  const wall = { width: 1000, height: 2000, depth: 400, socle: 100, ceilingGap: 100 }

  it('sizes a simple carcass, shelves, rail, doors and plinth', () => {
    const rows = buildCutList(
      project({
        wall,
        front: 'battantes',
        finish: 'blanc',
        caissons: [box('a', 1000, { shelves: 2, rail: 'haute' })],
      }),
    )

    expect(rows.map((row) => [row.caisson, row.role, row.quantity, row.length, row.width, row.thickness, row.edges])).toEqual([
      ['1', 'joue', 2, 1800, 400, 18, 'avant'],
      ['1', 'dessus', 1, 964, 400, 18, 'avant'],
      ['1', 'dessous', 1, 964, 400, 18, 'avant'],
      ['1', 'fond rapporté', 1, 1764, 964, 8, 'aucun'],
      ['1', 'étagère', 2, 964, 380, 18, 'avant'],
      ['1', 'tringle', 1, 964, null, null, '—'],
      ['1', 'porte', 2, 1800, 500, 18, 'avant'],
      ['mur', 'socle avant', 1, 1000, 100, 18, 'avant'],
      ['mur', 'retour socle', 2, 382, 100, 18, 'avant'],
    ])
    expect(rows.every((row) => row.material === 'Blanc')).toBe(true)
    expect(formatCutCell(null, 'tringle', 'thickness')).toBe('Ø 25')
  })

  it('uses one door under 600 mm and two from 600 mm', () => {
    const rows = buildCutList(
      project({
        wall: { width: 1100, height: 2000, depth: 400, socle: 0, ceilingGap: 0 },
        front: 'battantes',
        caissons: [box('a', 500), box('b', 600)],
      }),
    )
    const doors = rows.filter((row) => row.role === 'porte')
    expect(doors).toEqual([
      expect.objectContaining({ caisson: '1', quantity: 1, length: 2000, width: 500 }),
      expect.objectContaining({ caisson: '2', quantity: 2, length: 2000, width: 300 }),
    ])
    expect(rows.some((row) => row.role === 'socle avant')).toBe(false)
  })

  it('spans sliding leaves across the wall', () => {
    expect(slidingLeafCount(2399)).toBe(2)
    expect(slidingLeafCount(2400)).toBe(3)
    const rows = buildCutList(
      project({
        wall: { ...wall, width: 2400 },
        front: 'coulissantes',
        caissons: [box('a', 1200), box('b', 1200)],
      }),
    )
    expect(rows.filter((row) => row.role === 'porte')).toHaveLength(0)
    expect(rows.filter((row) => row.role === 'vantail')).toEqual([
      expect.objectContaining({ caisson: 'mur', quantity: 3, width: 800, length: 1800 }),
    ])
  })

  it('lists a drawer front and a simple box', () => {
    const rows = buildCutList(
      project({
        wall,
        caissons: [box('a', 1000, { drawers: 2 })],
      }),
    )
    expect(rows.find((row) => row.role === 'façade tiroir')).toMatchObject({
      quantity: 2,
      length: 964,
      width: 882,
      thickness: 18,
    })
    expect(rows.find((row) => row.role === 'côté tiroir')).toMatchObject({
      quantity: 4,
      length: 862,
      width: 350,
      thickness: 18,
    })
    expect(rows.find((row) => row.role === 'fond tiroir')).toMatchObject({
      quantity: 2,
      length: 928,
      width: 314,
      thickness: 8,
    })
  })

  it('matches the stage-1 hand check', () => {
    const rows = buildCutList(defaultProject()).filter((row) => row.caisson === '1')
    expect(rows.map((row) => [row.role, row.quantity, row.length, row.width, row.thickness])).toEqual([
      ['joue', 2, 2400, 600, 18],
      ['dessus', 1, 764, 600, 18],
      ['dessous', 1, 764, 600, 18],
      ['fond rapporté', 1, 2364, 764, 8],
      ['étagère', 5, 764, 580, 18],
      ['porte', 2, 2400, 400, 18],
    ])
    expect(rows.every((row) => row.material === 'Chêne')).toBe(true)
    expect(rows.every((row) => row.edges === 'avant' || row.edges === 'aucun')).toBe(true)
  })

  it('keeps longueur as the long side on every panel', () => {
    const wideLeaf = buildCutList(
      project({
        wall: { width: 6000, height: 1800, depth: 700, socle: 0, ceilingGap: 0 },
        front: 'coulissantes',
        caissons: [box('a', 1200), box('b', 1200), box('c', 1200), box('d', 1200), box('e', 1200)],
      }),
    )
    const leaf = wideLeaf.find((row) => row.role === 'vantail')
    expect(leaf).toMatchObject({ length: 2000, width: 1800 })

    const deep = buildCutList(
      project({
        wall: { width: 800, height: 2000, depth: 700, socle: 0, ceilingGap: 0 },
        caissons: [box('a', 400, { shelves: 1 }), box('b', 400)],
      }),
    )
    expect(deep.find((row) => row.role === 'dessus')).toMatchObject({ length: 700, width: 364 })
    expect(deep.find((row) => row.role === 'étagère')).toMatchObject({ length: 680, width: 364 })

    for (const row of [...buildCutList(defaultProject()), ...wideLeaf, ...deep]) {
      if (row.length !== null && row.width !== null) expect(row.length).toBeGreaterThanOrEqual(row.width)
      if (row.thickness !== null) expect(row.edges === 'avant' || row.edges === 'aucun').toBe(true)
    }
  })

  it('lists a pantalonnière as one accessory line', () => {
    const rows = buildCutList(
      project({
        wall,
        caissons: [box('a', 1000, { pantalonniere: true })],
      }),
    )
    expect(rows.find((row) => row.role === 'pantalonnière')).toMatchObject({
      quantity: 1,
      length: 964,
      width: 350,
      thickness: null,
      edges: '—',
    })
  })
})

describe('project file', () => {
  it('round-trips the default project', () => {
    const current = defaultProject()
    expect(parseProject(serializeProject(current))).toEqual(current)
  })

  it('rejects a file whose caissons do not sum to the wall', () => {
    const current = defaultProject()
    current.caissons[0].width = 700
    expect(() => parseProject(JSON.stringify(current))).toThrow(/somme/)
  })
})
