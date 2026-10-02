import { useState } from 'react'
import { cutRun, inspectKitchen, openingName, placeColumns, shortBase, upperSpan, worktopRuns, worktopTop } from '../../kitchen/layout'
import { kitchenFinish, wallFinish } from '../../kitchen/finishes'
import { footprint, wallLength, wallName, builtWalls, WALL_THICK } from '../../kitchen/room'
import type { KitchenProject, Opening, WallId } from '../../kitchen/types'

export function KitchenPlan({
  project,
  selectedId,
  onSelect,
  focus = 'both',
  print = false,
}: {
  project: KitchenProject
  selectedId: string
  onSelect: (id: string) => void
  focus?: 'both' | 'elevation' | 'plan'
  print?: boolean
}) {
  if (print) {
    const walls = builtWalls(project.room.shape, project.room.lSide).filter((id): id is 'A' | 'B' | 'C' => id === 'A' || id === 'B' || id === 'C')
    return (
      <div className="kitchen-plan single">
        {walls.map((id) => (
          <Elevation key={id} project={project} wallId={id} selectedId={selectedId} onSelect={onSelect} />
        ))}
        <TopPlan project={project} selectedId={selectedId} onSelect={onSelect} />
      </div>
    )
  }
  return (
    <div className={focus === 'both' ? 'kitchen-plan' : 'kitchen-plan single'}>
      {focus !== 'plan' && <ElevationView project={project} selectedId={selectedId} onSelect={onSelect} />}
      {focus !== 'elevation' && <TopPlan project={project} selectedId={selectedId} onSelect={onSelect} />}
    </div>
  )
}

function ElevationView({ project, selectedId, onSelect }: { project: KitchenProject; selectedId: string; onSelect: (id: string) => void }) {
  const walls = builtWalls(project.room.shape, project.room.lSide).filter((id): id is 'A' | 'B' | 'C' => id === 'A' || id === 'B' || id === 'C')
  const [wallId, setWallId] = useState<'A' | 'B' | 'C'>(walls[0] ?? 'A')
  const shown = walls.includes(wallId) ? wallId : walls[0] ?? 'A'
  return (
    <div>
      <div className="segment" role="group" aria-label="Élévation">
        {walls.map((id) => (
          <button key={id} type="button" aria-pressed={shown === id} onClick={() => setWallId(id)}>{wallName(id)}</button>
        ))}
      </div>
      <Elevation project={project} wallId={shown} selectedId={selectedId} onSelect={onSelect} />
    </div>
  )
}

function Elevation({ project, wallId, selectedId, onSelect }: { project: KitchenProject; wallId: 'A' | 'B' | 'C'; selectedId: string; onSelect: (id: string) => void }) {
  const { wall } = project
  const pad = 70
  const scale = 0.22
  const length = wallLength(project, wallId)
  const width = length * scale + pad * 2
  const height = wall.ceilingHeight * scale + pad * 2
  const placed = placeColumns(project.columns.filter((column) => column.wallId === wallId))
  const returns = project.columns.filter((column) => column.kind === 'angle' && column.returnWall === wallId)
  const top = worktopTop(wall)
  const refused = new Set(inspectKitchen(project).issues.filter((issue) => issue.level === 'refus').map((issue) => issue.columnId))
  const wash = kitchenFinish(project.finish).color

  function y(mm: number) {
    return pad + (wall.ceilingHeight - mm) * scale
  }

  return (
    <figure>
      <figcaption>Élévation · {wallName(wallId)} · {length} × {wall.ceilingHeight} mm</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Élévation de ${wallName(wallId)}`}>
        <rect x={pad} y={pad} width={length * scale} height={wall.ceilingHeight * scale} fill="#efeae2" stroke="#1c1c1c" />
        {project.openings.filter((opening) => opening.wallId === wallId).map((opening) => (
          <ElevationOpening key={opening.id} opening={opening} pad={pad} scale={scale} y={y} />
        ))}
        {returns.map((column) => (
          <g key={`${column.id}-retour`} onClick={() => onSelect(column.id)} style={{ cursor: 'pointer' }}>
            <rect x={pad} y={y(wall.plinthHeight + wall.baseHeight)} width={column.width * scale} height={wall.baseHeight * scale} fill={refused.has(column.id) ? '#f0c2bc' : wash} stroke={column.id === selectedId ? '#1d4a42' : '#1c1c1c'} strokeWidth={column.id === selectedId ? 3 : 1} />
            <text x={pad + (column.width / 2) * scale} y={y(wall.plinthHeight + wall.baseHeight / 2)} textAnchor="middle" fontSize="11">Angle</text>
          </g>
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
              <text x={pad + (column.x + column.width / 2) * scale} y={y(wall.plinthHeight + wall.baseHeight / 2)} textAnchor="middle" fontSize="11">{column.kind === 'angle' ? 'Angle' : shortBase(column.base)}</text>
            </g>
          )
        })}
        {worktopRuns(project.columns).filter((run) => run.wallId === wallId).map((run) => (
          <rect key={`${run.wallId}-${run.x}`} x={pad + run.x * scale} y={y(top)} width={run.width * scale} height={Math.max(2, wall.worktopThickness * scale)} fill="#c8bba8" />
        ))}
        <text x={pad} y={height - 18} fontSize="12">{length} mm</text>
      </svg>
    </figure>
  )
}

function ElevationOpening({ opening, pad, scale, y }: { opening: Opening; pad: number; scale: number; y: (mm: number) => number }) {
  const x = pad + opening.x * scale
  const top = y(opening.bottom + opening.height)
  const w = opening.width * scale
  const h = opening.height * scale
  if (opening.kind === 'interdit') {
    return <rect x={x} y={top} width={w} height={h} fill="#f0c2bc" stroke="#1c1c1c" />
  }
  if (opening.kind === 'fenetre') {
    return (
      <g>
        <rect x={x} y={top} width={w} height={h} fill="#d5e6f2" stroke="#1c1c1c" strokeWidth={2} />
        <line x1={x + w / 2} y1={top} x2={x + w / 2} y2={top + h} stroke="#1c1c1c" />
        <line x1={x} y1={top + h / 2} x2={x + w} y2={top + h / 2} stroke="#1c1c1c" />
      </g>
    )
  }
  const inset = Math.min(8, w * 0.08)
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} fill="#f4efe6" stroke="#1c1c1c" strokeWidth={2} />
      <rect x={x + inset} y={top + inset} width={Math.max(2, w - inset * 2)} height={Math.max(2, h - inset * 2)} fill="none" stroke="#1c1c1c" />
      <circle cx={x + w * 0.82} cy={top + h * 0.5} r={Math.max(2, Math.min(5, w * 0.04))} fill="#1c1c1c" />
    </g>
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
  const thick = WALL_THICK * scale
  const walls = builtWalls(room.shape, room.lSide)

  function wallBand(wallId: WallId, length: number) {
    const doors = project.openings.filter((opening) => opening.wallId === wallId && opening.kind === 'porte')
    return cutRun(0, length, doors.map((opening) => ({ x: opening.x, width: opening.width })))
  }

  return (
    <figure>
      <figcaption>Plan · {wall.width} × {room.depth} mm</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Plan de la cuisine">
        <rect x={pad} y={pad} width={wall.width * scale} height={room.depth * scale} fill="#f6f3ee" stroke="none" />
        {walls.includes('A') && wallBand('A', wall.width).map((part) => (
          <rect key={`A-${part.x}`} x={pad + part.x * scale} y={pad} width={part.width * scale} height={thick} fill={wallFinish(room.finishes.A).color} />
        ))}
        {walls.includes('B') && wallBand('B', room.depth).map((part) => (
          <rect key={`B-${part.x}`} x={pad} y={pad + part.x * scale} width={thick} height={part.width * scale} fill={wallFinish(room.finishes.B).color} />
        ))}
        {walls.includes('C') && wallBand('C', room.depth).map((part) => (
          <rect key={`C-${part.x}`} x={pad + wall.width * scale - thick} y={pad + part.x * scale} width={thick} height={part.width * scale} fill={wallFinish(room.finishes.C).color} />
        ))}
        {project.openings.filter((opening) => opening.kind === 'fenetre' && walls.includes(opening.wallId)).map((opening) => {
          const box = footprint(room, wall.width, opening.wallId, opening.x, opening.width, WALL_THICK)
          return (
            <rect
              key={opening.id}
              x={pad + box.x * scale}
              y={pad + box.z * scale}
              width={Math.max(2, box.w * scale)}
              height={Math.max(2, box.d * scale)}
              fill="none"
              stroke="#1c1c1c"
              strokeWidth={2}
            />
          )
        })}
        {project.openings.filter((opening) => opening.kind === 'interdit' && opening.wallId !== 'D').map((opening) => {
          const box = footprint(room, wall.width, opening.wallId, opening.x, opening.width, 80)
          return (
            <g key={opening.id}>
              <rect
                x={pad + box.x * scale}
                y={pad + box.z * scale}
                width={Math.max(2, box.w * scale)}
                height={Math.max(2, box.d * scale)}
                fill="#f0c2bc"
                stroke="#1c1c1c"
              />
              <text x={pad + (box.x + box.w / 2) * scale} y={pad + (box.z + box.d) * scale + 14} textAnchor="middle" fontSize="11" fill="#8d2f2a">
                {openingName(opening.kind)}
              </text>
            </g>
          )
        })}
        {placed.map((column) => {
          const into = column.wallId === 'ilot' ? room.islandDepth : wall.baseDepth
          const box = footprint(room, wall.width, column.wallId, column.x, column.width, into)
          const label = `${column.width}×${into}`
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
              {column.kind === 'angle' && (
                <rect
                  x={pad + footprint(room, wall.width, column.returnWall, 0, column.width, into).x * scale}
                  y={pad + footprint(room, wall.width, column.returnWall, 0, column.width, into).z * scale}
                  width={footprint(room, wall.width, column.returnWall, 0, column.width, into).w * scale}
                  height={footprint(room, wall.width, column.returnWall, 0, column.width, into).d * scale}
                  fill={wash}
                  stroke={column.id === selectedId ? '#1d4a42' : '#1c1c1c'}
                  strokeWidth={column.id === selectedId ? 3 : 1}
                />
              )}
              <text x={pad + (box.x + box.w / 2) * scale} y={pad + (box.z + box.d / 2) * scale} textAnchor="middle" fontSize="11">{label}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
