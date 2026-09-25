import {
  DRAWER_BOX_SHORT,
  DRAWER_DEPTH_INSET,
  MAX_DRAWERS,
  MAX_SHELVES,
  MIN_FREE,
  NOMINAL_DRAWER,
  PANEL,
  PANTO_ZONE,
  RAIL_HIGH_DROP,
  SHELF_SETBACK,
  splitEven,
} from './rules'
import type { Caisson, Project, Wall } from './types'

export function usableHeight(wall: Wall): number {
  return wall.height - wall.socle - wall.ceilingGap
}

export type ShelfMark = {
  bottom: number
  top: number
}

export type RailMark = {
  kind: 'haute' | 'basse'
  axis: number
}

export type DrawerMark = {
  bottom: number
  height: number
  boxHeight: number
}

export type PantoMark = {
  bottom: number
  height: number
}

export type CaissonLayout = {
  boxHeight: number
  interiorBottom: number
  interiorTop: number
  interiorHeight: number
  interiorWidth: number
  shelfDepth: number
  drawerDepth: number
  drawerZone: number
  shelves: ShelfMark[]
  rails: RailMark[]
  drawers: DrawerMark[]
  pantalonniere: PantoMark | null
  warnings: string[]
}

export function layoutCaisson(wall: Wall, caisson: Caisson): CaissonLayout {
  const boxHeight = usableHeight(wall)
  const interiorBottom = PANEL
  const interiorTop = boxHeight - PANEL
  const interiorHeight = interiorTop - interiorBottom
  const interiorWidth = caisson.width - 2 * PANEL
  const warnings: string[] = []

  const wantsUpper = caisson.shelves > 0 || caisson.rail !== 'aucune'
  const onlyDrawers = caisson.drawers > 0 && !wantsUpper && !caisson.pantalonniere

  let drawerZone = 0
  if (caisson.drawers > 0) {
    if (onlyDrawers) {
      drawerZone = interiorHeight
    } else {
      let reserved = 0
      if (caisson.pantalonniere) reserved += Math.min(PANTO_ZONE, interiorHeight)
      if (wantsUpper) reserved += MIN_FREE
      reserved = Math.min(interiorHeight, reserved)
      const cap = Math.max(0, interiorHeight - reserved)
      const wanted = caisson.drawers * NOMINAL_DRAWER
      drawerZone = Math.min(cap, wanted)
      if (drawerZone === 0) warnings.push('Pas de place pour les tiroirs.')
      else if (drawerZone < wanted) {
        warnings.push(
          `Tiroirs réduits à ${drawerZone} mm au total pour laisser de la place au-dessus.`,
        )
      }
    }
  }

  const afterDrawers = interiorHeight - drawerZone
  let pantoHeight = 0
  if (caisson.pantalonniere) {
    pantoHeight = Math.min(PANTO_ZONE, afterDrawers)
    if (pantoHeight === 0) warnings.push('Pas de place pour la pantalonnière.')
    else if (pantoHeight < PANTO_ZONE) {
      warnings.push(`Pantalonnière réduite à ${pantoHeight} mm (nominal ${PANTO_ZONE} mm).`)
    }
  }

  const shelfZone = interiorHeight - drawerZone - pantoHeight
  const shelves: ShelfMark[] = []
  if (caisson.shelves > 0) {
    const needed = caisson.shelves * PANEL
    if (shelfZone < needed) {
      warnings.push(
        `${caisson.shelves} étagères ne tiennent pas dans la zone libre (${Math.max(0, shelfZone)} mm).`,
      )
    } else {
      const gaps = splitEven(shelfZone - needed, caisson.shelves + 1)
      let cursor = interiorBottom + drawerZone + pantoHeight
      for (let index = 0; index < caisson.shelves; index += 1) {
        cursor += gaps[index]
        const bottom = cursor
        const top = bottom + PANEL
        shelves.push({ bottom, top })
        cursor = top
      }
    }
  }

  const rails: RailMark[] = []
  if (caisson.rail === 'haute' || caisson.rail === 'double') {
    rails.push({ kind: 'haute', axis: interiorTop - RAIL_HIGH_DROP })
  }
  if (caisson.rail === 'basse' || caisson.rail === 'double') {
    rails.push({ kind: 'basse', axis: interiorTop - interiorHeight / 2 })
  }

  const drawerBottom = interiorBottom
  const drawerHeights = drawerZone > 0 ? splitEven(drawerZone, caisson.drawers) : []
  const drawers: DrawerMark[] = drawerHeights.map((height) => {
    const mark = {
      bottom: drawerBottom,
      height,
      boxHeight: height > DRAWER_BOX_SHORT * 2 ? height - DRAWER_BOX_SHORT : height,
    }
    return mark
  })
  for (let index = 1; index < drawers.length; index += 1) {
    drawers[index].bottom = drawers[index - 1].bottom + drawers[index - 1].height
  }

  for (const rail of rails) {
    const inDrawers = drawers.some(
      (drawer) => rail.axis > drawer.bottom && rail.axis < drawer.bottom + drawer.height,
    )
    if (inDrawers) warnings.push('Une tringle tombe dans la zone des tiroirs.')
    const throughShelf = shelves.some(
      (shelf) => rail.axis > shelf.bottom && rail.axis < shelf.top,
    )
    if (throughShelf) warnings.push('Une tringle croise une étagère.')
  }

  const pantalonniere: PantoMark | null =
    pantoHeight > 0
      ? { bottom: interiorBottom + drawerZone, height: pantoHeight }
      : null

  return {
    boxHeight,
    interiorBottom,
    interiorTop,
    interiorHeight,
    interiorWidth,
    shelfDepth: wall.depth - SHELF_SETBACK,
    drawerDepth: wall.depth - DRAWER_DEPTH_INSET,
    drawerZone,
    shelves,
    rails,
    drawers,
    pantalonniere,
    warnings: [...new Set(warnings)],
  }
}

export function layoutProject(project: Project): CaissonLayout[] {
  return project.caissons.map((caisson) => layoutCaisson(project.wall, caisson))
}

export function clampShelves(value: number): number {
  return clampInt(value, 0, MAX_SHELVES)
}

export function clampDrawers(value: number): number {
  return clampInt(value, 0, MAX_DRAWERS)
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function doorCountForCaisson(width: number): number {
  return width < 600 ? 1 : 2
}

export function slidingLeafCount(wallWidth: number): number {
  return wallWidth < 2400 ? 2 : 3
}
