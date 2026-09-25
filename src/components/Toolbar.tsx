import { useRef, type ChangeEvent } from 'react'
import { useProject } from '../state/project-context'

export function Toolbar() {
  const { notice, save, openText, reframe } = useProject()
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
        {notice ?? 'Prototype. Les cotes suivent les règles par défaut.'}
      </p>
      <div className="toolbar-actions">
        <button type="button" className="secondary" onClick={reframe}>
          Recadrer
        </button>
        <button type="button" className="secondary" onClick={() => input.current?.click()}>
          Ouvrir
        </button>
        <button type="button" className="primary" onClick={save}>
          Enregistrer
        </button>
        <input ref={input} hidden type="file" accept="application/json,.json" onChange={onFile} />
      </div>
    </header>
  )
}
