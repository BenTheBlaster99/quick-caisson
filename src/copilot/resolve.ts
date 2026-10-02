import type { BayRef, Exec, Step } from './plan'

export type Resolved =
  | { status: 'ready'; steps: Exec[] }
  | { status: 'ambiguous'; question: string }
  | { status: 'invalid'; error: string }

export function resolveDressing(currentCount: number, steps: Step[]): Resolved {
  const counted = steps.find((step) => step.action === 'dressing.equal_bays')
  const count = counted && counted.action === 'dressing.equal_bays' ? counted.count : currentCount
  const zones = new Set(steps.flatMap((step) => { const zone = zoneOf(step); return zone ? [zone] : [] }))
  const partition = zones.size >= 2
  const exec: Exec[] = []
  for (const step of steps) {
    if (step.action === 'dressing.set_wall') {
      exec.push({ action: step.action, widthMm: step.widthMm })
      continue
    }
    if (step.action === 'dressing.equal_bays') {
      exec.push({ action: step.action, count: step.count })
      continue
    }
    if (step.action === 'kitchen.set_width' || step.action === 'kitchen.set_sink' || step.action === 'kitchen.dishwasher_right' || step.action === 'kitchen.oven_under_hob' || step.action === 'kitchen.move_island') {
      return { status: 'invalid', error: 'Cette phrase concerne la cuisine. Le dressing n’a pas changé.' }
    }
    const indices = bayIndices(count, step.ref, partition)
    if (indices === 'ambiguous') {
      const left = count / 2
      const right = left + 1
      return {
        status: 'ambiguous',
        question: `Avec ${count} caissons, le centre peut être le caisson ${left} ou le caisson ${right}.`,
      }
    }
    if (typeof indices === 'string') return { status: 'invalid', error: indices }
    if (step.action === 'dressing.set_width') {
      if (indices.length !== 1) return { status: 'invalid', error: 'Indiquez un seul caisson pour la largeur.' }
      exec.push({ action: step.action, index: indices[0], width: step.width })
      continue
    }
    if (step.action === 'dressing.add_shelves') {
      if (indices.length !== 1) return { status: 'invalid', error: 'Indiquez un seul caisson pour les étagères.' }
      exec.push({ action: step.action, index: indices[0], count: step.count })
      continue
    }
    if (step.action === 'dressing.clear_drawers') {
      exec.push({ action: step.action, indices })
      continue
    }
    if (step.action === 'dressing.set_drawers') {
      exec.push({ action: step.action, indices, count: step.count })
      continue
    }
    if (step.action === 'dressing.set_door') {
      exec.push({ action: step.action, indices })
      continue
    }
    exec.push({ action: step.action, indices, rail: step.rail, role: step.ref.kind === 'zone' })
  }
  return { status: 'ready', steps: exec }
}

function zoneOf(step: Step): 'left' | 'center' | 'right' | null {
  if (!('ref' in step) || step.ref.kind !== 'zone') return null
  return step.ref.zone
}

function bayIndices(count: number, ref: BayRef, partition: boolean): number[] | 'ambiguous' | string {
  if (ref.kind === 'ordinal') {
    if (ref.index < 0 || ref.index >= count) return `Le caisson ${ref.index + 1} n’existe pas.`
    return [ref.index]
  }
  if (ref.kind === 'last') {
    if (count < ref.count) return 'Il n’y a pas assez de caissons.'
    return Array.from({ length: ref.count }, (_, index) => count - ref.count + index)
  }
  if (!partition && ref.zone === 'center' && count % 2 === 0) return 'ambiguous'
  const span = zoneSpan(count, ref.zone, partition)
  if (typeof span === 'string') return span
  return span
}

function zoneSpan(count: number, zone: 'left' | 'center' | 'right', partition: boolean): number[] | string {
  if (!partition) {
    if (count < 1) return 'Il n’y a pas de caisson.'
    if (zone === 'left') return [0]
    if (zone === 'right') return [count - 1]
    return [Math.floor(count / 2)]
  }
  const centerCount = count % 2 === 0 ? 2 : 1
  const side = (count - centerCount) / 2
  if (side < 1) return 'Il faut au moins 3 caissons pour partager gauche, centre et droite.'
  const start = zone === 'left' ? 0 : zone === 'center' ? side : side + centerCount
  const length = zone === 'center' ? centerCount : side
  return Array.from({ length }, (_, index) => start + index)
}
