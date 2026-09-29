import { profileBound } from '../domain/profile'
import { useProject } from '../state/project-context'
import { MmField } from './MmField'
import { RULE_INDICATORS, ruleStory, type RuleField } from './rule-indicators'

export function RulesForm({
  active,
  onActive,
}: {
  active: RuleField
  onActive: (field: RuleField) => void
}) {
  const { project, selected, setRule } = useProject()
  const indicator = RULE_INDICATORS[active]
  const story = ruleStory(active, project, selected)

  return (
    <section className="panel" aria-labelledby="rules-title">
      <h2 id="rules-title">Règles de ce projet</h2>
      <p className="lead">Une épaisseur éclaire la pièce. Un seuil déplace un repère.</p>
      <p className="rule-live" role="status">
        <strong>{story}</strong>
        <span>{indicator.parts.join(' · ')}</span>
      </p>
      <div className="fields">
        {(Object.keys(RULE_INDICATORS) as RuleField[]).map((key) => {
          const field = RULE_INDICATORS[key]
          const bound = profileBound(key)
          const value = project.rules[key]
          const on = key === active
          return (
            <div key={key} className={on ? 'rule-card on' : 'rule-card'} onPointerDown={() => onActive(key)}>
              <MmField
                label={field.label}
                value={value}
                min={bound.min}
                max={bound.max}
                hint={on ? story : `${field.hint} ${bound.min}–${bound.max} mm.`}
                onActivate={() => onActive(key)}
                onCommit={(next) => setRule(key, next)}
              />
              {on && (
                <ul className="rule-parts">
                  {field.parts.map((part) => (
                    <li key={part}>{part}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
