import { MAX_CAISSON, MIN_CAISSON, finishById } from '../domain/rules'
import { useProject } from '../state/project-context'
import { MmField } from './MmField'

export function CaissonColumn() {
  const { project, selected, select, setWidth, add, remove } = useProject()
  const finish = finishById(project.finish)
  const ink = project.finish === 'anthracite' ? '#f4f1ea' : '#1c1a16'
  const index = project.caissons.findIndex((caisson) => caisson.id === selected.id)
  const neighbour = index === project.caissons.length - 1 ? 'gauche' : 'droite'
  const widthHint =
    project.caissons.length === 1
      ? '300–1200 mm. Ce caisson fait toute la largeur du mur.'
      : `300–1200 mm. L'écart est pris sur le caisson de ${neighbour}.`

  return (
    <section className="panel" aria-labelledby="bays-title">
      <h2 id="bays-title">Les caissons</h2>
      <p className="lead">Ajoutez, retirez, changez une largeur. La somme reste celle du mur.</p>
      <div className="bays" role="listbox" aria-label="Caissons du mur">
        {project.caissons.map((caisson, bayIndex) => (
          <button
            key={caisson.id}
            type="button"
            className="bay"
            role="option"
            aria-selected={caisson.id === selected.id}
            aria-pressed={caisson.id === selected.id}
            style={{ flex: `${caisson.width} 1 0`, background: finish.color, color: ink }}
            onClick={() => select(caisson.id)}
          >
            <strong>{bayIndex + 1}</strong>
            <small>{caisson.width}</small>
          </button>
        ))}
      </div>
      <div className="fields" style={{ marginTop: 12 }}>
        <MmField
          label={`Largeur du caisson ${index + 1}`}
          value={selected.width}
          min={MIN_CAISSON}
          max={MAX_CAISSON}
          hint={widthHint}
          onCommit={setWidth}
        />
      </div>
      <div className="row-actions" style={{ marginTop: 12 }}>
        <button type="button" className="secondary" onClick={add}>
          Ajouter
        </button>
        <button type="button" className="secondary" onClick={remove} disabled={project.caissons.length === 1}>
          Retirer
        </button>
      </div>
    </section>
  )
}
