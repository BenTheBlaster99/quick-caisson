import type { Project } from '../domain/types'
import type { KitchenProject } from '../kitchen/types'
import { applyDressing, applyKitchen } from './apply'
import type { Check, Exec, Preview, Step } from './plan'
import { readPhrase } from './phrase'
import { resolveDressing } from './resolve'

type Clock = { id: string; now: string }

export function previewPhrase(text: string, mode: 'dressing' | 'cuisine', project: Project | KitchenProject, createId: () => string, clock?: Clock): Preview {
  const phrase = readPhrase(text, mode)
  const stamp = identity(clock)
  if (!phrase.ok) {
    return { ...stamp, status: 'unknown', understood: [], checks: [], question: null, error: phrase.error, dressing: null, kitchen: null }
  }
  if (mode === 'dressing') {
    return previewDressing(project as Project, phrase.steps, createId, stamp)
  }
  return previewKitchen(project as KitchenProject, phrase.steps, stamp)
}

function previewDressing(project: Project, steps: Step[], createId: () => string, stamp: ReturnType<typeof identity>): Preview {
  const resolved = resolveDressing(project.caissons.length, steps)
  if (resolved.status === 'ambiguous') {
    return { ...stamp, status: 'ambiguous', understood: steps.map((step) => step.label), checks: [], question: resolved.question, error: null, dressing: null, kitchen: null }
  }
  if (resolved.status === 'invalid') {
    return refused(stamp, steps, resolved.error)
  }
  const applied = applyDressing(project, resolved.steps, createId)
  if (!applied.ok) return refused(stamp, steps, applied.error)
  const checks = verifyDressing(applied.project, resolved.steps)
  if (checks.some((check) => !check.ok)) {
    return refused(stamp, steps, checks.find((check) => !check.ok)?.text ?? 'La vérification a échoué.')
  }
  return {
    ...stamp,
    status: 'valid',
    understood: describeDressing(project, applied.project, resolved.steps),
    checks,
    question: null,
    error: null,
    dressing: applied.project,
    kitchen: null,
  }
}

function previewKitchen(project: KitchenProject, steps: Step[], stamp: ReturnType<typeof identity>): Preview {
  const exec = kitchenExec(steps)
  if (!exec) return refused(stamp, steps, 'Cette phrase concerne le dressing. La cuisine n’a pas changé.')
  const applied = applyKitchen(project, exec)
  if (!applied.ok) return refused(stamp, steps, applied.error)
  return {
    ...stamp,
    status: 'valid',
    understood: steps.map((step) => step.label),
    checks: steps.map((step) => ({ ok: true, text: step.label })),
    question: null,
    error: null,
    dressing: null,
    kitchen: applied.project,
  }
}

function kitchenExec(steps: Step[]): Exec[] | null {
  const exec: Exec[] = []
  for (const step of steps) {
    if (step.action === 'kitchen.set_width') exec.push({ action: step.action, widthMm: step.widthMm })
    else if (step.action === 'kitchen.set_sink') exec.push({ action: step.action, widthMm: step.widthMm })
    else if (step.action === 'kitchen.dishwasher_right') exec.push({ action: step.action })
    else if (step.action === 'kitchen.oven_under_hob') exec.push({ action: step.action })
    else if (step.action === 'kitchen.move_island') exec.push({ action: step.action, dx: step.dx, dz: step.dz })
    else return null
  }
  return exec
}

function describeDressing(before: Project, after: Project, steps: Exec[]): string[] {
  const lines: string[] = []
  const widths = after.caissons.map((caisson) => caisson.width)
  for (const step of steps) {
    if (step.action === 'dressing.set_wall') lines.push(`Mur à ${after.wall.width} mm.`)
    if (step.action === 'dressing.equal_bays') {
      const extra = after.wall.width - widths[0] * step.count
      lines.push(extra === 0
        ? `${step.count} caissons de ${widths[0]} mm.`
        : `${step.count} caissons : ${widths.join(', ')} mm. Les ${extra} mm restants vont aux derniers caissons.`)
    }
    if (step.action === 'dressing.set_width') {
      const was = before.caissons[step.index]?.width
      const now = after.caissons[step.index]?.width
      if (step.width.kind === 'delta') lines.push(`Caisson ${step.index + 1} : ${step.width.deltaMm > 0 ? '+' : ''}${step.width.deltaMm} mm (${was} → ${now}).`)
      else lines.push(`Caisson ${step.index + 1} à ${now} mm.`)
      const neighbour = after.caissons.findIndex((caisson, index) => index !== step.index && caisson.width !== before.caissons[index]?.width)
      if (neighbour >= 0) lines.push(`Le caisson ${neighbour + 1} passe à ${after.caissons[neighbour].width} mm.`)
    }
    if (step.action === 'dressing.clear_drawers') lines.push(`Tiroirs retirés sur ${bayList(step.indices)}.`)
    if (step.action === 'dressing.set_drawers') lines.push(`${step.count} tiroir${step.count > 1 ? 's' : ''} sur ${bayList(step.indices)}.`)
    if (step.action === 'dressing.add_shelves') lines.push(`${step.count} étagères de plus sur le caisson ${step.index + 1}.`)
    if (step.action === 'dressing.set_door') lines.push(`Portes vitrées sur ${bayList(step.indices)}.`)
    if (step.action === 'dressing.set_rail') {
      const name = step.rail === 'double' ? 'Penderie double' : 'Penderie'
      lines.push(`${name} sur ${bayList(step.indices)}.`)
    }
  }
  return lines
}

function verifyDressing(project: Project, steps: Exec[]): Check[] {
  const widths = project.caissons.map((caisson) => caisson.width)
  const sum = widths.reduce((total, width) => total + width, 0)
  const checks: Check[] = [
    { ok: sum === project.wall.width, text: `Somme ${sum} mm pour un mur de ${project.wall.width} mm.` },
    { ok: widths.every((width) => width >= 300 && width <= 1200), text: 'Chaque caisson est entre 300 et 1200 mm.' },
  ]
  for (const step of steps) {
    if (step.action === 'dressing.set_drawers') {
      const ok = step.indices.every((index) => project.caissons[index]?.drawers === step.count)
      checks.push({ ok, text: `Tiroirs sur ${bayList(step.indices)}.` })
    }
    if (step.action === 'dressing.set_rail') {
      const ok = step.indices.every((index) => project.caissons[index]?.rail === step.rail)
      checks.push({ ok, text: `Penderie sur ${bayList(step.indices)}.` })
    }
    if (step.action === 'dressing.set_door') {
      const ok = step.indices.every((index) => project.caissons[index]?.door === 'vitree')
      checks.push({ ok, text: `Portes vitrées sur ${bayList(step.indices)}.` })
    }
  }
  return checks
}

function bayList(indices: number[]): string {
  const names = indices.map((index) => String(index + 1))
  if (names.length === 1) return `le caisson ${names[0]}`
  if (names.length === 2) return `les caissons ${names[0]} et ${names[1]}`
  return `les caissons ${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
}

function refused(stamp: ReturnType<typeof identity>, steps: Step[], error: string): Preview {
  return {
    ...stamp,
    status: 'invalid',
    understood: steps.map((step) => step.label),
    checks: [{ ok: false, text: error }],
    question: null,
    error,
    dressing: null,
    kitchen: null,
  }
}

function identity(clock?: Clock) {
  return {
    id: clock?.id ?? `phrase-${Date.now().toString(36)}`,
    source: 'phrase' as const,
    createdAt: clock?.now ?? new Date().toISOString(),
  }
}
