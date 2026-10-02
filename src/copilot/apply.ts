import { allocateEqualWidths, setCaissonWidth } from '../domain/caissons'
import { applyRail, applyShelfCount, clampShelves } from '../domain/layout'
import { applyWidths, setWallField } from '../domain/project'
import { MAX_CAISSON, MIN_CAISSON } from '../domain/rules'
import type { Caisson, Project } from '../domain/types'
import { inspectKitchen, setColumnWidth } from '../kitchen/layout'
import { moveIsland, setKitchenWall } from '../kitchen/project'
import type { KitchenColumn, KitchenProject } from '../kitchen/types'
import type { Exec } from './plan'

type Applied<T> = { ok: true; project: T } | { ok: false; error: string }

export function applyDressing(project: Project, steps: Exec[], createId: () => string): Applied<Project> {
  let next = structuredClone(project)
  for (const step of steps) {
    const result = applyDressingOne(next, step, createId)
    if (!result.ok) return result
    next = result.project
  }
  return { ok: true, project: next }
}

export function applyKitchen(project: KitchenProject, steps: Exec[]): Applied<KitchenProject> {
  let next = structuredClone(project)
  for (const step of steps) {
    const result = applyKitchenOne(next, step)
    if (!result.ok) return result
    const refusal = newRefusal(project, result.project)
    if (refusal) return { ok: false, error: refusal }
    next = result.project
  }
  return { ok: true, project: next }
}

function applyDressingOne(project: Project, step: Exec, createId: () => string): Applied<Project> {
  if (step.action === 'dressing.set_wall') {
    const result = setWallField(project, 'width', step.widthMm)
    return result.ok ? { ok: true, project: result.project } : result
  }
  if (step.action === 'dressing.equal_bays') return equalBays(project, step.count, createId)
  if (step.action === 'dressing.set_width') {
    const widths = project.caissons.map((caisson) => caisson.width)
    const locked = project.caissons.map((caisson) => caisson.locked)
    const current = widths[step.index]
    const target = step.width.kind === 'absolute' ? step.width.widthMm : current + step.width.deltaMm
    const result = setCaissonWidth(widths, step.index, target, locked)
    if (!result.ok) return result
    return { ok: true, project: applyWidths(project, result.widths) }
  }
  if (step.action === 'dressing.clear_drawers') return mapIndices(project, step.indices, (caisson) => ({ ...caisson, drawers: 0 }))
  if (step.action === 'dressing.add_shelves') {
    const caisson = project.caissons[step.index]
    if (!caisson) return { ok: false, error: 'Caisson introuvable.' }
    const wanted = caisson.shelves + step.count
    if (clampShelves(wanted) !== wanted) return { ok: false, error: `${wanted} étagères ne tiennent pas dans ce caisson.` }
    return mapIndices(project, [step.index], (current) => applyShelfCount(project.wall, current, wanted, project.rules))
  }
  if (step.action === 'dressing.set_drawers') {
    return mapIndices(project, step.indices, (caisson) => applyShelfCount(project.wall, { ...caisson, drawers: step.count, shelves: 0, rail: 'aucune', shelfGaps: [] }, 0, project.rules))
  }
  if (step.action === 'dressing.set_door') {
    return mapIndices(project, step.indices, (caisson) => ({ ...caisson, door: 'vitree', doorFinish: 'verre' }))
  }
  if (step.action === 'dressing.set_rail') {
    let next = project
    for (const index of step.indices) {
      const caisson = next.caissons[index]
      if (!caisson) return { ok: false, error: 'Caisson introuvable.' }
      const base = step.role ? { ...caisson, drawers: 0, shelves: 0, shelfGaps: [] } : caisson
      const result = applyRail(next.wall, base, step.rail, next.rules)
      if (!result.ok) return result
      const written = mapIndices(next, [index], () => result.caisson)
      if (!written.ok) return written
      next = written.project
    }
    return { ok: true, project: next }
  }
  return { ok: false, error: 'Commande inconnue.' }
}

function applyKitchenOne(project: KitchenProject, step: Exec): Applied<KitchenProject> {
  if (step.action === 'kitchen.set_width') {
    const result = setKitchenWall(project, 'width', step.widthMm)
    return result.ok ? { ok: true, project: result.project } : result
  }
  if (step.action === 'kitchen.set_sink') {
    const sinks = project.columns.filter((column) => column.deck === 'evier')
    if (sinks.length === 0) return { ok: false, error: 'Il n’y a pas d’évier.' }
    if (sinks.length > 1) return { ok: false, error: 'Il y a plusieurs éviers. Indiquez lequel.' }
    const index = project.columns.findIndex((column) => column.id === sinks[0].id)
    const result = setColumnWidth(project, index, step.widthMm)
    if (!result.ok) return result
    return { ok: true, project: { ...project, columns: result.columns } }
  }
  if (step.action === 'kitchen.dishwasher_right') {
    const sink = onlySink(project.columns)
    if (!sink.ok) return sink
    const neighbour = project.columns.find((column) => column.wallId === sink.column.wallId && column.x >= sink.column.x + sink.column.width && column.x <= sink.column.x + sink.column.width + 2)
    if (!neighbour) return { ok: false, error: 'Il n’y a pas de meuble contre la droite de l’évier.' }
    if (neighbour.width < project.rules.laveVaisselleMinMm) {
      return { ok: false, error: `Le lave-vaisselle demande ${project.rules.laveVaisselleMinMm} mm. Ce meuble fait ${neighbour.width} mm.` }
    }
    return { ok: true, project: mapColumn(project, neighbour.id, (column) => ({ ...column, kind: 'bas', base: 'lave-vaisselle', deck: 'rien' })) }
  }
  if (step.action === 'kitchen.oven_under_hob') {
    const hosts = project.columns.filter((column) => column.base === 'four' || column.deck === 'plaque')
    if (hosts.length === 0) return { ok: false, error: 'Indiquez le meuble du four. Le fichier n’a pas changé.' }
    if (hosts.length > 1) return { ok: false, error: 'Il y a plusieurs meubles pour le four. Indiquez lequel.' }
    const host = hosts[0]
    const minimum = Math.max(project.rules.fourMinMm, project.rules.plaqueMinMm)
    if (host.width < minimum) return { ok: false, error: `Le four et la plaque demandent ${minimum} mm. Ce meuble fait ${host.width} mm.` }
    return { ok: true, project: mapColumn(project, host.id, (column) => ({ ...column, kind: 'bas', base: 'four', deck: 'plaque', upper: 'aucun' })) }
  }
  if (step.action === 'kitchen.move_island') {
    const moved = moveIsland(project, project.room.islandX + step.dx, project.room.islandZ + step.dz)
    if (moved.room.islandX === project.room.islandX && moved.room.islandZ === project.room.islandZ) {
      return { ok: false, error: 'L’îlot ne peut pas aller plus loin.' }
    }
    return { ok: true, project: moved }
  }
  return { ok: false, error: 'Commande inconnue.' }
}

function equalBays(project: Project, count: number, createId: () => string): Applied<Project> {
  if (!Number.isInteger(count) || count < 1) return { ok: false, error: 'Le nombre de caissons n’est pas clair.' }
  if (project.caissons.some((caisson) => caisson.locked)) return { ok: false, error: 'Un caisson est verrouillé.' }
  const widths = allocateEqualWidths(project.wall.width, count)
  const outside = widths.filter((width) => width < MIN_CAISSON || width > MAX_CAISSON)
  if (outside.length > 0) {
    return { ok: false, error: `Chaque caisson ferait ${widths.join(', ')} mm. La limite est ${MIN_CAISSON}–${MAX_CAISSON} mm.` }
  }
  const seed = project.caissons[0]
  const caissons: Caisson[] = []
  for (let index = 0; index < count; index += 1) {
    const current = project.caissons[index] ?? { ...seed, id: createId(), locked: false, shelfGaps: [...seed.shelfGaps] }
    caissons.push({ ...current, width: widths[index], shelfGaps: [...current.shelfGaps] })
  }
  return { ok: true, project: { ...project, caissons } }
}

function mapIndices(project: Project, indices: number[], change: (caisson: Caisson) => Caisson): Applied<Project> {
  if (indices.some((index) => !project.caissons[index])) return { ok: false, error: 'Caisson introuvable.' }
  const chosen = new Set(indices)
  return { ok: true, project: { ...project, caissons: project.caissons.map((caisson, index) => (chosen.has(index) ? change(caisson) : caisson)) } }
}

function mapColumn(project: KitchenProject, id: string, change: (column: KitchenColumn) => KitchenColumn): KitchenProject {
  return { ...project, columns: project.columns.map((column) => (column.id === id ? change(column) : column)) }
}

function onlySink(columns: KitchenColumn[]): { ok: true; column: KitchenColumn } | { ok: false; error: string } {
  const sinks = columns.filter((column) => column.deck === 'evier')
  if (sinks.length === 0) return { ok: false, error: 'Il n’y a pas d’évier.' }
  if (sinks.length > 1) return { ok: false, error: 'Il y a plusieurs éviers. Indiquez lequel.' }
  return { ok: true, column: sinks[0] }
}

function newRefusal(before: KitchenProject, after: KitchenProject): string | null {
  const previous = new Set(inspectKitchen(before).issues.filter((issue) => issue.level === 'refus').map((issue) => issue.message))
  return inspectKitchen(after).issues.find((issue) => issue.level === 'refus' && !previous.has(issue.message))?.message ?? null
}
