import type { Step, WidthOp } from './plan'
import { COUNT_PATTERN, findMillimetres, readCount } from './span'

const ORDINALS = ['premier', 'deuxieme', 'troisieme', 'quatrieme', 'cinquieme', 'sixieme', 'septieme', 'huitieme']

export type PhraseResult = { ok: true; steps: Step[] } | { ok: false; error: string }

export function readPhrase(text: string, mode: 'dressing' | 'cuisine'): PhraseResult {
  const source = normalize(text)
  if (!source) return { ok: false, error: 'Écrivez une phrase. Le fichier n’a pas changé.' }
  if (/photo|image|plan scanne/.test(source)) {
    return { ok: false, error: 'Une photo n’est pas encore une commande. Le fichier n’a pas changé.' }
  }
  const clauses = source.split(/,| et /).map((item) => item.trim()).filter(Boolean)
  const steps: Step[] = []
  for (const clause of clauses) {
    const read = mode === 'dressing' ? dressingClause(clause) : kitchenClause(clause)
    if (!read.ok) return read
    steps.push(...read.steps)
  }
  if (steps.length === 0) return { ok: false, error: 'Cette phrase n’est pas encore une commande. Le fichier n’a pas changé.' }
  return { ok: true, steps }
}

export const phraseProvider = { id: 'phrase', read: readPhrase }

function dressingClause(clause: string): PhraseResult {
  if (/cuisine|evier|ilot|lave/.test(clause)) {
    return { ok: false, error: 'Cette phrase concerne la cuisine. Le dressing n’a pas changé.' }
  }
  const grown = clause.match(new RegExp(`agrandis le (\\w+|\\d+)(?:e|er)? caisson (a|de) (.+)`))
  if (grown) {
    const index = ordinal(grown[1])
    if (index === null) return { ok: false, error: 'Le numéro du caisson n’est pas clair.' }
    const mm = findMillimetres(grown[3])
    if (mm === null) return { ok: false, error: 'La largeur n’est pas un nombre de millimètres.' }
    if (grown[2] === 'de') {
      return ok([stepWidth(index, { kind: 'delta', deltaMm: mm }, `Caisson ${index + 1} : +${mm} mm.`)])
    }
    return ok([stepWidth(index, { kind: 'absolute', widthMm: mm }, `Caisson ${index + 1} à ${mm} mm.`)])
  }
  const shrunk = clause.match(new RegExp(`(?:reduis|diminue) le (\\w+|\\d+)(?:e|er)? caisson de (.+)`))
  if (shrunk) {
    const index = ordinal(shrunk[1])
    if (index === null) return { ok: false, error: 'Le numéro du caisson n’est pas clair.' }
    const mm = findMillimetres(shrunk[2])
    if (mm === null) return { ok: false, error: 'La largeur n’est pas un nombre de millimètres.' }
    return ok([stepWidth(index, { kind: 'delta', deltaMm: -mm }, `Caisson ${index + 1} : −${mm} mm.`)])
  }
  const drawers = clause.match(new RegExp(`enleve les tiroirs du (\\w+|\\d+)`))
  if (drawers) {
    const index = ordinal(drawers[1])
    if (index === null) return { ok: false, error: 'Le numéro du caisson n’est pas clair.' }
    return ok([{ action: 'dressing.clear_drawers', ref: { kind: 'ordinal', index }, label: `Retire les tiroirs du caisson ${index + 1}.` }])
  }
  const shelves = clause.match(new RegExp(`(${COUNT_PATTERN})\\s+etageres?(?: supplementaires)?(?: sur le (\\w+|\\d+))?`))
  if (shelves) {
    if (!shelves[2]) return { ok: false, error: 'Indiquez le caisson. Le fichier n’a pas changé.' }
    const index = ordinal(shelves[2])
    if (index === null) return { ok: false, error: 'Le numéro du caisson n’est pas clair.' }
    const count = readCount(shelves[1])
    if (count === null) return { ok: false, error: 'Le nombre d’étagères n’est pas clair.' }
    return ok([{ action: 'dressing.add_shelves', ref: { kind: 'ordinal', index }, count, label: `${count} étagères de plus sur le caisson ${index + 1}.` }])
  }
  if (/portes vitrees sur les deux derniers/.test(clause)) {
    return ok([{ action: 'dressing.set_door', ref: { kind: 'last', count: 2 }, label: 'Portes vitrées sur les deux derniers caissons.' }])
  }
  if (/portes vitrees a droite/.test(clause)) {
    return ok([{ action: 'dressing.set_door', ref: { kind: 'zone', zone: 'right' }, label: 'Portes vitrées à droite.' }])
  }
  const rail = clause.match(new RegExp(`penderie double sur le (\\w+|\\d+)`))
  if (rail) {
    const index = ordinal(rail[1])
    if (index === null) return { ok: false, error: 'Le numéro du caisson n’est pas clair.' }
    return ok([{ action: 'dressing.set_rail', ref: { kind: 'ordinal', index }, rail: 'double', label: `Penderie double sur le caisson ${index + 1}.` }])
  }
  if (/(?:penderie double|double penderie|une penderie|penderie) au (?:centre|milieu)/.test(clause)) {
    const railMode = /double/.test(clause) ? 'double' : 'haute'
    const name = railMode === 'double' ? 'Penderie double au centre.' : 'Penderie au centre.'
    return ok([{ action: 'dressing.set_rail', ref: { kind: 'zone', zone: 'center' }, rail: railMode, label: name }])
  }
  const leftDrawers = clause.match(new RegExp(`(?:(${COUNT_PATTERN})\\s+)?tiroirs? a gauche`))
  if (leftDrawers) {
    const count = leftDrawers[1] ? readCount(leftDrawers[1]) : 1
    if (count === null || count < 1) return { ok: false, error: 'Le nombre de tiroirs n’est pas clair.' }
    return ok([{ action: 'dressing.set_drawers', ref: { kind: 'zone', zone: 'left' }, count, label: count === 1 ? '1 tiroir à gauche.' : `${count} tiroirs à gauche.` }])
  }
  if (/dressing/.test(clause)) {
    const width = findMillimetres(clause)
    if (width === null) return { ok: false, error: 'La largeur n’est pas un nombre de millimètres.' }
    const steps: Step[] = [{ action: 'dressing.set_wall', widthMm: width, label: `Mur à ${width} mm.` }]
    const countWord = clause.match(new RegExp(`(${COUNT_PATTERN})\\s+caissons`))
    if (countWord) {
      const count = readCount(countWord[1])
      if (count === null) return { ok: false, error: 'Le nombre de caissons n’est pas clair.' }
      steps.push({ action: 'dressing.equal_bays', count, label: `${count} caissons.` })
    }
    return ok(steps)
  }
  const equal = clause.match(new RegExp(`(${COUNT_PATTERN})\\s+caissons?(?:\\s+egaux)?`))
  if (equal) {
    const count = readCount(equal[1])
    if (count === null) return { ok: false, error: 'Le nombre de caissons n’est pas clair.' }
    return ok([{ action: 'dressing.equal_bays', count, label: `${count} caissons.` }])
  }
  return { ok: false, error: 'Cette phrase n’est pas encore une commande. Le fichier n’a pas changé.' }
}

function kitchenClause(clause: string): PhraseResult {
  if (/dressing|caisson|etagere|penderie/.test(clause) && !/cuisine|evier|ilot|plaque|four|lave/.test(clause)) {
    return { ok: false, error: 'Cette phrase concerne le dressing. La cuisine n’a pas changé.' }
  }
  if (/cuisine|largeur/.test(clause)) {
    const mm = findMillimetres(clause)
    if (mm === null) return { ok: false, error: 'La largeur n’est pas un nombre de millimètres.' }
    return ok([{ action: 'kitchen.set_width', widthMm: mm, label: `Largeur ${mm} mm.` }])
  }
  const sink = clause.match(/evier(?: de)?\s+(.+)/)
  if (sink) {
    const mm = findMillimetres(sink[1])
    if (mm === null) return { ok: false, error: 'La largeur de l’évier n’est pas un nombre de millimètres.' }
    return ok([{ action: 'kitchen.set_sink', widthMm: mm, label: `Évier à ${mm} mm.` }])
  }
  if (/lave[ -]?vaisselle a droite/.test(clause)) {
    return ok([{ action: 'kitchen.dishwasher_right', label: 'Le meuble à droite de l’évier devient un lave-vaisselle.' }])
  }
  if (/four sous plaque/.test(clause)) {
    return ok([{ action: 'kitchen.oven_under_hob', label: 'Le four passe sous la plaque.' }])
  }
  const island = clause.match(/ilot de\s+(.+?)\s+vers (la gauche|la droite|le fond|l'avant|l avant)/)
  if (island) {
    const mm = findMillimetres(island[1])
    if (mm === null) return { ok: false, error: 'Le déplacement n’est pas un nombre de millimètres.' }
    const way = island[2]
    const dx = way === 'la droite' ? mm : way === 'la gauche' ? -mm : 0
    const dz = way.includes('avant') ? mm : way === 'le fond' ? -mm : 0
    return ok([{ action: 'kitchen.move_island', dx, dz, label: `Îlot : ${mm} mm vers ${way.replace("'", '')}, en plus de sa position.` }])
  }
  return { ok: false, error: 'Cette phrase n’est pas encore une commande. Le fichier n’a pas changé.' }
}

function stepWidth(index: number, width: WidthOp, label: string): Step {
  return { action: 'dressing.set_width', ref: { kind: 'ordinal', index }, width, label }
}

function ok(steps: Step[]): PhraseResult {
  return { ok: true, steps }
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’]/g, "'")
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function ordinal(word: string): number | null {
  const named = ORDINALS.indexOf(word)
  if (named >= 0) return named
  if (/^\d+$/.test(word)) return Number(word) - 1
  return null
}
