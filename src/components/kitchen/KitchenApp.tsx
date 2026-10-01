import { Component, Fragment, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { formatCutCell } from '../../domain/cutlist'
import { buildKitchenCutList } from '../../kitchen/cutlist'
import { KITCHEN_FINISHES, kitchenFinish, WALL_FINISHES, wallFinish } from '../../kitchen/finishes'
import { canCorrectIssue, COLUMN_MAX, COLUMN_MIN, shortBase, upperLabel } from '../../kitchen/layout'
import { kitchenWallLimits } from '../../kitchen/project'
import { WALLS, wallName } from '../../kitchen/room'
import type { BaseRole, HandleId, KitchenIssue, KitchenShape, OpeningKind, UpperRole, WallFinishId, WallId } from '../../kitchen/types'
import { useKitchen } from '../../state/kitchen-context'
import { MmField } from '../MmField'
import { KitchenPlan } from './KitchenPlan'
import { KitchenScene, type KitchenCamera } from './KitchenScene'

const STEPS = [
  { id: 'cuisine', label: 'La pièce' },
  { id: 'cuisine/ouvertures', label: 'Ouvertures' },
  { id: 'cuisine/implantation', label: 'Implantation' },
  { id: 'cuisine/plan', label: 'Plan' },
  { id: 'cuisine/elevation', label: 'Élévation' },
  { id: 'cuisine/liste', label: 'La liste' },
] as const

const BASES: { id: BaseRole; label: string }[] = [
  { id: 'porte', label: 'Porte' },
  { id: 'tiroirs', label: 'Tiroirs' },
  { id: 'evier', label: 'Évier' },
  { id: 'plaque', label: 'Plaque' },
  { id: 'four', label: 'Four' },
  { id: 'four-plaque', label: 'Four + plaque' },
  { id: 'lave-vaisselle', label: 'Lave-vaisselle' },
  { id: 'bouteilles', label: 'Bouteilles' },
]

const UPPERS: { id: UpperRole; label: string }[] = [
  { id: 'aucun', label: 'Aucun' },
  { id: 'haut', label: 'Haut' },
  { id: 'hotte', label: 'Hotte' },
  { id: 'vitrine', label: 'Vitrine' },
  { id: 'micro-ondes', label: 'Micro-ondes' },
]

const HANDLES: { id: HandleId; label: string }[] = [
  { id: 'aucune', label: 'Aucune' },
  { id: 'integre', label: 'Intégré' },
  { id: 'bouton', label: 'Bouton' },
  { id: 'barre', label: 'Barre' },
]

const SHAPES: { id: KitchenShape; label: string }[] = [
  { id: 'lineaire', label: 'Linéaire' },
  { id: 'l', label: 'L' },
  { id: 'u', label: 'U' },
]

const CAMERAS: { id: KitchenCamera; label: string }[] = [
  { id: 'perspective', label: '3/4' },
  { id: 'fond', label: 'Fond' },
  { id: 'gauche', label: 'Gauche' },
  { id: 'droit', label: 'Droit' },
  { id: 'top', label: 'Dessus' },
]

function stepFromHash(): number {
  const id = window.location.hash.replace('#', '')
  const key = id === 'cuisine/meubles' ? 'cuisine/implantation' : id
  const index = STEPS.findIndex((step) => step.id === key)
  return index === -1 ? 0 : index
}

export function KitchenApp() {
  const kitchen = useKitchen()
  const [step, setStep] = useState(stepFromHash)
  const [frameToken, setFrameToken] = useState(0)
  const [cameraMode, setCameraMode] = useState<KitchenCamera>('perspective')
  const [band, setBand] = useState<'haut' | 'bas'>('bas')
  const [activeWall, setActiveWall] = useState<WallId>('A')
  const input = useRef<HTMLInputElement>(null)
  const current = STEPS[step]
  const shapeName = SHAPES.find((item) => item.id === kitchen.project.room.shape)?.label ?? 'Linéaire'

  function choose(id: string) {
    kitchen.select(id)
    const column = kitchen.project.columns.find((item) => item.id === id)
    if (column) setActiveWall(column.wallId)
    setBand('bas')
  }

  function go(index: number) {
    const next = Math.min(STEPS.length - 1, Math.max(0, index))
    setStep(next)
    const hash = `#${STEPS[next].id}`
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
    setFrameToken((token) => token + 1)
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => kitchen.openText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  function see(columnId: string | null, part?: 'haut' | 'bas') {
    if (columnId) kitchen.select(columnId)
    if (part) setBand(part)
    if (current.id !== 'cuisine/implantation') go(2)
  }

  const drawing = current.id === 'cuisine/plan' || current.id === 'cuisine/elevation'

  return (
    <div className="app kitchen-app">
      <header className="toolbar">
        <div className="brand">
          <strong>Caisson</strong>
          <input
            className="job-name"
            aria-label="Nom du projet"
            defaultValue={kitchen.project.name}
            key={kitchen.project.name}
            onBlur={(event) => kitchen.setName(event.target.value)}
          />
        </div>
        <p className={kitchen.notice ? 'status error' : 'status'} role="status">
          {kitchen.notice ?? `${kitchen.project.wall.width} × ${kitchen.project.room.depth} mm · ${shapeName} · ${kitchen.project.columns.length} meubles`}
        </p>
        <div className="toolbar-actions">
          <button type="button" className="secondary" onClick={kitchen.undo} disabled={!kitchen.canUndo}>Annuler</button>
          <button type="button" className="secondary" onClick={kitchen.redo} disabled={!kitchen.canRedo}>Rétablir</button>
          <button type="button" className="secondary" onClick={() => setFrameToken((token) => token + 1)}>Recentrer</button>
          <button type="button" className="secondary" onClick={() => { window.location.hash = '#mur' }}>Dressing</button>
          <button type="button" className="secondary" onClick={() => input.current?.click()}>Ouvrir</button>
          <button type="button" className="primary" onClick={kitchen.save}>Enregistrer</button>
          <input ref={input} hidden type="file" accept="application/json,.json" onChange={onFile} />
        </div>
      </header>
      <nav className="steps" aria-label="Étapes cuisine">
        {STEPS.map((item, index) => (
          <button key={item.id} type="button" aria-current={index === step ? 'step' : undefined} onClick={() => go(index)}>
            {item.label}
          </button>
        ))}
      </nav>
      <CheckStrip width={kitchen.project.wall.width} depth={kitchen.project.room.depth} issues={kitchen.issues} onSee={see} />
      {drawing ? (
        <main className="stage kitchen-draw">
          <KitchenPlan
            project={kitchen.project}
            selectedId={kitchen.selected.id}
            onSelect={choose}
            focus={current.id === 'cuisine/elevation' ? 'elevation' : 'plan'}
          />
        </main>
      ) : current.id === 'cuisine/liste' ? (
        <main className="stage liste">
          <section className="stage-main" aria-label="Vue 3D">
            <ViewportBar cameraMode={cameraMode} onCamera={setCameraMode} hint="La liste, le plan et l'élévation lisent le même fichier." />
            <div className="viewport-3d">
              <ViewBoundary>
                <KitchenScene project={kitchen.project} selectedId={kitchen.selected.id} frameToken={frameToken} cameraMode={cameraMode} onSelect={choose} onMoveColumn={kitchen.placeColumn} onMoveOpening={kitchen.placeOpening} onMoveIsland={kitchen.placeIsland} />
              </ViewBoundary>
            </div>
          </section>
          <KitchenCutList />
        </main>
      ) : (
        <main className="stage">
          <div className="stage-side">
            {current.id === 'cuisine' && <WallFields />}
            {current.id === 'cuisine/ouvertures' && <OpeningFields />}
            {current.id === 'cuisine/implantation' && <ColumnFields band={band} onBand={setBand} wallId={activeWall} onWall={setActiveWall} />}
          </div>
          <section className="stage-main" aria-label="Vue 3D">
            <ViewportBar
              cameraMode={cameraMode}
              onCamera={setCameraMode}
              hint={current.id === 'cuisine' ? 'Largeur et profondeur de toute la pièce. Glissez un meuble, une porte, une fenêtre, ou le plan de l’îlot.' : current.id === 'cuisine/ouvertures' ? 'Glissez la fenêtre pour sa hauteur. La porte reste au sol.' : 'Choisissez le mur, puis glissez le meuble le long de ce mur.'}
            />
            <div className="viewport-3d">
              <ViewBoundary>
                <KitchenScene project={kitchen.project} selectedId={kitchen.selected.id} frameToken={frameToken} cameraMode={cameraMode} onSelect={choose} onMoveColumn={kitchen.placeColumn} onMoveOpening={kitchen.placeOpening} onMoveIsland={kitchen.placeIsland} />
              </ViewBoundary>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}

function ViewportBar({ cameraMode, onCamera, hint }: { cameraMode: KitchenCamera; onCamera: (mode: KitchenCamera) => void; hint: string }) {
  return (
    <div className="viewport-bar">
      <span className="hint">{hint}</span>
      <div className="segment" role="group" aria-label="Cadrage">
        {CAMERAS.map((item) => (
          <button key={item.id} type="button" aria-pressed={cameraMode === item.id} onClick={() => onCamera(item.id)}>{item.label}</button>
        ))}
      </div>
    </div>
  )
}

function CheckStrip({ width, depth, issues, onSee }: { width: number; depth: number; issues: KitchenIssue[]; onSee: (id: string | null, part?: 'haut' | 'bas') => void }) {
  const refus = issues.filter((issue) => issue.level === 'refus').length
  const attention = issues.length - refus
  const first = issues[0]
  const label = [refus > 0 ? `${refus} refus` : '', attention > 0 ? `${attention} attention` : ''].filter(Boolean).join(' · ')
  return (
    <div className="kitchen-check" role="status">
      <span className="ok">{width} × {depth} mm</span>
      {issues.length === 0 ? (
        <span className="ok">Rien à signaler</span>
      ) : (
        <button type="button" className={refus > 0 ? 'bad' : 'warn'} onClick={() => onSee(first?.columnId ?? null, first?.part === 'haut' ? 'haut' : 'bas')}>
          {label}
        </button>
      )}
    </div>
  )
}

function WallFields() {
  const { project, setWall, setDepth, setShape, setIsland, setFinish, setWallFinish } = useKitchen()
  const limits = kitchenWallLimits()
  const fields = Object.keys(limits) as (keyof typeof limits)[]
  const [paintWall, setPaintWall] = useState<'A' | 'B' | 'C' | 'D'>('A')
  const walls = WALLS.filter((id): id is 'A' | 'B' | 'C' | 'D' => id !== 'ilot')
  return (
    <section className="panel">
      <h2>La pièce</h2>
      <div className="segment" role="group" aria-label="Forme">
        {SHAPES.map((item) => (
          <button key={item.id} type="button" aria-pressed={project.room.shape === item.id} onClick={() => setShape(item.id)}>{item.label}</button>
        ))}
      </div>
      <p className="summary">Linéaire : le mur du fond. L : fond et gauche. U : fond, gauche et droit. Le mur avant n’apparaît que s’il porte une porte ou une fenêtre.</p>
      <div className="row-actions">
        <button type="button" className="secondary" aria-pressed={project.room.island} onClick={() => setIsland(!project.room.island)}>{project.room.island ? 'Îlot posé' : 'Ajouter un îlot'}</button>
      </div>
      <div className="fields">
        {fields.map((field) => (
          <MmField
            key={field}
            label={field === 'width' ? 'Largeur (murs A et D)' : limits[field].label}
            value={project.wall[field]}
            min={limits[field].min}
            max={limits[field].max}
            hint={`${limits[field].min}–${limits[field].max} mm`}
            onCommit={(value) => setWall(field, value)}
          />
        ))}
        <MmField label="Profondeur (murs B et C)" value={project.room.depth} min={1800} max={6000} hint="1800–6000 mm" onCommit={setDepth} />
      </div>
      <p className="summary">Murs</p>
      <div className="segment" role="group" aria-label="Mur à peindre">
        {walls.map((id) => (
          <button key={id} type="button" aria-pressed={paintWall === id} onClick={() => setPaintWall(id)}>
            <i className="dot" style={{ background: wallFinish(project.room.finishes[id]).color }} />
            {id === 'A' ? 'Fond' : id === 'B' ? 'Gauche' : id === 'C' ? 'Droit' : 'Avant'}
          </button>
        ))}
      </div>
      <div className="swatches" role="group" aria-label={`Matière de ${wallName(paintWall)}`}>
        {WALL_FINISHES.map((finish) => (
          <button key={finish.id} type="button" className="swatch" aria-pressed={project.room.finishes[paintWall] === finish.id} onClick={() => setWallFinish(paintWall, finish.id as WallFinishId)}>
            <i style={{ background: finish.color }} />
            {finish.name}
          </button>
        ))}
      </div>
      <p className="summary">Meubles</p>
      <div className="swatches" role="group" aria-label="Finition">
        {KITCHEN_FINISHES.map((finish) => (
          <button key={finish.id} type="button" className="swatch" aria-pressed={project.finish === finish.id} onClick={() => setFinish(finish.id)}>
            <i style={{ background: finish.color }} />
            {finish.name}
          </button>
        ))}
      </div>
      <p className="summary">Plan {project.wall.worktopThickness} mm, débord {project.rules.worktopOverhangMm} mm. Crédence {project.wall.backsplashHeight} mm. Meubles {kitchenFinish(project.finish).name}. {wallName(paintWall)} {wallFinish(project.room.finishes[paintWall]).name}.</p>
    </section>
  )
}

function OpeningFields() {
  const { project, addZone, setZone, removeZone } = useKitchen()
  const [wallId, setWallId] = useState<WallId>('A')
  const walls = WALLS.filter((id) => id !== 'ilot')
  return (
    <section className="panel">
      <h2>Ouvertures</h2>
      <p className="lead">Une fenêtre peut passer au-dessus des bas. Une porte ou une zone interdite ne peut pas. Glissez-les dans la vue.</p>
      <div className="segment" role="group" aria-label="Mur">
        {walls.map((id) => (
          <button key={id} type="button" aria-pressed={wallId === id} onClick={() => setWallId(id)}>{wallName(id)}</button>
        ))}
      </div>
      <div className="row-actions">
        <button type="button" className="secondary" onClick={() => addZone('fenetre', wallId)}>Fenêtre</button>
        <button type="button" className="secondary" onClick={() => addZone('porte', wallId)}>Porte</button>
        <button type="button" className="secondary" onClick={() => addZone('interdit', wallId)}>Zone interdite</button>
      </div>
      {project.openings.length === 0 && <p className="summary">Aucune ouverture. Le mur est libre sur toute sa largeur.</p>}
      {project.openings.map((opening) => (
        <article key={opening.id} className="rule-card">
          <header>
            <strong>{labelKind(opening.kind)} · {wallName(opening.wallId)}</strong>
            <button type="button" className="secondary" onClick={() => removeZone(opening.id)}>Retirer</button>
          </header>
          <MmField label="Position" value={opening.x} hint="Depuis la gauche" onCommit={(value) => setZone(opening.id, { x: value })} />
          <MmField label="Largeur" value={opening.width} hint="100 mm minimum" onCommit={(value) => setZone(opening.id, { width: value })} />
          <MmField label="Bas" value={opening.bottom} hint="Depuis le sol" onCommit={(value) => setZone(opening.id, { bottom: value })} />
          <MmField label="Hauteur" value={opening.height} hint="100 mm minimum" onCommit={(value) => setZone(opening.id, { height: value })} />
        </article>
      ))}
    </section>
  )
}

function ColumnFields({ band, onBand, wallId, onWall }: { band: 'haut' | 'bas'; onBand: (band: 'haut' | 'bas') => void; wallId: WallId; onWall: (wallId: WallId) => void }) {
  const kitchen = useKitchen()
  const { project, selected } = kitchen
  const walls = WALLS.filter((id) => id !== 'ilot' || project.room.island)
  const shownWall = walls.includes(wallId) ? wallId : 'A'
  const onThisWall = project.columns.filter((column) => column.wallId === shownWall)
  const index = onThisWall.findIndex((column) => column.id === selected.id)
  const columns = onThisWall.map((column) => `${column.width}fr`).join(' ')
  const onWallSelected = selected.wallId === shownWall
  const editingHaut = onWallSelected && selected.kind === 'bas' && band === 'haut'
  const pieceIssues = kitchen.issues.filter((issue) => {
    if (issue.columnId !== selected.id || !onWallSelected) return false
    if (selected.kind === 'colonne') return true
    return editingHaut ? issue.part === 'haut' : issue.part !== 'haut'
  })

  return (
    <section className="panel">
      <h2>Implantation</h2>
      <div className="segment" role="group" aria-label="Mur en cours">
        {walls.map((id) => (
          <button key={id} type="button" aria-pressed={shownWall === id} onClick={() => onWall(id)}>{id === 'ilot' ? 'Îlot' : wallName(id)}</button>
        ))}
      </div>
      {onThisWall.length === 0 ? (
        <p className="summary">{wallName(shownWall)} est vide.</p>
      ) : (
      <div className="runs" style={{ gridTemplateColumns: columns }}>
        {onThisWall.map((column, cursor) => {
          const number = String(cursor + 1).padStart(2, '0')
          const place = cursor + 1
          if (column.kind === 'colonne') {
            return (
              <button
                key={column.id}
                type="button"
                className="run-span"
                style={{ gridColumn: place, gridRow: '1 / span 2' }}
                aria-pressed={column.id === selected.id}
                data-flag={kitchen.issues.some((issue) => issue.columnId === column.id && issue.level === 'refus') ? 'refus' : undefined}
                onClick={() => { kitchen.select(column.id); onBand('bas') }}
              >
                <small>{number}</small>
                <strong>{column.tower === 'frigo' ? 'Frigo' : 'Colonne'}</strong>
                <em>{column.width}</em>
              </button>
            )
          }
          return (
            <Fragment key={column.id}>
              <button
                type="button"
                style={{ gridColumn: place, gridRow: 1 }}
                aria-pressed={column.id === selected.id && band === 'haut'}
                data-flag={kitchen.issues.some((issue) => issue.columnId === column.id && issue.part === 'haut' && issue.level === 'refus') ? 'refus' : undefined}
                onClick={() => { kitchen.select(column.id); onBand('haut') }}
              >
                <small>{number}</small>
                <strong>{column.upper === 'aucun' ? 'Vide' : upperLabel(column.upper)}</strong>
              </button>
              <button
                type="button"
                style={{ gridColumn: place, gridRow: 2 }}
                aria-pressed={column.id === selected.id && band === 'bas'}
                data-flag={kitchen.issues.some((issue) => issue.columnId === column.id && issue.part !== 'haut' && issue.level === 'refus') ? 'refus' : undefined}
                onClick={() => { kitchen.select(column.id); onBand('bas') }}
              >
                <small>{number}</small>
                <strong>{column.base === 'lave-vaisselle' ? 'LV' : column.base === 'four-plaque' ? 'Four' : shortBase(column.base)}</strong>
                <em>{column.width}</em>
              </button>
            </Fragment>
          )
        })}
      </div>
      )}
      <div className="row-actions">
        <button type="button" className="secondary" aria-pressed={selected.locked} disabled={!onWallSelected} onClick={() => kitchen.setLocked(!selected.locked)}>{selected.locked ? 'Déverrouiller' : 'Verrouiller'}</button>
        <button type="button" className="secondary" onClick={() => kitchen.add(shownWall)}>Ajouter</button>
        <button type="button" className="secondary" onClick={kitchen.remove} disabled={!onWallSelected || project.columns.length === 1}>Retirer</button>
      </div>
      {onWallSelected && (editingHaut ? (
        <div className="piece">
          <h3>Haut · meuble {index + 1}</h3>
          <div className="choices" role="group" aria-label="Meuble haut">
            {UPPERS.map((item) => (
              <button key={item.id} type="button" aria-pressed={selected.upper === item.id} onClick={() => kitchen.setUpper(item.id)}>{item.label}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="piece">
          <h3>{selected.kind === 'colonne' ? 'Colonne' : 'Bas'} · meuble {index + 1}</h3>
          <MmField
            label="Largeur"
            value={selected.width}
            min={COLUMN_MIN}
            max={COLUMN_MAX}
            disabled={selected.locked}
            hint={selected.locked ? 'Largeur verrouillée.' : `${COLUMN_MIN}–${COLUMN_MAX} mm`}
            onCommit={kitchen.setWidth}
          />
          {selected.kind === 'colonne' ? (
            <div className="choices" role="group" aria-label="Colonne">
              <button type="button" aria-pressed={selected.tower === 'frigo'} onClick={() => kitchen.setTower('frigo')}>Frigo</button>
              <button type="button" aria-pressed={selected.tower === 'rangement'} onClick={() => kitchen.setTower('rangement')}>Rangement</button>
              <button type="button" onClick={() => kitchen.setKind('bas')}>Revenir à un bas</button>
            </div>
          ) : (
            <div className="choices" role="group" aria-label="Rôle du bas">
              {BASES.map((item) => (
                <button key={item.id} type="button" aria-pressed={selected.base === item.id} onClick={() => kitchen.setBase(item.id)}>{item.label}</button>
              ))}
              <button type="button" onClick={() => kitchen.setKind('colonne')}>Colonne</button>
            </div>
          )}
          <div className="choices" role="group" aria-label="Poignée">
            {HANDLES.map((item) => (
              <button key={item.id} type="button" aria-pressed={selected.handle === item.id} onClick={() => kitchen.setHandle(item.id)}>{item.label}</button>
            ))}
          </div>
          {selected.kind === 'bas' && applianceNote(selected.base, selected.width, project.wall.baseHeight, project.wall.baseDepth, project.rules) && (
            <p className="summary">{applianceNote(selected.base, selected.width, project.wall.baseHeight, project.wall.baseDepth, project.rules)}</p>
          )}
        </div>
      ))}
      <Problems issues={pieceIssues} onCorrect={kitchen.correct} />
    </section>
  )
}

function Problems({ issues, onCorrect }: { issues: KitchenIssue[]; onCorrect: (id: string) => void }) {
  if (issues.length === 0) return null
  return (
    <div className="problems">
      {issues.map((issue) => (
        <article key={`${issue.columnId}-${issue.message}`} className={issue.level}>
          <strong>{issue.level === 'refus' ? 'Refus' : 'Attention'}</strong>
          <p>{issue.message}</p>
          {issue.columnId && canCorrectIssue(issue) && (
            <button type="button" className="secondary" onClick={() => onCorrect(issue.columnId as string)}>Corriger</button>
          )}
        </article>
      ))}
    </div>
  )
}

function KitchenCutList() {
  const { project } = useKitchen()
  const rows = buildKitchenCutList(project)
  const material = kitchenFinish(project.finish).name
  return (
    <section className="cutlist" aria-labelledby="kitchen-cut-title">
      <header>
        <h2 id="kitchen-cut-title">Liste de débit</h2>
        <p>{rows.length} lignes · {material}. Le plan et la crédence sont des pièces.</p>
      </header>
      <table>
        <thead>
          <tr>
            <th>Meuble</th>
            <th>Rôle</th>
            <th className="num">Qté</th>
            <th className="num">Longueur</th>
            <th className="num">Largeur</th>
            <th className="num">Ép.</th>
            <th>Matière</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.caisson}-${row.role}-${row.length}-${row.width}-${index}`}>
              <td>{row.caisson}</td>
              <td>{row.role}</td>
              <td className="num">{row.quantity}</td>
              <td className="num">{formatCutCell(row.length, row.role, 'length')}</td>
              <td className="num">{formatCutCell(row.width, row.role, 'width')}</td>
              <td className="num">{formatCutCell(row.thickness, row.role, 'thickness')}</td>
              <td>{row.material}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function applianceNote(
  base: BaseRole,
  width: number,
  height: number,
  depth: number,
  rules: { evierMinMm: number; plaqueMinMm: number; fourMinMm: number; laveVaisselleMinMm: number },
): string | null {
  const minimum =
    base === 'evier' ? rules.evierMinMm :
    base === 'plaque' || base === 'four-plaque' ? rules.plaqueMinMm :
    base === 'four' ? rules.fourMinMm :
    base === 'lave-vaisselle' ? rules.laveVaisselleMinMm :
    null
  if (minimum === null) return null
  return `Réservation ${width} × ${height} × ${depth} mm. Largeur minimum ${minimum} mm.`
}

function labelKind(kind: OpeningKind): string {
  if (kind === 'fenetre') return 'Fenêtre'
  if (kind === 'porte') return 'Porte'
  return 'Zone interdite'
}

class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  render() {
    if (this.state.failed) return <p className="summary">La vue 3D n’a pas pu démarrer. Le navigateur doit autoriser WebGL.</p>
    return this.props.children
  }
}
