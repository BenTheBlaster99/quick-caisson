import { buildCutList, cutRowKey, formatCutCell } from '../domain/cutlist'
import { finishById } from '../domain/rules'
import type { CutRow } from '../domain/types'
import { useProject } from '../state/project-context'

export function CutListTable({
  selectedKey,
  onSelect,
}: {
  selectedKey: string | null
  onSelect: (row: CutRow) => void
}) {
  const { project } = useProject()
  const rows = buildCutList(project)
  const material = finishById(project.finish).name

  return (
    <section className="cutlist" aria-labelledby="cut-title">
      <header>
        <h2 id="cut-title">Liste de débit</h2>
        <p>
          {rows.length} lignes · {material}. Cliquez une ligne pour la voir dans le dressing.
        </p>
      </header>
      <table>
        <thead>
          <tr>
            <th>Caisson</th>
            <th>Rôle</th>
            <th className="num">Qté</th>
            <th className="num">Longueur</th>
            <th className="num">Largeur</th>
            <th className="num">Ép.</th>
            <th>Matière</th>
            <th>Chant visible</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={cutRowKey(row)}
              aria-selected={cutRowKey(row) === selectedKey}
              onClick={() => onSelect(row)}
            >
              <td>{row.caisson}</td>
              <td>{row.role}</td>
              <td className="num">{row.quantity}</td>
              <td className="num">{formatCutCell(row.length, row.role, 'length')}</td>
              <td className="num">{formatCutCell(row.width, row.role, 'width')}</td>
              <td className="num">{formatCutCell(row.thickness, row.role, 'thickness')}</td>
              <td>{row.material}</td>
              <td>{row.edges}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cut-note">Longueur = le grand côté. Largeur = l’autre. Pas de trait de scie, pas de débit de panneau.</p>
    </section>
  )
}
