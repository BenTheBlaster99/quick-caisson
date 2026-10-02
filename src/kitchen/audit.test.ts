import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCutList } from '../domain/cutlist'
import { defaultProject } from '../domain/project'
import { inspectKitchen, worktopRuns } from './layout'
import { defaultKitchen, moveIsland, parseKitchen, serializeKitchen, setIsland, setLSide, setShape } from './project'
import { builtWalls } from './room'
import { wallPieces } from './wall-pieces'

describe('phase 2 audit', () => {
  it('keeps the dressing cut list on the hand-check fixture', () => {
    const expected = JSON.parse(readFileSync(new URL('../domain/fixtures/hand-check.json', import.meta.url), 'utf8')) as {
      rows: [string, number, number, number, number][]
    }
    const rows = buildCutList(defaultProject()).filter((row) => row.caisson === '1')
    expect(rows.map((row) => [row.role, row.quantity, row.length, row.width, row.thickness])).toEqual(expected.rows)
  })

  it('saves a versioned kitchen file and refuses anything else', () => {
    const text = serializeKitchen(defaultKitchen())
    const saved = JSON.parse(text) as { format: string; version: number; openings: { swing?: string }[] }
    expect(saved.format).toBe('kitchen-project')
    expect(saved.version).toBe(1)
    delete saved.openings[0].swing
    expect(parseKitchen(JSON.stringify(saved)).openings[0].swing).toBe('gauche')
    expect(() => parseKitchen('{"format":"caisson-project","version":2}')).toThrow(/cuisine Caisson/)
    const newer = { ...JSON.parse(text), version: 2 }
    expect(() => parseKitchen(JSON.stringify(newer))).toThrow(/cuisine Caisson/)
  })

  it('builds linéaire, L on either side, U, and an island from the same file', () => {
    const kitchen = defaultKitchen()
    expect(builtWalls(kitchen.room.shape, kitchen.room.lSide)).toEqual(['A', 'B'])
    expect(worktopRuns(kitchen.columns)).toEqual(expect.arrayContaining([
      { wallId: 'A', x: 0, width: 3000 },
      { wallId: 'B', x: 560, width: 600 },
      { wallId: 'ilot', x: 0, width: 1400 },
    ]))
    expect(builtWalls(setShape(kitchen, 'lineaire').room.shape, 'gauche')).toEqual(['A'])
    expect(builtWalls(setLSide(kitchen, 'droite').room.shape, 'droite')).toEqual(['A', 'C'])
    expect(builtWalls(setShape(kitchen, 'u').room.shape, 'gauche')).toEqual(['A', 'B', 'C'])
    const parked = setIsland(kitchen, false)
    expect(inspectKitchen(parked).placed.every((column) => column.wallId !== 'ilot')).toBe(true)
    expect(inspectKitchen(kitchen).issues).toEqual([])
  })

  it('places the island from the left wall and from the back wall', () => {
    const moved = moveIsland(defaultKitchen(), 0, 0)
    expect(moved.room.islandX).toBe(400)
    expect(moved.room.islandZ).toBe(760)
  })

  it('cuts the window out of the wall and refuses a cabinet that crosses it', () => {
    const kitchen = defaultKitchen()
    const window = kitchen.openings[0]
    const pieces = wallPieces(kitchen.wall.width, kitchen.wall.ceilingHeight, [window])
    const hole = { x: window.x, y: window.bottom, w: window.width, h: window.height }
    expect(pieces.some((piece) => overlaps(piece, hole))).toBe(false)
    expect(pieces.some((piece) => piece.y === 0 && piece.x < window.x)).toBe(true)
    kitchen.columns[2].upper = 'haut'
    expect(inspectKitchen(kitchen).issues.some((issue) => issue.level === 'refus' && /fenêtre/.test(issue.message))).toBe(true)
  })

  it('refuses a cabinet in the door opening and warns when the swing covers another run', () => {
    const kitchen = defaultKitchen()
    kitchen.openings.push({ id: 'door', wallId: 'A', kind: 'porte', x: 0, width: 800, bottom: 0, height: 2100, swing: 'gauche' })
    const issues = inspectKitchen(kitchen).issues
    expect(issues.some((issue) => issue.columnId === 'k1' && issue.level === 'refus' && /porte/.test(issue.message))).toBe(true)
    const swing = issues.find((issue) => issue.columnId === 'b1' && /charnière/.test(issue.message))
    expect(swing?.level).toBe('attention')
    expect(swing?.overlapMm).toBe(240)
  })

  it('refuses a module that enters the corner', () => {
    const kitchen = defaultKitchen()
    const column = kitchen.columns.find((item) => item.id === 'b1')
    expect(column).toBeDefined()
    if (column) column.x = 0
    expect(inspectKitchen(kitchen).issues.some((issue) => issue.columnId === 'b1' && issue.level === 'refus' && /angle/.test(issue.message))).toBe(true)
  })
})

function overlaps(piece: { x: number; y: number; w: number; h: number }, hole: { x: number; y: number; w: number; h: number }): boolean {
  const x = Math.min(piece.x + piece.w, hole.x + hole.w) - Math.max(piece.x, hole.x)
  const y = Math.min(piece.y + piece.h, hole.y + hole.h) - Math.max(piece.y, hole.y)
  return x > 1 && y > 1
}
