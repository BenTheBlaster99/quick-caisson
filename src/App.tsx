import { Component, useState, type ReactNode } from 'react'
import { CaissonColumn } from './components/CaissonColumn'
import { CutListTable } from './components/CutListTable'
import { ElementForm, FacadeForm } from './components/ElementForm'
import { Elevation } from './components/Elevation'
import { Scene, type PartPick, type SceneView } from './components/Scene'
import { Toolbar } from './components/Toolbar'
import { WallForm } from './components/WallForm'
import { cutRowKey } from './domain/cutlist'
import type { CutRow } from './domain/types'
import { useProject } from './state/project-context'

const STEPS = [
  { id: 'mur', label: 'Le mur' },
  { id: 'caissons', label: 'Les caissons' },
  { id: 'interieur', label: "L'intérieur" },
  { id: 'facade', label: 'La façade' },
  { id: 'liste', label: 'La liste' },
] as const

const NEXT = ['Les caissons', "L'intérieur", 'La façade', 'La liste']

function stepFromHash(): number {
  const id = window.location.hash.replace('#', '')
  const index = STEPS.findIndex((step) => step.id === id)
  return index === -1 ? 0 : index
}

export function App() {
  const { project, selected, doorsOpen, frameToken, select, toggleDoors, reframe } = useProject()
  const [step, setStep] = useState(stepFromHash)
  const [partKey, setPartKey] = useState<string | null>(null)
  const [part, setPart] = useState<PartPick | null>(null)
  const [listBoard, setListBoard] = useState<'closet' | 'elevation'>('closet')
  const current = STEPS[step]

  function chooseRow(row: CutRow) {
    const key = cutRowKey(row)
    if (key === partKey) {
      setPartKey(null)
      setPart(null)
      return
    }
    setPartKey(key)
    setPart({ caissonIndex: row.caissonIndex, role: row.role, length: row.length, width: row.width })
    setListBoard('closet')
    if (row.caissonIndex < project.caissons.length) select(project.caissons[row.caissonIndex].id)
  }

  function go(index: number) {
    const next = Math.min(STEPS.length - 1, Math.max(0, index))
    setStep(next)
    const hash = `#${STEPS[next].id}`
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
    reframe()
  }

  const sceneView: SceneView =
    current.id === 'mur' ? 'envelope' : current.id === 'caissons' ? 'boxes' : current.id === 'interieur' ? 'interior' : 'facade'

  return (
    <div className="app">
      <Toolbar />
      <nav className="steps" aria-label="Étapes">
        {STEPS.map((item, index) => (
          <button key={item.id} type="button" aria-current={index === step ? 'step' : undefined} onClick={() => go(index)}>
            {item.label}
          </button>
        ))}
      </nav>
      {current.id === 'liste' ? (
        <main className="stage liste">
          {listBoard === 'elevation' ? (
            <section className="panel list-draw" aria-label="Élévation">
              <div className="viewport-bar">
                <span className="hint">Élévation cotée. Le dressing montre la ligne choisie.</span>
                <button type="button" className="secondary" onClick={() => setListBoard('closet')}>
                  Dressing
                </button>
              </div>
              <Elevation project={project} selectedId={selected.id} onSelect={select} />
            </section>
          ) : (
            <section className="stage-main" aria-label="Vue 3D">
              <div className="viewport-bar">
                <span className="hint">
                  {part
                    ? part.caissonIndex < project.caissons.length
                      ? `Caisson ${part.caissonIndex + 1} · ${part.role}`
                      : part.role
                    : 'Cliquez une ligne de la liste.'}
                </span>
                <button type="button" className="secondary" onClick={() => setListBoard('elevation')}>
                  Élévation
                </button>
              </div>
              <div className="viewport-3d">
                <ViewBoundary>
                  <Scene
                    project={project}
                    selectedId={selected.id}
                    doorsOpen={part != null && part.role !== 'porte' && part.role !== 'vantail' ? true : doorsOpen}
                    frameToken={frameToken}
                    view="facade"
                    onSelect={select}
                    highlight={part}
                  />
                </ViewBoundary>
              </div>
            </section>
          )}
          <CutListTable selectedKey={partKey} onSelect={chooseRow} />
        </main>
      ) : (
        <main className="stage">
          <div className="stage-side">
            {current.id === 'mur' && <WallForm />}
            {current.id === 'caissons' && <CaissonColumn />}
            {current.id === 'interieur' && <ElementForm />}
            {current.id === 'facade' && <FacadeForm />}
          </div>
          <section className="stage-main" aria-label="Vue 3D">
            <div className="viewport-bar">
              <span className="hint">
                {current.id === 'mur' ? 'Le volume du mur' : 'Glisser pour tourner. Cliquer un caisson pour le choisir.'}
              </span>
              {current.id === 'facade' && project.front !== 'aucune' && (
                <button type="button" className="secondary" onClick={toggleDoors}>
                  {doorsOpen ? 'Fermer les façades' : 'Ouvrir les façades'}
                </button>
              )}
            </div>
            <div className="viewport-3d">
              <ViewBoundary>
                <Scene
                  project={project}
                  selectedId={selected.id}
                  doorsOpen={doorsOpen}
                  frameToken={frameToken}
                  view={sceneView}
                  onSelect={select}
                />
              </ViewBoundary>
            </div>
          </section>
        </main>
      )}
      <footer className="step-footer">
        <button type="button" className="secondary" onClick={() => go(step - 1)} disabled={step === 0}>
          Retour
        </button>
        <button type="button" className="primary" onClick={() => go(step + 1)} disabled={step === STEPS.length - 1}>
          {step < NEXT.length ? `Continuer · ${NEXT[step]}` : 'Continuer'}
        </button>
      </footer>
    </div>
  )
}

class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <p className="summary">La vue 3D n’a pas pu démarrer. Le navigateur doit autoriser WebGL.</p>
    }
    return this.props.children
  }
}
