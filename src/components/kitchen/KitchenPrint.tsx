import { formatCutCell } from '../../domain/cutlist'
import { buildKitchenCutList } from '../../kitchen/cutlist'
import { kitchenFinish } from '../../kitchen/finishes'
import type { KitchenProject } from '../../kitchen/types'
import { KitchenPlan } from './KitchenPlan'

export function KitchenPrintSheet({ project }: { project: KitchenProject }) {
  const rows = buildKitchenCutList(project)
  const material = kitchenFinish(project.finish).name
  const side = project.room.shape === 'l' ? (project.room.lSide === 'droite' ? 'L à droite' : 'L à gauche') : project.room.shape === 'u' ? 'U' : 'Linéaire'

  return (
    <article className="print-sheet">
      <header>
        <h1>{project.name}</h1>
        <p>
          {side} · {project.wall.width} × {project.room.depth} × {project.wall.ceilingHeight} mm · {material}
          {project.room.island ? ` · îlot ${project.room.islandLength} × ${project.room.islandDepth} mm` : ''}
        </p>
      </header>
      <KitchenPlan project={project} selectedId="" onSelect={() => undefined} print />
      <section className="cutlist">
        <header>
          <h2>Liste de débit</h2>
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
    </article>
  )
}

export function printKitchen(project: KitchenProject) {
  const previous = document.title
  document.title = `Cuisine-${project.wall.width}x${project.room.depth}`
  const restore = () => {
    document.title = previous
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
}
