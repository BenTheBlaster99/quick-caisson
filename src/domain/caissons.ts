import { LIMITS, MAX_CAISSON, MIN_CAISSON } from './rules'
import type { Caisson } from './types'

export function sumWidths(widths: number[]): number {
  return widths.reduce((total, width) => total + width, 0)
}

export function caissonCountLabel(count: number): string {
  return count > 1 ? `${count} caissons` : `${count} caisson`
}

function isLocked(locked: boolean[], index: number): boolean {
  return locked[index] === true
}

/** Free bays, from the right. A locked bay is skipped. */
function absorbOrder(count: number, locked: boolean[]): number[] {
  const order: number[] = []
  for (let index = count - 1; index >= 0; index -= 1) {
    if (!isLocked(locked, index)) order.push(index)
  }
  return order
}

/**
 * The neighbour that gives or takes the difference.
 * Prefer the right side. The last caisson prefers the left.
 * Locked bays are skipped.
 */
function partnerOrder(index: number, count: number, locked: boolean[]): number[] {
  const order: number[] = []
  if (index < count - 1) {
    for (let cursor = index + 1; cursor < count; cursor += 1) order.push(cursor)
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) order.push(cursor)
  return order.filter((cursor) => !isLocked(locked, cursor))
}

/**
 * Wall width changes from the right: the last unlocked caisson absorbs the delta,
 * then the unlocked bay on its left, inside 300–1200 mm.
 */
export function redistribute(widths: number[], newTotal: number, locked: boolean[] = []): number[] | null {
  const count = widths.length
  if (count === 0) return null
  const range = wallWidthRange(count, widths, locked)
  if (newTotal < range.min || newTotal > range.max) return null

  const next = [...widths]
  let delta = newTotal - sumWidths(next)
  if (delta === 0) return next

  const order = absorbOrder(count, locked)
  if (order.length === 0) return null

  if (delta > 0) {
    for (const index of order) {
      if (delta === 0) break
      const room = MAX_CAISSON - next[index]
      const add = Math.min(room, delta)
      next[index] += add
      delta -= add
    }
  } else {
    delta = -delta
    for (const index of order) {
      if (delta === 0) break
      const room = next[index] - MIN_CAISSON
      const sub = Math.min(room, delta)
      next[index] -= sub
      delta -= sub
    }
  }

  if (delta !== 0) return null
  return next
}

/** Widths the wall can take. Locked bays stay inside that total. */
export function wallWidthRange(count: number, widths: number[] = [], locked: boolean[] = []): { min: number; max: number } {
  const hasLocks = locked.some((item) => item) && widths.length === count
  if (!hasLocks) {
    return {
      min: Math.max(LIMITS.width.min, count * MIN_CAISSON),
      max: Math.min(LIMITS.width.max, count * MAX_CAISSON),
    }
  }
  const fixed = widths.reduce((total, width, index) => total + (isLocked(locked, index) ? width : 0), 0)
  const free = locked.filter((item) => !item).length
  return {
    min: Math.max(LIMITS.width.min, fixed + free * MIN_CAISSON),
    max: Math.min(LIMITS.width.max, fixed + free * MAX_CAISSON),
  }
}

export function wallResizeError(count: number, widths: number[] = [], locked: boolean[] = []): string {
  const { min, max } = wallWidthRange(count, widths, locked)
  const locks = locked.some((item) => item) ? ' Les caissons verrouillés ne bougent pas.' : ''
  return `Largeur refusée : avec ${caissonCountLabel(count)}, la limite est ${min}–${max} mm. Ajoutez ou retirez un caisson pour changer cette plage.${locks}`
}

export type WidthResult = { ok: true; widths: number[] } | { ok: false; error: string }

/**
 * A width edit takes from, or gives to, the caisson on the right.
 * The last caisson trades with the one on its left.
 */
export function setCaissonWidth(widths: number[], index: number, nextWidth: number, locked: boolean[] = []): WidthResult {
  if (!Number.isInteger(nextWidth)) {
    return { ok: false, error: 'La largeur doit être un nombre entier de millimètres.' }
  }
  if (index < 0 || index >= widths.length) {
    return { ok: false, error: 'Caisson introuvable.' }
  }
  if (isLocked(locked, index)) {
    return { ok: false, error: 'Largeur verrouillée. Déverrouillez ce caisson pour la changer.' }
  }
  if (nextWidth < MIN_CAISSON || nextWidth > MAX_CAISSON) {
    return {
      ok: false,
      error: `Largeur refusée : un caisson fait entre ${MIN_CAISSON} et ${MAX_CAISSON} mm.`,
    }
  }
  if (widths.length === 1) {
    if (nextWidth !== widths[0]) {
      return {
        ok: false,
        error: 'Largeur refusée : ce caisson fait toute la largeur du mur. Modifiez la largeur du mur.',
      }
    }
    return { ok: true, widths: [...widths] }
  }

  const partners = partnerOrder(index, widths.length, locked)
  if (partners.length === 0) {
    return { ok: false, error: 'Largeur refusée : les autres caissons sont verrouillés.' }
  }
  const neighbour = partners[0]
  const delta = nextWidth - widths[index]
  const neighbourNext = widths[neighbour] - delta
  if (neighbourNext < MIN_CAISSON || neighbourNext > MAX_CAISSON) {
    const side = neighbour > index ? 'de droite' : 'de gauche'
    return {
      ok: false,
      error: `Largeur refusée : le caisson ${side} passerait à ${neighbourNext} mm (${MIN_CAISSON}–${MAX_CAISSON}).`,
    }
  }

  const next = [...widths]
  next[index] = nextWidth
  next[neighbour] = neighbourNext
  return { ok: true, widths: next }
}

export function widestIndex(caissons: Caisson[]): number {
  let index = 0
  for (let cursor = 1; cursor < caissons.length; cursor += 1) {
    if (caissons[cursor].width > caissons[index].width) index = cursor
  }
  return index
}

export type StructureResult =
  | { ok: true; caissons: Caisson[]; selectedIndex: number }
  | { ok: false; error: string }

/** Split the widest unlocked caisson in half, only if both halves are at least 300 mm. */
export function addCaisson(caissons: Caisson[], createId: () => string): StructureResult {
  if (caissons.length === 0) return { ok: false, error: 'Aucun caisson à couper.' }
  const unlocked = caissons.map((caisson, index) => ({ caisson, index })).filter((item) => !item.caisson.locked)
  if (unlocked.length === 0) return { ok: false, error: 'Ajout refusé : tous les caissons sont verrouillés.' }
  const index = widestIndex(unlocked.map((item) => item.caisson))
  const sourceIndex = unlocked[index].index
  const width = caissons[sourceIndex].width
  const left = Math.floor(width / 2)
  const right = width - left
  if (left < MIN_CAISSON || right < MIN_CAISSON || left > MAX_CAISSON || right > MAX_CAISSON) {
    return {
      ok: false,
      error: `Ajout refusé : le caisson le plus large (${width} mm) ne peut pas être coupé en deux parties d'au moins ${MIN_CAISSON} mm.`,
    }
  }

  const source = caissons[sourceIndex]
  const created: Caisson = { ...source, id: createId(), width: right, locked: false, shelfGaps: [...source.shelfGaps] }
  const next = caissons.map((caisson, cursor) =>
    cursor === sourceIndex ? { ...caisson, width: left, shelfGaps: [...source.shelfGaps] } : caisson,
  )
  next.splice(sourceIndex + 1, 0, created)
  return { ok: true, caissons: next, selectedIndex: sourceIndex + 1 }
}

/**
 * Copy the interior onto a new bay. The source width stays.
 * The new width is taken from the other unlocked bays, from the right.
 */
export function duplicateCaisson(caissons: Caisson[], index: number, createId: () => string): StructureResult {
  if (index < 0 || index >= caissons.length) return { ok: false, error: 'Caisson introuvable.' }
  const source = caissons[index]
  const donors = caissons
    .map((caisson, cursor) => ({ caisson, cursor }))
    .filter((item) => item.cursor !== index && !item.caisson.locked)
    .sort((a, b) => b.cursor - a.cursor)
  const spare = donors.reduce((total, item) => total + (item.caisson.width - MIN_CAISSON), 0)
  if (spare < MIN_CAISSON) {
    return {
      ok: false,
      error: `Duplication refusée : les autres caissons n'ont pas ${MIN_CAISSON} mm à donner. La largeur du mur ne change pas.`,
    }
  }
  const wanted = Math.min(source.width, MAX_CAISSON, spare)
  const next = caissons.map((caisson) => ({ ...caisson, shelfGaps: [...caisson.shelfGaps] }))
  let need = wanted
  for (const donor of donors) {
    if (need === 0) break
    const give = Math.min(need, next[donor.cursor].width - MIN_CAISSON)
    next[donor.cursor] = { ...next[donor.cursor], width: next[donor.cursor].width - give }
    need -= give
  }
  const copy: Caisson = { ...source, id: createId(), width: wanted, locked: false, shelfGaps: [...source.shelfGaps] }
  next.splice(index + 1, 0, copy)
  return { ok: true, caissons: next, selectedIndex: index + 1 }
}

/** Give the removed width to the right neighbour, or to the left if it is the last. */
export function removeCaisson(caissons: Caisson[], index: number): StructureResult {
  if (caissons.length <= 1) {
    return { ok: false, error: 'Suppression refusée : il reste un seul caisson.' }
  }
  if (index < 0 || index >= caissons.length) {
    return { ok: false, error: 'Caisson introuvable.' }
  }

  const partners = partnerOrder(index, caissons.length, caissons.map((caisson) => caisson.locked))
  if (partners.length === 0) {
    return { ok: false, error: 'Suppression refusée : les autres caissons sont verrouillés.' }
  }
  const recipient = partners[0]
  const merged = caissons[recipient].width + caissons[index].width
  if (merged > MAX_CAISSON) {
    return {
      ok: false,
      error: `Suppression refusée : le caisson voisin passerait à ${merged} mm (maxi ${MAX_CAISSON}).`,
    }
  }

  const next = caissons.filter((_, cursor) => cursor !== index)
  const recipientIndex = recipient > index ? recipient - 1 : recipient
  next[recipientIndex] = { ...next[recipientIndex], width: merged }
  return { ok: true, caissons: next, selectedIndex: recipientIndex }
}
