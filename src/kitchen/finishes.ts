import type { KitchenFinishId } from './types'

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
