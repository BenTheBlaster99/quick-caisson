import { doorCountForCaisson, layoutCaisson, slidingLeafCount, usableHeight } from '../domain/layout'
import { FINISHES, splitEven } from '../domain/rules'
import type { FinishId, FrontMode, RailMode } from '../domain/types'
import { useProject } from '../state/project-context'

const RAILS: { id: RailMode; label: string }[] = [
  { id: 'aucune', label: 'Aucune' },
  { id: 'haute', label: 'Haute' },
  { id: 'basse', label: 'Basse' },
  { id: 'double', label: 'Double' },
]

const FRONTS: { id: FrontMode; label: string }[] = [
  { id: 'aucune', label: 'Aucune' },
  { id: 'battantes', label: 'Battantes' },
  { id: 'coulissantes', label: 'Coulissantes' },
]

export function ElementForm() {
  const { project, selected, select, patchSelected } = useProject()
  const index = project.caissons.findIndex((caisson) => caisson.id === selected.id)
  const layout = layoutCaisson(project.wall, selected)

  return (
    <section className="panel" aria-labelledby="element-title">
      <h2 id="element-title">L'intérieur</h2>
      <p className="lead">Un caisson à la fois.</p>
      <div className="picker" role="tablist" aria-label="Choisir un caisson">
        {project.caissons.map((caisson, bayIndex) => (
          <button
            key={caisson.id}
            type="button"
            aria-pressed={caisson.id === selected.id}
            onClick={() => select(caisson.id)}
          >
            <strong>{bayIndex + 1}</strong>
            <small>{caisson.width}</small>
          </button>
        ))}
      </div>
      <p className="summary" style={{ marginBottom: 14 }}>
        Caisson {index + 1} · intérieur {layout.interiorWidth} × {layout.interiorHeight} mm
      </p>

      <div className="block">
        <h3>Étagères</h3>
        <Stepper value={selected.shelves} min={0} max={8} onChange={(shelves) => patchSelected({ shelves })} />
      </div>

      <div className="block">
        <h3>Tringle</h3>
        <div className="segment" role="group" aria-label="Tringle">
          {RAILS.map((rail) => (
            <button
              key={rail.id}
              type="button"
              aria-pressed={selected.rail === rail.id}
              onClick={() => patchSelected({ rail: rail.id })}
            >
              {rail.label}
            </button>
          ))}
        </div>
      </div>

      <div className="block">
        <h3>Tiroirs</h3>
        <Stepper value={selected.drawers} min={0} max={6} onChange={(drawers) => patchSelected({ drawers })} />
      </div>

      <div className="block">
        <h3>Pantalonnière</h3>
        <div className="segment" role="group" aria-label="Pantalonnière">
          <button type="button" aria-pressed={!selected.pantalonniere} onClick={() => patchSelected({ pantalonniere: false })}>
            Non
          </button>
          <button type="button" aria-pressed={selected.pantalonniere} onClick={() => patchSelected({ pantalonniere: true })}>
            Oui
          </button>
        </div>
      </div>

      {layout.warnings.length > 0 && (
        <ul className="warnings">
          {layout.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

    </section>
  )
}

export function FacadeForm() {
  const { project, setFront, setFinish } = useProject()

  return (
    <section className="panel" aria-labelledby="facade-title">
      <h2 id="facade-title">La façade</h2>
      <p className="lead">Une façade pour tout le mur, puis la finition.</p>
      <div className="block">
        <h3>Façade</h3>
        <div className="segment" role="group" aria-label="Façade">
          {FRONTS.map((front) => (
            <button key={front.id} type="button" aria-pressed={project.front === front.id} onClick={() => setFront(front.id)}>
              {front.label}
            </button>
          ))}
        </div>
        <DoorLines project={project} />
      </div>
      <div className="block">
        <h3>Finition</h3>
        <div className="swatches" role="group" aria-label="Finition">
          {FINISHES.map((finish) => (
            <button
              key={finish.id}
              type="button"
              className="swatch"
              aria-pressed={project.finish === finish.id}
              onClick={() => setFinish(finish.id as FinishId)}
            >
              <i style={{ background: finish.color }} />
              {finish.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function DoorLines({ project }: { project: ReturnType<typeof useProject>['project'] }) {
  const height = usableHeight(project.wall)
  if (project.front === 'aucune') return <p className="summary">Aucune façade.</p>
  if (project.front === 'coulissantes') {
    const count = slidingLeafCount(project.wall.width)
    const widths = splitEven(project.wall.width, count)
    return <p className="summary">{count} vantaux de {widths.join(' / ')} × {height} mm, sur tout le mur.</p>
  }
  return (
    <ul className="door-lines">
      {project.caissons.map((caisson, index) => {
        const count = doorCountForCaisson(caisson.width)
        const widths = splitEven(caisson.width, count)
        return (
          <li key={caisson.id}>
            Caisson {index + 1} · {count} porte{count > 1 ? 's' : ''} de {widths.join(' / ')} × {height} mm
          </li>
        )
      })}
    </ul>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Diminuer">
        −
      </button>
      <strong>{value}</strong>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Augmenter">
        +
      </button>
    </div>
  )
}
