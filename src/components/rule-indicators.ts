import { doorCountForCaisson, doorLeaves } from '../domain/layout'
import type { RuleProfile } from '../domain/profile'
import type { Caisson, Project } from '../domain/types'
import type { SceneView } from './Scene'

export type RuleField = Exclude<keyof RuleProfile, 'id' | 'version'>

export type RuleIndicator = {
  label: string
  hint: string
  /** Cut-list roles that this measurement changes. */
  roles: string[]
  /** Short names shown next to the field. */
  parts: string[]
  moves: string
  view: SceneView
  doorsOpen: boolean
  revealDrawers: boolean
}

export const RULE_INDICATORS: Record<RuleField, RuleIndicator> = {
  carcassMm: {
    label: 'Épaisseur de caisse',
    hint: 'Joues, dessus, dessous, portes, socle.',
    roles: ['joue', 'dessus', 'dessous', 'porte', 'socle avant', 'retour socle'],
    parts: ['Joues', 'Dessus', 'Dessous', 'Portes', 'Socle'],
    moves: 'La caisse, les portes et le socle épaississent.',
    view: 'facade',
    doorsOpen: true,
    revealDrawers: false,
  },
  shelfMm: {
    label: 'Épaisseur d’étagère',
    hint: 'Étagères et dessus de tiroirs.',
    roles: ['étagère', 'dessus tiroirs'],
    parts: ['Étagères', 'Dessus tiroirs'],
    moves: 'Les étagères et le dessus des tiroirs épaississent.',
    view: 'interior',
    doorsOpen: true,
    revealDrawers: false,
  },
  backMm: {
    label: 'Épaisseur de fond',
    hint: 'Fond du caisson et fond de tiroir.',
    roles: ['fond rapporté', 'fond tiroir'],
    parts: ['Fond', 'Fond tiroir'],
    moves: 'Le fond du caisson et le fond du tiroir épaississent.',
    view: 'interior',
    doorsOpen: true,
    revealDrawers: true,
  },
  shelfSetbackMm: {
    label: 'Recul d’étagère',
    hint: 'L’étagère s’arrête avant la façade.',
    roles: ['étagère', 'dessus tiroirs'],
    parts: ['Étagères', 'Dessus tiroirs'],
    moves: 'Les étagères reculent depuis la façade.',
    view: 'interior',
    doorsOpen: true,
    revealDrawers: false,
  },
  drawerDepthInsetMm: {
    label: 'Retrait de tiroir',
    hint: 'Le caisson du tiroir est moins profond que le mur.',
    roles: ['façade tiroir', 'côté tiroir', 'devant tiroir', 'derrière tiroir', 'fond tiroir'],
    parts: ['Façade', 'Côtés', 'Devant', 'Derrière', 'Fond'],
    moves: 'Le caisson du tiroir devient moins profond.',
    view: 'interior',
    doorsOpen: true,
    revealDrawers: true,
  },
  drawerBoxShortMm: {
    label: 'Jeu de tiroir',
    hint: 'Le caisson du tiroir est plus court que sa façade.',
    roles: ['façade tiroir', 'côté tiroir', 'devant tiroir', 'derrière tiroir', 'fond tiroir'],
    parts: ['Façade', 'Côtés', 'Devant', 'Derrière', 'Fond'],
    moves: 'Le caisson du tiroir devient plus court que sa façade.',
    view: 'interior',
    doorsOpen: true,
    revealDrawers: true,
  },
  doorSplitMm: {
    label: 'Seuil deux portes',
    hint: 'En dessous, une porte battante. Au-dessus, deux.',
    roles: [],
    parts: ['Repère sur la largeur'],
    moves: 'Seuil : en dessous, une porte battante. À partir de ce chiffre, deux.',
    view: 'facade',
    doorsOpen: false,
    revealDrawers: false,
  },
  slidingOverlapMm: {
    label: 'Recouvrement coulissant',
    hint: 'Les deux vantaux d’un placard se croisent de cette valeur.',
    roles: [],
    parts: ['Bande de croisement'],
    moves: 'Largeur où deux vantaux coulissants se croisent. Une porte battante ne change pas.',
    view: 'facade',
    doorsOpen: false,
    revealDrawers: false,
  },
  hangingMinMm: {
    label: 'Vide mini sous tringle',
    hint: 'Plancher du vide. Le vide déjà posé ne descend pas en dessous.',
    roles: [],
    parts: ['Trait du minimum'],
    moves: 'Plancher du vide sous la tringle. Le vide déjà posé ne bouge que s’il passe en dessous.',
    view: 'interior',
    doorsOpen: true,
    revealDrawers: false,
  },
  hangingDefaultMm: {
    label: 'Vide par défaut',
    hint: 'Vide d’un caisson neuf. Les tringles déjà posées gardent leur vide.',
    roles: [],
    parts: ['Trait du défaut'],
    moves: 'Vide d’un caisson neuf. Les tringles déjà posées restent à leur vide.',
    view: 'interior',
    doorsOpen: true,
    revealDrawers: false,
  },
  hangingMaxMm: {
    label: 'Vide maxi sous tringle',
    hint: 'Plafond du vide. Le vide déjà posé ne monte pas au-dessus.',
    roles: [],
    parts: ['Trait du maximum'],
    moves: 'Plafond du vide sous la tringle. Le vide déjà posé ne bouge que s’il passe au-dessus.',
    view: 'interior',
    doorsOpen: true,
    revealDrawers: false,
  },
}

export function ruleStory(field: RuleField, project: Project, selected: Caisson): string {
  const rules = project.rules
  if (field === 'doorSplitMm') {
    if (selected.door !== 'battante' && selected.door !== 'vitree') {
      return `Ce caisson n’a pas de porte battante. Le seuil ${rules.doorSplitMm} mm ne change pas ses vantaux. Sous le seuil : 1 porte. À partir du seuil : 2.`
    }
    const count = doorCountForCaisson(selected.width, rules.doorSplitMm)
    return `Ce caisson fait ${selected.width} mm → ${count} porte${count > 1 ? 's' : ''}. Le repère vert suit ${rules.doorSplitMm} mm. Quand il dépasse la largeur du caisson, il ne reste qu’une porte.`
  }
  if (field === 'slidingOverlapMm') {
    if (selected.door === 'coulissante') {
      const leaves = doorLeaves(selected.width, 'coulissante', rules)
      return `La bande verte fait ${rules.slidingOverlapMm} mm. Les vantaux de ce caisson font ${leaves.join(' et ')} mm.`
    }
    return `La bande verte fait ${rules.slidingOverlapMm} mm : c’est le croisement de deux vantaux coulissants. Ce caisson n’est pas coulissant, donc sa porte ne change pas.`
  }
  if (field === 'hangingMinMm' || field === 'hangingDefaultMm' || field === 'hangingMaxMm') {
    const name = field === 'hangingMinMm' ? 'Le minimum' : field === 'hangingDefaultMm' ? 'Le défaut' : 'Le maximum'
    const host = project.caissons.find((caisson) => caisson.rail !== 'aucune')
    const value = rules[field]
    if (!host) {
      return `${name} est ${value} mm. Aucune tringle n’est posée : la colonne montre le vide qu’elle réserverait. Le trait épais suit ${name.toLowerCase()}.`
    }
    return `${name} est ${value} mm. Le vide déjà posé est ${host.hangingGap} mm. Le trait épais suit ${name.toLowerCase()}. La tringle ne bouge que si ce vide sort de ${rules.hangingMinMm}–${rules.hangingMaxMm} mm.`
  }
  return RULE_INDICATORS[field].moves
}
