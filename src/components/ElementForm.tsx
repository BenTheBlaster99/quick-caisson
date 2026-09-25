import { doorLabel, layoutCaisson } from '../domain/layout'
import { DOOR_FINISHES, FINISHES, HANGING_MAX, HANGING_MIN } from '../domain/rules'
import type { DoorFinishId, DoorMode, DrawerThickness, FinishId, RailMode } from '../domain/types'
import { useProject } from '../state/project-context'
import { MmField } from './MmField'

const RAILS: { id: RailMode; label: string }[] = [
  { id: 'aucune', label: 'Aucune' },
  { id: 'haute', label: 'Haute' },
  { id: 'basse', label: 'Basse' },
  { id: 'double', label: 'Double' },
]

const DOORS: { id: DoorMode; label: string }[] = [
  { id: 'aucune', label: 'Aucune' },
  { id: 'battante', label: 'Battante' },
  { id: 'vitree', label: 'Vitrée' },
]

const THICKNESS: DrawerThickness[] = [16, 18]

export function ElementForm() {
  const { project, selected, select, setShelves, setShelfGap, setRail, setHangingGap, setDrawers, setDrawerThickness, setDoor, setDoorFinish } = useProject()
  const index = project.caissons.findIndex((caisson) => caisson.id === selected.id)
  const layout = layoutCaisson(project.wall, selected)

  return (
    <section className="panel" aria-labelledby="element-title">
      <h2 id="element-title">L'intérieur</h2>
      <p className="lead">Un caisson à la fois. Les portes sont les siennes.</p>
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
        <Stepper value={selected.shelves} min={0} max={8} onChange={setShelves} />
        {selected.shelfGaps.map((gap, gapIndex) => (
          <MmField
            key={`${selected.id}-gap-${gapIndex}`}
            label={`Écart ${gapIndex + 1}`}
            value={gap}
            hint={gapIndex === 0 ? 'Depuis le bas de la zone libre, en mm.' : "Depuis l'étagère du dessous, en mm."}
            onCommit={(value) => setShelfGap(gapIndex, value)}
          />
        ))}
      </div>

      <div className="block">
        <h3>Tringle</h3>
        <div className="segment" role="group" aria-label="Tringle">
          {RAILS.map((rail) => (
            <button key={rail.id} type="button" aria-pressed={selected.rail === rail.id} onClick={() => setRail(rail.id)}>
              {rail.label}
            </button>
          ))}
        </div>
        {selected.rail !== 'aucune' && (
          <MmField
            label="Vide sous la tringle"
            value={selected.hangingGap}
            hint={`Limite : ${HANGING_MIN}–${HANGING_MAX} mm. Les étagères restent en dehors de ce vide.`}
            onCommit={setHangingGap}
          />
        )}
      </div>

      <div className="block">
        <h3>Tiroirs</h3>
        <Stepper value={selected.drawers} min={0} max={6} onChange={setDrawers} />
        {selected.drawers > 0 && (
          <>
            <p className="summary">Une tablette ferme le dessus de la pile. Elle n'est pas comptée dans les étagères.</p>
            <div className="segment" role="group" aria-label="Épaisseur des tiroirs">
              {THICKNESS.map((thickness) => (
                <button
                  key={thickness}
                  type="button"
                  aria-pressed={selected.drawerThickness === thickness}
                  onClick={() => setDrawerThickness(thickness)}
                >
                  {thickness} mm
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="block">
        <h3>Porte</h3>
        <div className="segment" role="group" aria-label="Porte">
          {DOORS.map((door) => (
            <button key={door.id} type="button" aria-pressed={selected.door === door.id} onClick={() => setDoor(door.id)}>
              {door.label}
            </button>
          ))}
        </div>
        <p className="summary">{doorLabel(selected.door, selected.width)}</p>
        {selected.door !== 'aucune' && (
          <div className="swatches" role="group" aria-label="Finition des portes">
            {DOOR_FINISHES.map((finish) => (
              <button
                key={finish.id}
                type="button"
                className="swatch"
                aria-pressed={selected.doorFinish === finish.id}
                onClick={() => setDoorFinish(finish.id as DoorFinishId)}
              >
                <i style={{ background: finish.color }} />
                {finish.name === 'verre' ? 'Verre' : finish.name}
              </button>
            ))}
          </div>
        )}
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
  const { project, setFinish } = useProject()

  return (
    <section className="panel" aria-labelledby="facade-title">
      <h2 id="facade-title">La façade</h2>
      <p className="lead">La couleur de la caisse. Chaque porte se choisit dans l'intérieur.</p>
      <div className="block">
        <h3>Caisse</h3>
        <div className="swatches" role="group" aria-label="Finition de la caisse">
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
      <ul className="door-lines">
        {project.caissons.map((caisson, index) => (
          <li key={caisson.id}>
            Caisson {index + 1} · {doorLabel(caisson.door, caisson.width)}
          </li>
        ))}
      </ul>
    </section>
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
