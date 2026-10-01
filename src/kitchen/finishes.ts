import type { KitchenFinishId, WallFinishId } from './types'

export const KITCHEN_FINISHES: { id: KitchenFinishId; name: string; color: string; carcass: string }[] = [
  { id: 'blanc', name: 'Blanc mat', color: '#f3f0e8', carcass: '#ddd8ce' },
  { id: 'chene-clair', name: 'Chêne clair', color: '#e4c89a', carcass: '#c9aa74' },
  { id: 'chene', name: 'Chêne', color: '#c6a36a', carcass: '#a7844e' },
  { id: 'chene-fonce', name: 'Chêne foncé', color: '#8d643c', carcass: '#6e4c2c' },
  { id: 'gris', name: 'Gris', color: '#c8c9c6', carcass: '#a4a5a2' },
  { id: 'noir', name: 'Noir', color: '#2e3033', carcass: '#1c1e20' },
]

export function kitchenFinish(id: KitchenFinishId) {
  return KITCHEN_FINISHES.find((finish) => finish.id === id) ?? KITCHEN_FINISHES[0]
}

export function readKitchenFinish(value: unknown): KitchenFinishId {
  if (value === 'anthracite') return 'noir'
  if (typeof value === 'string' && KITCHEN_FINISHES.some((finish) => finish.id === value)) return value as KitchenFinishId
  throw new Error('Finition inconnue.')
}

export const WALL_FINISHES: { id: WallFinishId; name: string; color: string; roughness: number; metalness: number }[] = [
  { id: 'blanc', name: 'Blanc', color: '#f4f1eb', roughness: 1, metalness: 0 },
  { id: 'greige', name: 'Greige', color: '#ddd4c6', roughness: 1, metalness: 0 },
  { id: 'sable', name: 'Sable', color: '#e6d2b0', roughness: 1, metalness: 0 },
  { id: 'gris', name: 'Gris', color: '#c5c6c3', roughness: 1, metalness: 0 },
  { id: 'sauge', name: 'Sauge', color: '#c5d0c4', roughness: 1, metalness: 0 },
  { id: 'bleu', name: 'Bleu', color: '#c5d3dc', roughness: 1, metalness: 0 },
  { id: 'terre', name: 'Terre', color: '#d7b8a2', roughness: 1, metalness: 0 },
  { id: 'noir', name: 'Noir', color: '#3a3c3e', roughness: 0.92, metalness: 0 },
  { id: 'carrelage', name: 'Carrelage', color: '#f7f6f3', roughness: 0.22, metalness: 0.12 },
  { id: 'beton', name: 'Béton', color: '#b7b5b0', roughness: 0.95, metalness: 0 },
  { id: 'bois', name: 'Bois', color: '#c4a574', roughness: 0.7, metalness: 0 },
]

export function blankWallFinishes(): Record<'A' | 'B' | 'C' | 'D', WallFinishId> {
  return { A: 'blanc', B: 'blanc', C: 'blanc', D: 'blanc' }
}

export function wallFinish(id: WallFinishId) {
  return WALL_FINISHES.find((finish) => finish.id === id) ?? WALL_FINISHES[0]
}

export function readWallFinish(value: unknown): WallFinishId {
  if (typeof value === 'string' && WALL_FINISHES.some((finish) => finish.id === value)) return value as WallFinishId
  return 'blanc'
}
