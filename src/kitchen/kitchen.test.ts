import { describe, expect, it } from 'vitest'
import { buildKitchenCutList } from './cutlist'
import { inspectKitchen, setColumnWidth, worktopRuns } from './layout'
import { defaultKitchen, parseKitchen, serializeKitchen, setKitchenWall, updateOpening } from './project'

describe('straight kitchen', () => {
  it('opens on a wall whose modules sum to the width and avoid the window', () => {
    const kitchen = defaultKitchen()
    expect(kitchen.columns.reduce((sum, column) => sum + column.width, 0)).toBe(kitchen.wall.width)
    expect(inspectKitchen(kitchen).issues).toEqual([])
    expect(worktopRuns(kitchen.columns)).toEqual([{ x: 0, width: 3000 }])
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

  it('opens an older anthracite file as noir and keeps a missing name', () => {
    const raw = JSON.parse(serializeKitchen(defaultKitchen())) as { finish: string; name?: string }
    raw.finish = 'anthracite'
    delete raw.name
    const opened = parseKitchen(JSON.stringify(raw))
    expect(opened.finish).toBe('noir')
    expect(opened.name).toBe('Cuisine')
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

  it('keeps a locked fridge still when the wall shrinks', () => {
    const kitchen = defaultKitchen()
    kitchen.columns[5].locked = true
    const resized = setKitchenWall(kitchen, 'width', 3400)
    expect(resized.ok).toBe(true)
    if (resized.ok) {
      expect(resized.project.columns[5].width).toBe(600)
      expect(resized.project.columns.reduce((sum, column) => sum + column.width, 0)).toBe(3400)
    }
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

  it('cuts a worktop that stops at the tall unit', () => {
    const rows = buildKitchenCutList(defaultKitchen())
    expect(rows.find((row) => row.role === 'plan de travail')).toMatchObject({ length: 3000, thickness: 38 })
    expect(rows.find((row) => row.role === 'crédence')).toMatchObject({ length: 3000, width: 600 })
  })
})
