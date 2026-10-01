import { describe, expect, it } from 'vitest'
import { buildKitchenCutList } from './cutlist'
import { inspectKitchen, setColumnWidth, worktopRuns } from './layout'
import { defaultKitchen, moveColumn, parseKitchen, serializeKitchen, setKitchenWall, setWallFinish, updateOpening } from './project'

describe('kitchen room', () => {
  it('opens on an L with a clear wall, a door, and an island', () => {
    const kitchen = defaultKitchen()
    expect(kitchen.room.shape).toBe('l')
    expect(kitchen.room.island).toBe(true)
    expect(kitchen.wall.width).toBe(3600)
    expect(kitchen.room.depth).toBe(2800)
    expect(inspectKitchen(kitchen).issues).toEqual([])
    expect(worktopRuns(kitchen.columns)).toEqual(expect.arrayContaining([{ wallId: 'A', x: 0, width: 3000 }]))
  })

  it('refuses an upper cabinet that crosses the window by a measured overlap', () => {
    const kitchen = defaultKitchen()
    kitchen.columns[2].upper = 'haut'
    const issue = inspectKitchen(kitchen).issues.find((item) => item.columnId === 'k3')
    expect(issue?.message).toMatch(/empiète de \d+ mm sur la fenêtre/)
    expect(issue?.overlapMm).toBe(800)
    expect(buildKitchenCutList(kitchen).find((row) => row.caisson === '3' && row.role === 'porte')?.quantity).toBe(1)
  })

  it('warns when a hob sits under a full upper and still cuts that cabinet', () => {
    const kitchen = defaultKitchen()
    kitchen.columns[0].base = 'plaque'
    const issue = inspectKitchen(kitchen).issues.find((item) => item.columnId === 'k1')
    expect(issue?.level).toBe('attention')
    expect(issue?.message).toMatch(/hotte/)
    expect(buildKitchenCutList(kitchen).some((row) => row.caisson === '1' && row.role === 'joue')).toBe(true)
  })

  it('refuses a window that drops below the worktop', () => {
    const kitchen = defaultKitchen()
    kitchen.openings[0].bottom = 700
    expect(inspectKitchen(kitchen).issues.some((issue) => /sous le plan/.test(issue.message))).toBe(true)
  })

  it('opens an older straight file on wall A', () => {
    const raw = JSON.parse(serializeKitchen(defaultKitchen())) as {
      finish: string
      name?: string
      room?: unknown
      columns: { wallId?: string; x?: number }[]
      openings: { wallId?: string }[]
    }
    raw.finish = 'anthracite'
    delete raw.name
    delete raw.room
    for (const column of raw.columns) {
      delete column.wallId
      delete column.x
    }
    for (const opening of raw.openings) delete opening.wallId
    const opened = parseKitchen(JSON.stringify(raw))
    expect(opened.finish).toBe('noir')
    expect(opened.name).toBe('Cuisine')
    expect(opened.room.shape).toBe('lineaire')
    expect(opened.room.island).toBe(false)
    expect(opened.columns.every((column) => column.wallId === 'A')).toBe(true)
    expect(opened.columns[0].x).toBe(0)
    expect(opened.columns[1].x).toBe(opened.columns[0].width)
    expect(opened.room.finishes).toEqual({ A: 'blanc', B: 'blanc', C: 'blanc', D: 'blanc' })
  })

  it('refuses a sink narrower than the appliance rule', () => {
    const kitchen = defaultKitchen()
    const narrowed = setColumnWidth(kitchen, 2, 500)
    expect(narrowed.ok).toBe(true)
    if (narrowed.ok) {
      const next = { ...kitchen, columns: narrowed.columns }
      expect(inspectKitchen(next).issues.some((issue) => /évier/.test(issue.message))).toBe(true)
    }
  })

  it('leaves a locked fridge in place when the room gets shorter', () => {
    const kitchen = defaultKitchen()
    kitchen.columns[5].locked = true
    const resized = setKitchenWall(kitchen, 'width', 3400)
    expect(resized.ok).toBe(true)
    if (resized.ok) {
      expect(resized.project.columns[5].width).toBe(600)
      expect(resized.project.columns[5].x).toBe(3000)
      expect(inspectKitchen(resized.project).issues.some((issue) => issue.columnId === 'k6' && /dépasse/.test(issue.message))).toBe(true)
    }
  })

  it('slides a module up to its neighbour and no further', () => {
    const kitchen = defaultKitchen()
    const moved = moveColumn(kitchen, 'k2', 100)
    const column = moved.columns.find((item) => item.id === 'k2')
    expect(column?.x).toBe(600)
  })

  it('round-trips the default kitchen', () => {
    const kitchen = defaultKitchen()
    expect(parseKitchen(serializeKitchen(kitchen))).toEqual(kitchen)
  })

  it('refuses an opening that leaves the wall', () => {
    const kitchen = defaultKitchen()
    const moved = updateOpening(kitchen, 'o1', { x: 3000, width: 1400 })
    expect(moved.ok).toBe(false)
  })

  it('paints one wall without changing the others', () => {
    const kitchen = defaultKitchen()
    const next = setWallFinish(kitchen, 'B', 'carrelage')
    expect(next.room.finishes.B).toBe('carrelage')
    expect(next.room.finishes.A).toBe('blanc')
    expect(parseKitchen(serializeKitchen(next)).room.finishes.B).toBe('carrelage')
  })

  it('cuts a worktop that stops at the tall unit', () => {
    const rows = buildKitchenCutList(defaultKitchen())
    expect(rows.find((row) => row.role === 'plan de travail' && row.length === 3000)).toMatchObject({ length: 3000, thickness: 38 })
    expect(rows.find((row) => row.role === 'crédence' && row.length === 3000)).toMatchObject({ length: 3000, width: 600 })
  })
})
