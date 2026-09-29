import { useRef, type ChangeEvent } from 'react'
import { printSheet } from './PrintSheet'
import { useProject } from '../state/project-context'

export function Toolbar() {
  const { project, notice, save, openText, reframe, undo, redo, canUndo, canRedo } = useProject()
  const input = useRef<HTMLInputElement>(null)

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => openText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  return (
    <header className="toolbar">
      <div className="brand">
        <strong>Caisson</strong>
        <span>Dressing · un mur</span>
      </div>
      <p className={notice ? 'status error' : 'status'} role="status">
        {notice ?? 'Les cotes suivent les règles enregistrées dans ce projet.'}
      </p>
      <div className="toolbar-actions">
        <button type="button" className="secondary" onClick={undo} disabled={!canUndo}>
          Annuler
        </button>
        <button type="button" className="secondary" onClick={redo} disabled={!canRedo}>
          Rétablir
        </button>
        <button type="button" className="secondary" onClick={reframe}>
          Recentrer la vue
        </button>
        <button type="button" className="secondary" onClick={() => { window.location.hash = '#cuisine' }}>
          Cuisine
        </button>
        <button type="button" className="secondary" onClick={() => input.current?.click()}>
          Ouvrir un projet
        </button>
        <button type="button" className="secondary" onClick={() => printSheet(project)}>
          Enregistrer en PDF
        </button>
        <button type="button" className="primary" onClick={save}>
          Enregistrer le projet
        </button>
        <input ref={input} hidden type="file" accept="application/json,.json" onChange={onFile} />
      </div>
    </header>
  )
}
