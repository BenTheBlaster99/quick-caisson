import { layoutProject, usableHeight } from '../domain/layout'
import { doorCountForCaisson } from '../domain/layout'
import { finishById, splitEven } from '../domain/rules'
import type { Project } from '../domain/types'

export function Elevation({
  project,
  selectedId,
  onSelect,
  listed = false,
}: {
  project: Project
  selectedId: string
  onSelect: (id: string) => void
  listed?: boolean
}) {
  const wall = project.wall
  const layouts = layoutProject(project)
  const selected = Math.max(0, project.caissons.findIndex((caisson) => caisson.id === selectedId))
  const wash = finishById(project.finish).color
  const boxHeight = usableHeight(wall)

  const vbW = 860
  const vbH = 420
  const padL = 64
  const padR = 78
  const padT = 18
  const padB = 64
  const scale = Math.min((vbW - padL - padR) / wall.width, (vbH - padT - padB) / wall.height)
  const originX = padL
  const originY = padT + wall.height * scale
  const xOf = (mm: number) => originX + mm * scale
  const yOf = (mm: number) => originY - mm * scale

  let cursor = 0
  const columns = project.caissons.map((caisson, index) => {
    const start = cursor
    cursor += caisson.width
    return { caisson, index, start, layout: layouts[index] }
  })

  const marks = marksFor(wall.socle, layouts[selected])

  return (
    <figure className="elevation">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} role="img" aria-label="Élévation cotée du mur">
        <rect className="drawing" x={xOf(0)} y={yOf(wall.height)} width={wall.width * scale} height={wall.height * scale} />
        {wall.ceilingGap > 0 && (
          <text className="label" x={xOf(wall.width / 2)} y={yOf(wall.height - wall.ceilingGap / 2)} textAnchor="middle">
            jeu {wall.ceilingGap}
          </text>
        )}
        {wall.socle > 0 && (
          <g>
            <rect
              className="fill"
              x={xOf(0)}
              y={yOf(wall.socle)}
              width={wall.width * scale}
              height={wall.socle * scale}
              fill="#ddd6c8"
            />
            <text className="label" x={xOf(12)} y={yOf(wall.socle / 2)}>
              socle {wall.socle}
            </text>
          </g>
        )}
        {columns.map(({ caisson, index, start, layout }) => {
          const active = index === selected
          return (
            <g key={caisson.id} className="bay-hit" onClick={() => onSelect(caisson.id)}>
              <rect
                className="fill"
                x={xOf(start)}
                y={yOf(wall.socle + boxHeight)}
                width={caisson.width * scale}
                height={boxHeight * scale}
                fill={wash}
                fillOpacity={active ? 0.72 : 0.38}
                stroke={active ? '#1d4a42' : '#3c342b'}
                strokeWidth={active ? 2.4 : 1.25}
              />
              {layout.drawers.map((drawer, drawerIndex) => (
                <rect
                  key={`${caisson.id}-d-${drawerIndex}`}
                  className="fill"
                  x={xOf(start + 18)}
                  y={yOf(wall.socle + drawer.bottom + drawer.height)}
                  width={(caisson.width - 36) * scale}
                  height={drawer.height * scale}
                  fill="none"
                />
              ))}
              {layout.closingShelf && (
                <line
                  className="drawing"
                  x1={xOf(start + 18)}
                  x2={xOf(start + caisson.width - 18)}
                  y1={yOf(wall.socle + layout.closingShelf.top)}
                  y2={yOf(wall.socle + layout.closingShelf.top)}
                  strokeWidth={2.5}
                />
              )}
              {layout.shelves.map((shelf, shelfIndex) => (
                <line
                  key={`${caisson.id}-s-${shelfIndex}`}
                  className="drawing"
                  x1={xOf(start + 18)}
                  x2={xOf(start + caisson.width - 18)}
                  y1={yOf(wall.socle + shelf.top)}
                  y2={yOf(wall.socle + shelf.top)}
                  strokeWidth={2}
                />
              ))}
              {layout.rails.map((rail) => (
                <line
                  key={`${caisson.id}-${rail.kind}`}
                  x1={xOf(start + 18)}
                  x2={xOf(start + caisson.width - 18)}
                  y1={yOf(wall.socle + rail.axis)}
                  y2={yOf(wall.socle + rail.axis)}
                  stroke="#6d737a"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                />
              ))}
              {caisson.door !== 'aucune' &&
                splitEven(caisson.width, doorCountForCaisson(caisson.width)).slice(0, -1).map((_, doorIndex, doors) => {
                  const at = start + doors.slice(0, doorIndex + 1).reduce((sum, width) => sum + width, 0)
                  return (
                    <line
                      key={`${caisson.id}-door-${doorIndex}`}
                      className="drawing"
                      x1={xOf(at)}
                      x2={xOf(at)}
                      y1={yOf(wall.socle)}
                      y2={yOf(wall.socle + boxHeight)}
                      strokeDasharray="4 3"
                    />
                  )
                })}
              <text className="label" x={xOf(start + 8)} y={yOf(wall.socle + boxHeight - 10)}>
                {index + 1}
              </text>
              {xOf(start + caisson.width) - xOf(start) > 34 && (
                <DimH x1={xOf(start)} x2={xOf(start + caisson.width)} y={originY + 16} label={String(caisson.width)} />
              )}
            </g>
          )
        })}
        <DimH x1={xOf(0)} x2={xOf(wall.width)} y={originY + 44} label={String(wall.width)} />
        <DimV x={originX - 28} y1={yOf(0)} y2={yOf(wall.height)} label={String(wall.height)} />
        {marks.map((mark) => (
          <g key={`${mark.y}-${mark.text}`}>
            <line
              className="drawing"
              x1={xOf(columns[selected].start + columns[selected].caisson.width)}
              x2={xOf(wall.width) + 10}
              y1={yOf(mark.y)}
              y2={yOf(mark.y)}
            />
            <text className="label" x={xOf(wall.width) + 14} y={yOf(mark.y) + 4}>
              {mark.y}
            </text>
          </g>
        ))}
      </svg>
      <div className="cotes">
        {(listed ? columns : [columns[selected]].filter((column) => column !== undefined)).map((column) => {
          const lines = marksFor(wall.socle, column.layout)
          if (lines.length === 0) {
            return listed ? null : <p key={column.caisson.id}>Ce caisson n’a ni étagère ni tringle.</p>
          }
          return (
            <section key={column.caisson.id}>
              <h3>Caisson {column.index + 1}</h3>
              <ul>
                {lines.map((mark) => (
                  <li key={`${mark.y}-${mark.text}`}>{mark.text}</li>
                ))}
              </ul>
            </section>
          )
        })}
        {listed && columns.every(({ layout }) => marksFor(wall.socle, layout).length === 0) && (
          <p>Aucune étagère ni tringle.</p>
        )}
      </div>
    </figure>
  )
}

function marksFor(socle: number, layout: ReturnType<typeof layoutProject>[number] | undefined) {
  if (!layout) return []
  const marks: { y: number; text: string }[] = []
  layout.shelves.forEach((shelf, index) => {
    const y = Math.round(socle + shelf.top)
    marks.push({ y, text: `Étagère ${index + 1}, en partant du bas : le dessus est à ${y} mm du sol` })
  })
  for (const rail of layout.rails) {
    const y = Math.round(socle + rail.axis)
    const place = rail.kind === 'haute' ? 'haute' : 'basse'
    marks.push({ y, text: `Tringle ${place} : l’axe est à ${y} mm du sol` })
  }
  return marks.sort((a, b) => a.y - b.y)
}

function DimH({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  const mid = (x1 + x2) / 2
  return (
    <g className="dim">
      <line x1={x1} x2={x2} y1={y} y2={y} />
      <line x1={x1} x2={x1} y1={y - 4} y2={y + 4} />
      <line x1={x2} x2={x2} y1={y - 4} y2={y + 4} />
      <text x={mid} y={y + 14} textAnchor="middle">
        {label}
      </text>
    </g>
  )
}

function DimV({ x, y1, y2, label }: { x: number; y1: number; y2: number; label: string }) {
  const mid = (y1 + y2) / 2
  return (
    <g className="dim">
      <line x1={x} x2={x} y1={y1} y2={y2} />
      <line x1={x - 4} x2={x + 4} y1={y1} y2={y1} />
      <line x1={x - 4} x2={x + 4} y1={y2} y2={y2} />
      <text x={x - 8} y={mid} textAnchor="middle" transform={`rotate(-90 ${x - 8} ${mid})`}>
        {label}
      </text>
    </g>
  )
}
