import type { Project } from '../domain/types'
import type { KitchenProject } from '../kitchen/types'

export type WidthOp = { kind: 'absolute'; widthMm: number } | { kind: 'delta'; deltaMm: number }

export type BayRef =
  | { kind: 'ordinal'; index: number }
  | { kind: 'zone'; zone: 'left' | 'center' | 'right' }
  | { kind: 'last'; count: number }

export type Step =
  | { action: 'dressing.set_wall'; widthMm: number; label: string }
  | { action: 'dressing.equal_bays'; count: number; label: string }
  | { action: 'dressing.set_width'; ref: BayRef; width: WidthOp; label: string }
  | { action: 'dressing.clear_drawers'; ref: BayRef; label: string }
  | { action: 'dressing.set_drawers'; ref: BayRef; count: number; label: string }
  | { action: 'dressing.add_shelves'; ref: BayRef; count: number; label: string }
  | { action: 'dressing.set_door'; ref: BayRef; label: string }
  | { action: 'dressing.set_rail'; ref: BayRef; rail: 'double' | 'haute'; label: string }
  | { action: 'kitchen.set_width'; widthMm: number; label: string }
  | { action: 'kitchen.set_sink'; widthMm: number; label: string }
  | { action: 'kitchen.dishwasher_right'; label: string }
  | { action: 'kitchen.oven_under_hob'; label: string }
  | { action: 'kitchen.move_island'; dx: number; dz: number; label: string }

export type Exec =
  | { action: 'dressing.set_wall'; widthMm: number }
  | { action: 'dressing.equal_bays'; count: number }
  | { action: 'dressing.set_width'; index: number; width: WidthOp }
  | { action: 'dressing.clear_drawers'; indices: number[] }
  | { action: 'dressing.set_drawers'; indices: number[]; count: number }
  | { action: 'dressing.add_shelves'; index: number; count: number }
  | { action: 'dressing.set_door'; indices: number[] }
  | { action: 'dressing.set_rail'; indices: number[]; rail: 'double' | 'haute'; role: boolean }
  | { action: 'kitchen.set_width'; widthMm: number }
  | { action: 'kitchen.set_sink'; widthMm: number }
  | { action: 'kitchen.dishwasher_right' }
  | { action: 'kitchen.oven_under_hob' }
  | { action: 'kitchen.move_island'; dx: number; dz: number }

export type Check = { ok: boolean; text: string }

export type Preview = {
  id: string
  source: 'phrase'
  createdAt: string
  status: 'valid' | 'invalid' | 'ambiguous' | 'unknown'
  understood: string[]
  checks: Check[]
  question: string | null
  error: string | null
  dressing: Project | null
  kitchen: KitchenProject | null
}
