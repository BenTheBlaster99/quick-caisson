import { LIMITS, MAX_CAISSON, MIN_CAISSON } from './rules'
import type { Caisson } from './types'

export function sumWidths(widths: number[]): number {
  return widths.reduce((total, width) => total + width, 0)
}

export function caissonCountLabel(count: number): string {
  return count > 1 ? `${count} caissons` : `${count} caisson`
}

/**
 * Wall width changes from the right: the last caisson absorbs the delta,
 * then its left neighbour, inside 300–1200 mm.
 */
export function redistribute(widths: number[], newTotal: number): number[] | null {
  const count = widths.length
  if (count === 0) return null
  if (newTotal < count * MIN_CAISSON || newTotal > count * MAX_CAISSON) return null

  const next = [...widths]
  let delta = newTotal - sumWidths(next)
  if (delta === 0) return next

  if (delta > 0) {
    for (let index = count - 1; index >= 0 && delta > 0; index -= 1) {
      const room = MAX_CAISSON - next[index]
      const add = Math.min(room, delta)
      next[index] += add
      delta -= add
    }
  } else {
    delta = -delta
    for (let index = count - 1; index >= 0 && delta > 0; index -= 1) {
      const room = next[index] - MIN_CAISSON
      const sub = Math.min(room, delta)
      next[index] -= sub
      delta -= sub
    }
  }

  if (delta !== 0) return null
  return next
}

/** Widths the wall can take with this many caissons: wall limits, and 300–1200 mm each. */
export function wallWidthRange(count: number): { min: number; max: number } {
  return {
    min: Math.max(LIMITS.width.min, count * MIN_CAISSON),
    max: Math.min(LIMITS.width.max, count * MAX_CAISSON),
  }
}

export function wallResizeError(count: number): string {
  const { min, max } = wallWidthRange(count)
  return `Largeur refusée : avec ${caissonCountLabel(count)}, la limite est ${min}–${max} mm. Ajoutez ou retirez un caisson pour changer cette plage.`
}

export type WidthResult = { ok: true; widths: number[] } | { ok: false; error: string }

/**
 * A width edit takes from, or gives to, the caisson on the right.
 * The last caisson trades with the one on its left.
 */
export function setCaissonWidth(widths: number[], index: number, nextWidth: number): WidthResult {
  if (!Number.isInteger(nextWidth)) {
    return { ok: false, error: 'La largeur doit être un nombre entier de millimètres.' }
  }
  if (index < 0 || index >= widths.length) {
    return { ok: false, error: 'Caisson introuvable.' }
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

  const neighbour = index === widths.length - 1 ? index - 1 : index + 1
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

/** Split the widest caisson in half, only if both halves are at least 300 mm. */
export function addCaisson(caissons: Caisson[], createId: () => string): StructureResult {
  if (caissons.length === 0) return { ok: false, error: 'Aucun caisson à couper.' }
  const index = widestIndex(caissons)
  const width = caissons[index].width
  const left = Math.floor(width / 2)
  const right = width - left
  if (left < MIN_CAISSON || right < MIN_CAISSON || left > MAX_CAISSON || right > MAX_CAISSON) {
    return {
      ok: false,
      error: `Ajout refusé : le caisson le plus large (${width} mm) ne peut pas être coupé en deux parties d'au moins ${MIN_CAISSON} mm.`,
    }
  }

  const source = caissons[index]
  const created: Caisson = { ...source, id: createId(), width: right }
  const next = caissons.map((caisson, cursor) =>
    cursor === index ? { ...caisson, width: left } : caisson,
  )
  next.splice(index + 1, 0, created)
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

  const recipient = index === caissons.length - 1 ? index - 1 : index + 1
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
