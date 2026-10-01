import type { KitchenProject, KitchenRoom, KitchenShape, WallId } from './types'
import { blankWallFinishes } from './finishes'

export const WALLS: WallId[] = ['A', 'B', 'C', 'D', 'ilot']

export function wallName(id: WallId): string {
  if (id === 'A') return 'Mur du fond'
  if (id === 'B') return 'Mur gauche'
  if (id === 'C') return 'Mur droit'
  if (id === 'D') return 'Mur avant'
  return 'Îlot'
}

export function wallLength(project: Pick<KitchenProject, 'room' | 'wall'>, wallId: WallId): number {
  if (wallId === 'B' || wallId === 'C') return project.room.depth
  if (wallId === 'ilot') return project.room.islandLength
  return project.wall.width
}

export function cornerInset(project: Pick<KitchenProject, 'room' | 'wall'>, wallId: WallId): number {
  if (wallId === 'B' && (project.room.shape === 'l' || project.room.shape === 'u')) return project.wall.baseDepth
  if (wallId === 'C' && project.room.shape === 'u') return project.wall.baseDepth
  return 0
}

/** Linéaire is the back wall, L adds the left wall, U adds the right wall. A wall with a door or a window stays even so the opening has something to sit in. */
export function builtWalls(shape: KitchenShape, openings: { wallId: WallId }[] = []): WallId[] {
  const ids: WallId[] = shape === 'u' ? ['A', 'B', 'C'] : shape === 'l' ? ['A', 'B'] : ['A']
  for (const id of ['B', 'C', 'D'] as const) {
    if (!ids.includes(id) && openings.some((opening) => opening.wallId === id)) ids.push(id)
  }
  return ids
}

export function defaultRoom(width: number): KitchenRoom {
  return {
    shape: 'l',
    depth: 2800,
    island: true,
    islandLength: 1400,
    islandDepth: 700,
    islandX: Math.round((width - 1400) / 2),
    islandZ: 1500,
    finishes: blankWallFinishes(),
  }
}

/** Where a run starts in the room, and which way its local +X / +Z point. */
export function mountRun(room: KitchenRoom, width: number, wallId: WallId, along: number, size: number): { x: number; z: number; rot: number } {
  if (wallId === 'A') return { x: along, z: 0, rot: 0 }
  if (wallId === 'B') return { x: 0, z: along + size, rot: Math.PI / 2 }
  if (wallId === 'C') return { x: width, z: along, rot: -Math.PI / 2 }
  if (wallId === 'D') return { x: along + size, z: room.depth, rot: Math.PI }
  return { x: room.islandX + along, z: room.islandZ, rot: 0 }
}

export function footprint(room: KitchenRoom, width: number, wallId: WallId, along: number, size: number, into: number): { x: number; z: number; w: number; d: number } {
  if (wallId === 'A') return { x: along, z: 0, w: size, d: into }
  if (wallId === 'B') return { x: 0, z: along, w: into, d: size }
  if (wallId === 'C') return { x: width - into, z: along, w: into, d: size }
  if (wallId === 'D') return { x: along, z: room.depth - into, w: size, d: into }
  return { x: room.islandX + along, z: room.islandZ, w: size, d: into }
}

export function slideAlong(occupied: { id: string; x: number; width: number }[], id: string, width: number, desired: number, min: number, max: number): number {
  let x = Math.round(Math.max(min, Math.min(desired, max - width)))
  const others = occupied.filter((item) => item.id !== id).sort((a, b) => a.x - b.x)
  for (let pass = 0; pass < 4; pass += 1) {
    const hit = others.find((item) => x < item.x + item.width && x + width > item.x)
    if (!hit) break
    const left = hit.x - width
    const right = hit.x + hit.width
    x = Math.abs(desired - left) <= Math.abs(desired - right) ? left : right
    x = Math.round(Math.max(min, Math.min(x, max - width)))
  }
  return x
}
