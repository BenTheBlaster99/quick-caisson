import {
  DRAWER_BOX_SHORT,
  HANGING_DEFAULT,
  HANGING_MAX,
  HANGING_MIN,
  MAX_DRAWERS,
  MAX_SHELVES,
  MIN_FREE,
  NOMINAL_DRAWER,
  PANEL,
  RAIL_DIAMETER,
  RAIL_HIGH_DROP,
  SHELF_SETBACK,
  DRAWER_DEPTH_INSET,
  splitEven,
} from './rules'
import type { Caisson, DoorMode, Project, RailMode, Wall } from './types'

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

export type CaissonLayout = {
  boxHeight: number
  interiorBottom: number
  interiorTop: number
  interiorHeight: number
  interiorWidth: number
  shelfDepth: number
  drawerDepth: number
  drawerThickness: number
  drawerZone: number
  /** Bottom of the zone where counted shelves may sit. */
  shelfZoneBottom: number
  shelfZoneTop: number
  shelves: ShelfMark[]
  /** Automatic shelf on top of the drawer stack. Not one of the counted shelves. */
  closingShelf: ShelfMark | null
  rails: RailMark[]
  drawers: DrawerMark[]
  warnings: string[]
}

const RAIL_CLEAR = Math.ceil(RAIL_DIAMETER / 2)

export function layoutCaisson(wall: Wall, caisson: Caisson): CaissonLayout {
  const boxHeight = usableHeight(wall)
  const interiorBottom = PANEL
  const interiorTop = boxHeight - PANEL
  const interiorHeight = interiorTop - interiorBottom
  const interiorWidth = caisson.width - 2 * PANEL
  const warnings: string[] = []

  const wantsUpper = caisson.shelves > 0 || caisson.rail !== 'aucune'
  const onlyDrawers = caisson.drawers > 0 && !wantsUpper
  const closing = caisson.drawers > 0 ? PANEL : 0
  const aboveDrawers = Math.max(0, interiorHeight - closing)

  let drawerZone = 0
  if (caisson.drawers > 0) {
    if (onlyDrawers) {
      drawerZone = aboveDrawers
    } else {
      const reserved = wantsUpper ? Math.min(MIN_FREE, aboveDrawers) : 0
      const cap = Math.max(0, aboveDrawers - reserved)
      const wanted = caisson.drawers * NOMINAL_DRAWER
      drawerZone = Math.min(cap, wanted)
      if (drawerZone === 0) warnings.push('Pas de place pour les tiroirs.')
      else if (drawerZone < wanted) {
        warnings.push(`Tiroirs réduits à ${drawerZone} mm au total pour laisser de la place au-dessus.`)
      }
    }
  }

  const drawerBottom = interiorBottom
  const drawerHeights = drawerZone > 0 ? splitEven(drawerZone, caisson.drawers) : []
  const drawers: DrawerMark[] = drawerHeights.map((height) => ({
    bottom: drawerBottom,
    height,
    boxHeight: height > DRAWER_BOX_SHORT * 2 ? height - DRAWER_BOX_SHORT : height,
  }))
  for (let index = 1; index < drawers.length; index += 1) {
    drawers[index].bottom = drawers[index - 1].bottom + drawers[index - 1].height
  }

  const closingShelf: ShelfMark | null =
    drawers.length > 0
      ? { bottom: interiorBottom + drawerZone, top: interiorBottom + drawerZone + PANEL }
      : null

  const bankTop = closingShelf ? closingShelf.top : interiorBottom
  const rails = placeRails(caisson.rail, bankTop, interiorTop, caisson.hangingGap, warnings)
  const zone = shelfZone(rails, bankTop, interiorTop, caisson.hangingGap)
  const shelfZoneBottom = zone.bottom
  const shelfZoneTop = zone.top
  const zoneHeight = Math.max(0, shelfZoneTop - shelfZoneBottom)

  const shelves = placeShelves(shelfZoneBottom, shelfZoneTop, caisson.shelves, caisson.shelfGaps, zoneHeight, warnings)

  return {
    boxHeight,
    interiorBottom,
    interiorTop,
    interiorHeight,
    interiorWidth,
    shelfDepth: wall.depth - SHELF_SETBACK,
    drawerDepth: wall.depth - DRAWER_DEPTH_INSET,
    drawerThickness: caisson.drawerThickness,
    drawerZone,
    shelfZoneBottom,
    shelfZoneTop,
    shelves,
    closingShelf,
    rails,
    drawers,
    warnings: [...new Set(warnings)],
  }
}

function placeRails(
  mode: RailMode,
  bankTop: number,
  interiorTop: number,
  hangingGap: number,
  warnings: string[],
): RailMark[] {
  if (mode === 'aucune') return []
  const rails: RailMark[] = []
  const highAxis = interiorTop - RAIL_HIGH_DROP
  if (mode === 'haute' || mode === 'double') {
    const under = highAxis - bankTop
    if (under < hangingGap) {
      warnings.push(`Vide sous la tringle : il reste ${Math.max(0, under)} mm sous la tringle haute.`)
    }
    if (highAxis <= bankTop) warnings.push('La tringle haute ne tient pas.')
    else rails.push({ kind: 'haute', axis: highAxis })
  }
  if (mode === 'basse' || mode === 'double') {
    const axis = bankTop + hangingGap
    const upper = mode === 'double' ? highAxis : interiorTop
    if (axis + RAIL_CLEAR >= upper) {
      warnings.push(`Vide sous la tringle : ${hangingGap} mm ne tient pas dans ce caisson.`)
    } else {
      rails.push({ kind: 'basse', axis })
    }
  }
  return rails
}

/** Shelves stack up from the drawers. The hanging gap under a high rail stays empty. */
function shelfZone(rails: RailMark[], bankTop: number, interiorTop: number, hangingGap: number): { bottom: number; top: number } {
  const haute = rails.find((rail) => rail.kind === 'haute')
  const basse = rails.find((rail) => rail.kind === 'basse')
  const bottom = basse ? basse.axis + RAIL_CLEAR : bankTop
  const top = haute ? haute.axis - RAIL_CLEAR - hangingGap : interiorTop
  return { bottom, top: Math.max(bottom, top) }
}

function placeShelves(
  zoneBottom: number,
  zoneTop: number,
  count: number,
  gaps: number[],
  zoneHeight: number,
  warnings: string[],
): ShelfMark[] {
  if (count <= 0) return []
  const needed = count * PANEL
  const distances = gaps.length === count ? gaps : equalShelfGaps(zoneHeight, count)
  if (zoneHeight < needed || distances.reduce((sum, gap) => sum + gap, 0) + needed > zoneHeight) {
    warnings.push(`${count} étagères ne tiennent pas dans la zone libre (${zoneHeight} mm).`)
    return []
  }
  const shelves: ShelfMark[] = []
  let cursor = zoneBottom
  for (const gap of distances) {
    cursor += gap
    const bottom = cursor
    const top = bottom + PANEL
    if (top > zoneTop) {
      warnings.push(`${count} étagères ne tiennent pas dans la zone libre (${zoneHeight} mm).`)
      return []
    }
    shelves.push({ bottom, top })
    cursor = top
  }
  return shelves
}

export function equalShelfGaps(zoneHeight: number, count: number): number[] {
  if (count <= 0) return []
  const needed = count * PANEL
  if (zoneHeight < needed) return Array.from({ length: count }, () => 0)
  return splitEven(zoneHeight - needed, count + 1).slice(0, count)
}

export function applyShelfCount(wall: Wall, caisson: Caisson, shelves: number): Caisson {
  const count = clampShelves(shelves)
  const draft = { ...caisson, shelves: count, shelfGaps: [] }
  const zone = layoutCaisson(wall, draft)
  return { ...draft, shelfGaps: equalShelfGaps(zone.shelfZoneTop - zone.shelfZoneBottom, count) }
}

export function applyShelfGap(
  wall: Wall,
  caisson: Caisson,
  index: number,
  gap: number,
): { ok: true; caisson: Caisson } | { ok: false; error: string } {
  if (!Number.isInteger(gap) || gap < 0) {
    return { ok: false, error: 'Distance refusée : indiquez un nombre entier de millimètres, positif ou nul.' }
  }
  if (index < 0 || index >= caisson.shelves) {
    return { ok: false, error: 'Étagère introuvable.' }
  }
  const nextGaps = caisson.shelfGaps.length === caisson.shelves ? [...caisson.shelfGaps] : equalShelfGaps(shelfZoneHeight(wall, caisson), caisson.shelves)
  nextGaps[index] = gap
  const zoneHeight = shelfZoneHeight(wall, { ...caisson, shelfGaps: nextGaps })
  const used = nextGaps.reduce((sum, item) => sum + item, 0) + caisson.shelves * PANEL
  if (used > zoneHeight) {
    const room = Math.max(0, zoneHeight - (used - gap) - caisson.shelves * PANEL)
    return {
      ok: false,
      error: `Distance refusée : ${gap} mm ne tient pas. Il reste ${room} mm dans la zone libre.`,
    }
  }
  return { ok: true, caisson: { ...caisson, shelfGaps: nextGaps } }
}

export function applyHangingGap(
  wall: Wall,
  caisson: Caisson,
  gap: number,
): { ok: true; caisson: Caisson } | { ok: false; error: string } {
  if (!Number.isInteger(gap) || gap < HANGING_MIN || gap > HANGING_MAX) {
    return { ok: false, error: `Vide sous la tringle : la limite est ${HANGING_MIN}–${HANGING_MAX} mm.` }
  }
  const next = { ...caisson, hangingGap: gap }
  const layout = layoutCaisson(wall, next)
  const blocked = layout.warnings.some((warning) => warning.startsWith('Vide sous la tringle'))
  if (blocked) {
    return { ok: false, error: `Vide sous la tringle : ${gap} mm ne tient pas dans ce caisson.` }
  }
  return { ok: true, caisson: rebalanceShelves(wall, next) }
}

export function applyRail(wall: Wall, caisson: Caisson, rail: RailMode): { ok: true; caisson: Caisson } | { ok: false; error: string } {
  const next = { ...caisson, rail, hangingGap: caisson.hangingGap || HANGING_DEFAULT }
  const layout = layoutCaisson(wall, { ...next, shelves: caisson.shelves, shelfGaps: [] })
  const blocked = layout.warnings.some((warning) => warning.startsWith('Vide sous la tringle') || warning.startsWith('La tringle'))
  if (rail !== 'aucune' && blocked) {
    return { ok: false, error: `Tringle refusée : ${next.hangingGap} mm ne tiennent pas dans ce caisson.` }
  }
  return { ok: true, caisson: rebalanceShelves(wall, next) }
}

function rebalanceShelves(wall: Wall, caisson: Caisson): Caisson {
  return applyShelfCount(wall, caisson, caisson.shelves)
}

function shelfZoneHeight(wall: Wall, caisson: Caisson): number {
  const layout = layoutCaisson(wall, { ...caisson, shelves: 0, shelfGaps: [] })
  return Math.max(0, layout.shelfZoneTop - layout.shelfZoneBottom)
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

export function doorLabel(mode: DoorMode, width: number): string {
  if (mode === 'aucune') return 'Aucune porte.'
  const count = doorCountForCaisson(width)
  const widths = splitEven(width, count)
  const kind = mode === 'vitree' ? 'vitrée' : 'battante'
  return `${count} porte${count > 1 ? 's' : ''} ${kind}${count > 1 ? 's' : ''} de ${widths.join(' / ')} mm`
}
