import { wallWidthRange } from '../domain/caissons'
import { usableHeight } from '../domain/layout'
import { LIMITS } from '../domain/rules'
import { useProject } from '../state/project-context'
import { MmField } from './MmField'

function limitHint(min: number, max: number): string {
  return `Limite : ${min}–${max} mm`
}

export function WallForm() {
  const { project, setWall } = useProject()
  const wall = project.wall
  const useful = usableHeight(wall)
  const width = wallWidthRange(project.caissons.length)

  return (
    <section className="panel" aria-labelledby="wall-title">
      <h2 id="wall-title">Le mur</h2>
      <p className="lead">Largeur, hauteur, profondeur, socle. Le mur est encore vide.</p>
      <div className="fields">
        <MmField label="Largeur" value={wall.width} hint={limitHint(width.min, width.max)} onCommit={(value) => setWall('width', value)} />
        <MmField label="Hauteur" value={wall.height} hint={limitHint(LIMITS.height.min, LIMITS.height.max)} onCommit={(value) => setWall('height', value)} />
        <MmField label="Profondeur" value={wall.depth} hint={limitHint(LIMITS.depth.min, LIMITS.depth.max)} onCommit={(value) => setWall('depth', value)} />
        <MmField label="Socle" value={wall.socle} hint={limitHint(LIMITS.socle.min, LIMITS.socle.max)} onCommit={(value) => setWall('socle', value)} />
        <MmField label="Jeu au plafond" value={wall.ceilingGap} hint={limitHint(LIMITS.ceilingGap.min, LIMITS.ceilingGap.max)} onCommit={(value) => setWall('ceilingGap', value)} />
      </div>
      <div className="readout">
        <span>Hauteur utile des caissons</span>
        <strong>{useful.toLocaleString('fr-FR')} mm</strong>
      </div>
      <details className="rules">
        <summary>Règles par défaut</summary>
        <ul>
          <li>Dimensions hors tout. Chaque caisson est une boîte : 2 joues, dessus, dessous, fond rapporté. Jeu entre caissons : 0.</li>
          <li>Les joues font toute la hauteur utile. Dessus et dessous sont entre les joues. Caisse et étagères 18 mm, fond 8 mm, sans rainure.</li>
          <li>Hauteur utile = hauteur − socle − jeu au plafond. Le socle est un socle devant le mur, avec deux retours.</li>
          <li>Largeur de caisson : 300–1200 mm. La somme égale toujours la largeur du mur.</li>
          <li>Modifier une largeur prend sur le caisson de droite. Le dernier échange avec celui de gauche. Sinon, refus.</li>
          <li>La largeur du mur se règle depuis la droite, dans les mêmes limites. Ajouter coupe le plus large en deux. Retirer donne sa largeur au voisin.</li>
          <li>Étagères réparties dans la zone libre. Tringle haute à 80 mm sous le dessus, basse à mi-hauteur intérieure. Tiroirs seuls : toute la hauteur. Sinon 200 mm chacun, en gardant de la place au-dessus.</li>
          <li>Pantalonnière : une ligne d’accessoire, zone nominale 800 mm. Caisse de tiroir : profondeur − 50 mm, 20 mm plus basse que la façade, fond 8 mm. Pas de coulisses.</li>
          <li>Battantes : 1 porte sous 600 mm, 2 à partir de 600 mm. Coulissantes : 2 vantaux si le mur fait moins de 2400 mm, sinon 3, sur tout le mur.</li>
          <li>Chant visible : avant ou aucun. Ce n’est pas encore une règle de chant. Pas de trait de scie.</li>
        </ul>
      </details>
    </section>
  )
}
