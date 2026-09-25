import { Elevation } from './Elevation'
import { CutListTable } from './CutListTable'
import { finishById } from '../domain/rules'
import type { Project } from '../domain/types'

export function PrintSheet({ project, selectedId }: { project: Project; selectedId: string }) {
  const wall = project.wall
  const carcass = finishById(project.finish).name

  return (
    <article className="print-sheet">
      <header>
        <h1>Dressing</h1>
        <p>
          {wall.width} × {wall.height} × {wall.depth} mm · socle {wall.socle} · jeu {wall.ceilingGap} · caisse {carcass}
        </p>
      </header>
      <Elevation project={project} selectedId={selectedId} onSelect={() => undefined} listed />
      <CutListTable selectedKey={null} onSelect={() => undefined} quiet />
    </article>
  )
}

export function printSheet(project: Project) {
  const previous = document.title
  const wall = project.wall
  document.title = `Caisson-${wall.width}x${wall.height}x${wall.depth}`
  const restore = () => {
    document.title = previous
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
}
