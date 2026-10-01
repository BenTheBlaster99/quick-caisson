import { inspectKitchen, openingName, placeColumns, shortBase, upperSpan, worktopRuns, worktopTop } from '../../kitchen/layout'
import { kitchenFinish, wallFinish } from '../../kitchen/finishes'
import { footprint, wallName, builtWalls } from '../../kitchen/room'
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
  const placed = placeColumns(project.columns.filter((column) => column.wallId === 'A'))
  const top = worktopTop(wall)
  const refused = new Set(inspectKitchen(project).issues.filter((issue) => issue.level === 'refus').map((issue) => issue.columnId))
  const wash = kitchenFinish(project.finish).color

  function y(mm: number) {
    return pad + (wall.ceilingHeight - mm) * scale
  }

  return (
    <figure>
      <figcaption>Élévation · {wallName('A')} · {wall.width} × {wall.ceilingHeight} mm</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Élévation de la cuisine">
        <rect x={pad} y={pad} width={wall.width * scale} height={wall.ceilingHeight * scale} fill="#efeae2" stroke="#1c1c1c" />
        {project.openings.filter((opening) => opening.wallId === 'A').map((opening) => (
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
        {worktopRuns(project.columns).filter((run) => run.wallId === 'A').map((run) => (
          <rect key={`${run.wallId}-${run.x}`} x={pad + run.x * scale} y={y(top)} width={run.width * scale} height={Math.max(2, wall.worktopThickness * scale)} fill="#c8bba8" />
        ))}
        <text x={pad} y={height - 18} fontSize="12">{wall.width} mm</text>
      </svg>
    </figure>
  )
}

function TopPlan({ project, selectedId, onSelect }: { project: KitchenProject; selectedId: string; onSelect: (id: string) => void }) {
  const { wall, room } = project
  const pad = 48
  const scale = 0.16
  const width = wall.width * scale + pad * 2
  const height = room.depth * scale + pad * 2
  const placed = placeColumns(project.columns.filter((column) => column.wallId !== 'ilot' || room.island))
  const wash = kitchenFinish(project.finish).color

  return (
    <figure>
      <figcaption>Plan · {wall.width} × {room.depth} mm</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Plan de la cuisine">
        <rect x={pad} y={pad} width={wall.width * scale} height={room.depth * scale} fill="#f6f3ee" stroke="#1c1c1c" />
        {builtWalls(room.shape, project.openings).includes('A') && <rect x={pad} y={pad} width={wall.width * scale} height={10} fill={wallFinish(room.finishes.A).color} />}
        {builtWalls(room.shape, project.openings).includes('D') && <rect x={pad} y={pad + room.depth * scale - 10} width={wall.width * scale} height={10} fill={wallFinish(room.finishes.D).color} />}
        {builtWalls(room.shape, project.openings).includes('B') && <rect x={pad} y={pad} width={10} height={room.depth * scale} fill={wallFinish(room.finishes.B).color} />}
        {builtWalls(room.shape, project.openings).includes('C') && <rect x={pad + wall.width * scale - 10} y={pad} width={10} height={room.depth * scale} fill={wallFinish(room.finishes.C).color} />}
        {project.openings.filter((opening) => opening.wallId !== 'ilot').map((opening) => {
          const box = footprint(room, wall.width, opening.wallId, opening.x, opening.width, 80)
          return (
            <rect
              key={opening.id}
              x={pad + box.x * scale}
              y={pad + box.z * scale}
              width={Math.max(2, box.w * scale)}
              height={Math.max(2, box.d * scale)}
              fill={opening.kind === 'fenetre' ? '#d5e6f2' : opening.kind === 'porte' ? '#f7f3ec' : '#f0c2bc'}
              stroke="#1c1c1c"
            />
          )
        })}
        {placed.map((column) => {
          const into = column.wallId === 'ilot' ? room.islandDepth : wall.baseDepth
          const box = footprint(room, wall.width, column.wallId, column.x, column.width, into)
          return (
            <g key={column.id} onClick={() => onSelect(column.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={pad + box.x * scale}
                y={pad + box.z * scale}
                width={box.w * scale}
                height={box.d * scale}
                fill={column.kind === 'colonne' ? '#d7d3cc' : wash}
                stroke={column.id === selectedId ? '#1d4a42' : '#1c1c1c'}
                strokeWidth={column.id === selectedId ? 3 : 1}
              />
              <text x={pad + (box.x + box.w / 2) * scale} y={pad + (box.z + box.d / 2) * scale} textAnchor="middle" fontSize="11">{column.width}</text>
            </g>
          )
        })}
        {project.openings.filter((opening) => opening.kind === 'interdit').map((opening) => {
          const box = footprint(room, wall.width, opening.wallId, opening.x, opening.width, 80)
          return (
            <text key={`${opening.id}-label`} x={pad + (box.x + box.w / 2) * scale} y={pad + (box.z + box.d) * scale + 14} textAnchor="middle" fontSize="11" fill="#8d2f2a">
              {openingName(opening.kind)}
            </text>
          )
        })}
      </svg>
    </figure>
  )
}
