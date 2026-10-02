import { useState, type FormEvent } from 'react'
import type { Preview } from '../copilot/plan'
import { previewPhrase } from '../copilot/preview'
import { createId } from '../domain/project'
import { useKitchen } from '../state/kitchen-context'
import { useProject } from '../state/project-context'

export function CopilotBar({ mode }: { mode: 'dressing' | 'cuisine' }) {
  const dressing = useProject()
  const kitchen = useKitchen()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const ready = preview?.status === 'valid'

  function read(event: FormEvent) {
    event.preventDefault()
    const project = mode === 'dressing' ? dressing.project : kitchen.project
    setPreview(previewPhrase(text, mode, project, createId))
  }

  function apply() {
    if (preview?.status !== 'valid') return
    if (mode === 'dressing' && preview.dressing) dressing.replace(preview.dressing)
    if (mode === 'cuisine' && preview.kitchen) kitchen.replace(preview.kitchen)
    setText('')
    setPreview(null)
  }

  return (
    <form className="copilot" onSubmit={read}>
      <label htmlFor="copilot-phrase">Commande</label>
      <input
        id="copilot-phrase"
        value={text}
        placeholder={mode === 'dressing' ? 'Dressing 3m50, six caissons, tiroirs à gauche' : 'Cuisine de 3m80, évier 800'}
        onChange={(event) => {
          setText(event.target.value)
          setPreview(null)
        }}
      />
      <button type="submit" className="secondary">Lire</button>
      {ready && <button type="button" className="primary" onClick={apply}>Appliquer</button>}
      {preview && <PreviewBlock preview={preview} />}
    </form>
  )
}

function PreviewBlock({ preview }: { preview: Preview }) {
  const split = preview.understood.length > 0 && preview.checks.length > 0
  return (
    <div className={split ? 'copilot-preview split' : 'copilot-preview'} role="status">
      {preview.understood.length > 0 && (
        <div>
          <h3>Compris</h3>
          {preview.understood.map((line) => <p key={line}>{line}</p>)}
        </div>
      )}
      {preview.checks.length > 0 && (
        <div>
          <h3>Vérification</h3>
          {preview.checks.map((check) => <p key={check.text}>{check.ok ? '✓' : '✕'} {check.text}</p>)}
        </div>
      )}
      {preview.question && <p className="copilot-question">{preview.question}</p>}
      {preview.error && preview.status === 'unknown' && <p className="copilot-error">{preview.error}</p>}
    </div>
  )
}
