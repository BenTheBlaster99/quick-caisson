import { describe, expect, it } from 'vitest'
import { allocateEqualWidths } from '../domain/caissons'
import { defaultProject } from '../domain/project'
import { defaultKitchen } from '../kitchen/project'
import { previewPhrase } from './preview'
import { findMillimetres } from './span'

const clock = { id: 'phrase-test', now: '2026-10-03T00:00:00.000Z' }

describe('phase 3 plan', () => {
  it('turns metres, centimetres, and millimetres into millimetres', () => {
    expect(findMillimetres('3m20')).toBe(3200)
    expect(findMillimetres('3.2m')).toBe(3200)
    expect(findMillimetres('3.20 m')).toBe(3200)
    expect(findMillimetres('3,50 m'.replace(/(\d),(\d)/g, '$1.$2'))).toBe(3500)
    expect(findMillimetres('3 metres 20')).toBe(3200)
    expect(findMillimetres('3 m 20')).toBe(3200)
    expect(findMillimetres('320cm')).toBe(3200)
    expect(findMillimetres('3200mm')).toBe(3200)
    expect(findMillimetres('3200')).toBe(3200)
  })

  it('gives leftover millimetres to the last bays and keeps the exact width', () => {
    expect(allocateEqualWidths(3500, 6)).toEqual([583, 583, 583, 583, 584, 584])
    expect(allocateEqualWidths(3500, 6).reduce((sum, width) => sum + width, 0)).toBe(3500)
    expect(allocateEqualWidths(3200, 5)).toEqual([640, 640, 640, 640, 640])
    expect(allocateEqualWidths(3200, 6)).toEqual([533, 533, 533, 533, 534, 534])
  })

  it('reads a dressing of 3m20 with five equal bays', () => {
    const preview = previewPhrase('Crée un dressing de 3m20 avec 5 caissons', 'dressing', defaultProject(), sequence(), clock)
    expect(preview.status).toBe('valid')
    expect(preview.dressing?.wall.width).toBe(3200)
    expect(preview.dressing?.caissons.map((caisson) => caisson.width)).toEqual([640, 640, 640, 640, 640])
    expect(preview.source).toBe('phrase')
    expect(preview.id).toBe('phrase-test')
  })

  it('splits six bays on a 3200 mm wall instead of refusing the remainder', () => {
    const preview = previewPhrase('Fais 6 caissons égaux', 'dressing', defaultProject(), sequence(), clock)
    expect(preview.status).toBe('valid')
    expect(preview.dressing?.caissons.map((caisson) => caisson.width)).toEqual([533, 533, 533, 533, 534, 534])
    expect(preview.understood.join(' ')).toMatch(/2 mm/)
  })

  it('builds the 3m50 dressing and leaves the open file alone', () => {
    const project = defaultProject()
    const before = structuredClone(project)
    const preview = previewPhrase('Dressing 3m50, six caissons, tiroirs à gauche, double penderie au centre, portes vitrées à droite.', 'dressing', project, sequence(), clock)
    expect(project).toEqual(before)
    expect(preview.status).toBe('valid')
    expect(preview.dressing?.wall.width).toBe(3500)
    expect(preview.dressing?.caissons.map((caisson) => caisson.width)).toEqual([583, 583, 583, 583, 584, 584])
    expect(preview.dressing?.caissons.slice(0, 2).map((caisson) => caisson.drawers)).toEqual([1, 1])
    expect(preview.dressing?.caissons.slice(2, 4).map((caisson) => caisson.rail)).toEqual(['double', 'double'])
    expect(preview.dressing?.caissons.slice(4).map((caisson) => caisson.door)).toEqual(['vitree', 'vitree'])
    expect(preview.understood.join(' ')).toMatch(/caissons 3 et 4/)
    expect(preview.checks.every((check) => check.ok)).toBe(true)
  })

  it('refuses six bays when one would fall under 300 mm, and writes nothing', () => {
    const project = defaultProject()
    const preview = previewPhrase('Dressing de 1m70, six caissons', 'dressing', project, sequence(), clock)
    expect(preview.status).toBe('invalid')
    expect(preview.dressing).toBeNull()
    expect(project.caissons).toHaveLength(4)
    expect(preview.checks[0]?.ok).toBe(false)
    expect(preview.checks[0]?.text).toMatch(/300/)
  })

  it('grows the third bay by an absolute width or by a relative delta', () => {
    const absolute = previewPhrase('Agrandis le troisième caisson à 900', 'dressing', defaultProject(), sequence(), clock)
    expect(absolute.dressing?.caissons.map((caisson) => caisson.width)).toEqual([800, 800, 900, 700])
    const relative = previewPhrase('Agrandis le troisième caisson de 100', 'dressing', defaultProject(), sequence(), clock)
    expect(relative.status).toBe('valid')
    expect(relative.dressing?.caissons.map((caisson) => caisson.width)).toEqual([800, 800, 900, 700])
    expect(relative.understood.join(' ')).toMatch(/\+100/)
  })

  it('clears the third bay drawers', () => {
    const preview = previewPhrase('Enlève les tiroirs du troisième', 'dressing', defaultProject(), sequence(), clock)
    expect(preview.dressing?.caissons[2].drawers).toBe(0)
    expect(preview.dressing?.caissons[3].drawers).toBe(2)
  })

  it('asks which centre bay, and does not guess', () => {
    const project = defaultProject()
    const preview = previewPhrase('Mets une penderie au milieu', 'dressing', project, sequence(), clock)
    expect(preview.status).toBe('ambiguous')
    expect(preview.dressing).toBeNull()
    expect(preview.question).toMatch(/caisson 2/)
    expect(preview.question).toMatch(/caisson 3/)
    expect(project.caissons[1].rail).toBe('double')
  })

  it('refuses a width the dressing screen cannot set', () => {
    const preview = previewPhrase('Agrandis le troisième caisson à 50', 'dressing', defaultProject(), sequence(), clock)
    expect(preview.status).toBe('invalid')
    expect(preview.dressing).toBeNull()
    expect(preview.error).toMatch(/300/)
  })

  it('leaves the file alone for an unknown phrase, a photo, or a kitchen sentence', () => {
    const project = defaultProject()
    expect(previewPhrase('bonjour', 'dressing', project, sequence(), clock).status).toBe('unknown')
    expect(previewPhrase('voici une photo du mur', 'dressing', project, sequence(), clock).status).toBe('unknown')
    const kitchen = previewPhrase('évier 800', 'dressing', project, sequence(), clock)
    expect(kitchen.status).toBe('unknown')
    expect(kitchen.error).toMatch(/cuisine/)
    expect(project.wall.width).toBe(3200)
  })

  it('keeps the sink at 800 and refuses 500 without writing', () => {
    const kitchen = defaultKitchen()
    const before = structuredClone(kitchen)
    const kept = previewPhrase('évier 800', 'cuisine', kitchen, sequence(), clock)
    expect(kept.status).toBe('valid')
    expect(kept.kitchen?.columns.find((column) => column.id === 'k3')?.width).toBe(800)
    const refused = previewPhrase('évier 500', 'cuisine', kitchen, sequence(), clock)
    expect(refused.status).toBe('invalid')
    expect(refused.kitchen).toBeNull()
    expect(kitchen).toEqual(before)
  })

  it('moves the island 200 mm from where it is', () => {
    const kitchen = defaultKitchen()
    const moved = previewPhrase("déplace l'îlot de 200 mm vers la gauche", 'cuisine', kitchen, sequence(), clock)
    expect(moved.status).toBe('valid')
    expect(moved.kitchen?.room.islandX).toBe(kitchen.room.islandX - 200)
    expect(moved.understood.join(' ')).toMatch(/en plus/)
  })

  it('does not apply a sentence that would lose the only oven', () => {
    const kitchen = defaultKitchen()
    const before = kitchen.columns.map((column) => column.base)
    const preview = previewPhrase('Cuisine de 3m80, évier 800, lave-vaisselle à droite, four sous plaque', 'cuisine', kitchen, sequence(), clock)
    expect(preview.status).toBe('invalid')
    expect(preview.kitchen).toBeNull()
    expect(preview.error).toMatch(/four/)
    expect(kitchen.columns.map((column) => column.base)).toEqual(before)
  })
})

function sequence(): () => string {
  let n = 0
  return () => `id-${n++}`
}
