import { inspectKitchen, openingName, placeColumns, shortBase, upperSpan, worktopRuns, worktopTop } from '../../kitchen/layout'
import { kitchenFinish } from '../../kitchen/finishes'
import type { KitchenProject } from '../../kitchen/types'

export function KitchenPlan({
  project,
  selectedId,
  onSelect,
  focus = 'both',
}: {
  project: KitchenProject
  selectedId: string
  onSelect: (id: string) => void
  focus?: 'both' | 'elevation' | 'plan'
}) {
  return (
    <div className={focus === 'both' ? 'kitchen-plan' : 'kitchen-plan single'}>
      {focus !== 'plan' && <Elevation project={project} selectedId={selectedId} onSelect={onSelect} />}
      {focus !== 'elevation' && <TopPlan project={project} selectedId={selectedId} onSelect={onSelect} />}
    </div>
  )
}

function Elevation({ project, selectedId, onSelect }: { project: KitchenProject; selectedId: string; onSelect: (id: string) => void }) {
  const { wall } = project
  const pad = 70
  const scale = 0.22
  const width = wall.width * scale + pad * 2
  const height = wall.ceilingHeight * scale + pad * 2
  const placed = placeColumns(project.columns)
  const top = worktopTop(wall)
  const refused = new Set(inspectKitchen(project).issues.filter((issue) => issue.level === 'refus').map((issue) => issue.columnId))
  const wash = kitchenFinish(project.finish).color

  function y(mm: number) {
    return pad + (wall.ceilingHeight - mm) * scale
  }

  return (
    <figure>
      <figcaption>Élévation · {wall.width} × {wall.ceilingHeight} mm</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Élévation de la cuisine">
        <rect x={pad} y={pad} width={wall.width * scale} height={wall.ceilingHeight * scale} fill="#efeae2" stroke="#1c1c1c" />
        {project.openings.map((opening) => (
          <rect
            key={opening.id}
            x={pad + opening.x * scale}
            y={y(opening.bottom + opening.height)}
            width={opening.width * scale}
            height={opening.height * scale}
            fill={opening.kind === 'interdit' ? '#f0c2bc' : opening.kind === 'fenetre' ? '#d5e6f2' : '#f7f3ec'}
            stroke="#1c1c1c"
          />
        ))}
        {placed.map((column) => {
          const fill = refused.has(column.id) ? '#f0c2bc' : wash
          if (column.kind === 'colonne') {
            const boxHeight = wall.ceilingHeight - project.rules.towerGapMm
            return (
              <g key={column.id} onClick={() => onSelect(column.id)} style={{ cursor: 'pointer' }}>
                <rect x={pad + column.x * scale} y={y(boxHeight)} width={column.width * scale} height={boxHeight * scale} fill={fill} stroke={column.id === selectedId ? '#1d4a42' : '#1c1c1c'} strokeWidth={column.id === selectedId ? 3 : 1} />
                <text x={pad + (column.x + column.width / 2) * scale} y={y(boxHeight / 2)} textAnchor="middle" fontSize="11">{column.tower === 'frigo' ? 'Frigo' : 'Colonne'}</text>
              </g>
            )
          }
          const upper = column.upper === 'aucun' ? null : upperSpan(wall, project.rules, column.x, column.width)
          return (
            <g key={column.id} onClick={() => onSelect(column.id)} style={{ cursor: 'pointer' }}>
              <rect x={pad + column.x * scale} y={y(wall.plinthHeight + wall.baseHeight)} width={column.width * scale} height={wall.baseHeight * scale} fill={fill} stroke={column.id === selectedId ? '#1d4a42' : '#1c1c1c'} strokeWidth={column.id === selectedId ? 3 : 1} />
              {upper && (
                <rect x={pad + upper.x * scale} y={y(upper.top)} width={upper.width * scale} height={(upper.top - upper.bottom) * scale} fill={fill} stroke="#1c1c1c" />
              )}
              <text x={pad + (column.x + column.width / 2) * scale} y={y(wall.plinthHeight + wall.baseHeight / 2)} textAnchor="middle" fontSize="11">{shortBase(column.base)}</text>
            </g>
          )
        })}
        {worktopRuns(project.columns).map((run) => (
          <rect key={run.x} x={pad + run.x * scale} y={y(top)} width={run.width * scale} height={Math.max(2, wall.worktopThickness * scale)} fill="#c8bba8" />
        ))}
        <text x={pad} y={height - 18} fontSize="12">{wall.width} mm</text>
      </svg>
    </figure>
  )
}

function TopPlan({ project, selectedId, onSelect }: { project: KitchenProject; selectedId: string; onSelect: (id: string) => void }) {
  const { wall } = project
  const pad = 48
  const scale = 0.22
  const depth = wall.baseDepth + project.rules.worktopOverhangMm
  const width = wall.width * scale + pad * 2
  const height = depth * scale + pad * 2 + 36
  const placed = placeColumns(project.columns)
  const wash = kitchenFinish(project.finish).color

  return (
    <figure>
      <figcaption>Plan · profondeur bas {wall.baseDepth} mm, débord {project.rules.worktopOverhangMm} mm</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Plan de la cuisine">
        <rect x={pad} y={pad} width={wall.width * scale} height={8} fill="#1c1c1c" />
        {project.openings.filter((opening) => opening.kind !== 'interdit').map((opening) => (
          <rect key={opening.id} x={pad + opening.x * scale} y={pad - 6} width={opening.width * scale} height={18} fill={opening.kind === 'fenetre' ? '#d5e6f2' : '#f7f3ec'} stroke="#1c1c1c" />
        ))}
        {placed.map((column) => {
          const boxDepth = wall.baseDepth
          return (
            <g key={column.id} onClick={() => onSelect(column.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={pad + column.x * scale}
                y={pad + 12}
                width={column.width * scale}
                height={boxDepth * scale}
                fill={column.kind === 'colonne' ? '#d7d3cc' : wash}
                stroke={column.id === selectedId ? '#1d4a42' : '#1c1c1c'}
                strokeWidth={column.id === selectedId ? 3 : 1}
              />
              {column.kind === 'bas' && column.upper !== 'aucun' && (
                <rect x={pad + column.x * scale + 2} y={pad + 16} width={column.width * scale - 4} height={wall.upperDepth * scale} fill="none" stroke="#1c1c1c" strokeDasharray="4 3" />
              )}
              <text x={pad + (column.x + column.width / 2) * scale} y={pad + 12 + boxDepth * scale / 2} textAnchor="middle" fontSize="11">{column.width}</text>
            </g>
          )
        })}
        {project.openings.filter((opening) => opening.kind === 'interdit').map((opening) => (
          <text key={opening.id} x={pad + (opening.x + opening.width / 2) * scale} y={height - 16} textAnchor="middle" fontSize="11" fill="#8d2f2a">
            {openingName(opening.kind)}
          </text>
        ))}
      </svg>
    </figure>
  )
}
