import { ContactShadows, Edges, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { DoubleSide } from 'three'
import { inspectKitchen, placeColumns, upperSpan, worktopRuns, worktopTop, type PlacedColumn } from '../../kitchen/layout'
import { kitchenFinish } from '../../kitchen/finishes'
import type { HandleId, KitchenProject, Opening } from '../../kitchen/types'

type Rig = {
  target: { set: (x: number, y: number, z: number) => void }
  update: () => void
}

export type KitchenCamera = 'perspective' | 'face' | 'top'

export function KitchenScene({
  project,
  selectedId,
  frameToken,
  cameraMode,
  onSelect,
}: {
  project: KitchenProject
  selectedId: string
  frameToken: number
  cameraMode: KitchenCamera
  onSelect: (id: string) => void
}) {
  const span = project.wall.width / 1000
  const eye = worktopTop(project.wall) / 1000
  const marks = new Map<string, 'refus' | 'attention'>()
  for (const issue of inspectKitchen(project).issues) {
    if (!issue.columnId) continue
    const current = marks.get(issue.columnId)
    if (issue.level === 'refus' || current !== 'refus') marks.set(issue.columnId, issue.level)
  }

  return (
    <Canvas camera={{ position: [1.2, 1.45, 3.2], fov: 35 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <color attach="background" args={['#ece7df']} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[3.2, 5.4, 4]} intensity={1.45} />
      <directionalLight position={[-3, 2.2, -1]} intensity={0.22} />
      <group scale={0.001} position={[-project.wall.width / 2000, 0, 0]}>
        <Room project={project} />
        {project.openings.map((opening) => (
          <OpeningMark key={opening.id} opening={opening} />
        ))}
        <KitchenFurniture project={project} selectedId={selectedId} marks={marks} onSelect={onSelect} />
      </group>
      <ContactShadows position={[0, 0.001, 0.28]} opacity={0.32} scale={Math.max(6, span + 1.4)} blur={2.2} far={1.4} color="#3a342c" />
      <OrbitControls makeDefault maxPolarAngle={cameraMode === 'top' ? Math.PI : Math.PI / 2.02} minDistance={0.6} maxDistance={16} />
      <CameraRig span={span} eye={eye} token={frameToken} mode={cameraMode} />
    </Canvas>
  )
}

function CameraRig({ span, eye, token, mode }: { span: number; eye: number; token: number; mode: KitchenCamera }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as Rig | null
  const spanRef = useRef(span)
  const eyeRef = useRef(eye)
  spanRef.current = span
  eyeRef.current = eye

  useEffect(() => {
    const width = spanRef.current
    const focusY = Math.max(0.9, eyeRef.current + 0.15)
    const pose = mode === 'face'
      ? { x: 0, y: focusY, z: Math.max(3.4, width * 1.25), ty: focusY }
      : mode === 'top'
        ? { x: 0, y: Math.max(4.2, width * 1.35), z: 0.02, ty: 0.2 }
        : { x: width * 0.28, y: focusY + 0.35, z: Math.max(2.2, width * 0.72), ty: focusY }
    if (controls) controls.target.set(pose.x * 0.15, pose.ty, 0)
    camera.position.set(pose.x, pose.y, pose.z)
    camera.lookAt(0, pose.ty, 0)
    controls?.update()
  }, [camera, controls, mode, token])

  return null
}

function Room({ project }: { project: KitchenProject }) {
  const { width, ceilingHeight, baseDepth } = project.wall
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, baseDepth + 400]} receiveShadow>
        <planeGeometry args={[width + 2400, 5200]} />
        <meshStandardMaterial color="#ddd6cc" roughness={1} />
      </mesh>
      <mesh position={[width / 2, ceilingHeight / 2, -8]}>
        <boxGeometry args={[width + 500, ceilingHeight, 16]} />
        <meshStandardMaterial color="#f4f1eb" roughness={1} />
      </mesh>
      <mesh position={[width / 2, 40, 8]}>
        <boxGeometry args={[width + 500, 80, 18]} />
        <meshStandardMaterial color="#e7e1d8" />
      </mesh>
    </group>
  )
}

function OpeningMark({ opening }: { opening: Opening }) {
  const y = opening.bottom + opening.height / 2
  if (opening.kind === 'interdit') {
    return (
      <mesh position={[opening.x + opening.width / 2, y, 6]}>
        <boxGeometry args={[opening.width, opening.height, 8]} />
        <meshStandardMaterial color="#e7b2ac" transparent opacity={0.45} />
      </mesh>
    )
  }
  const glass = opening.kind === 'fenetre'
  return (
    <group position={[opening.x + opening.width / 2, y, 2]}>
      <mesh>
        <planeGeometry args={[opening.width - 28, opening.height - 28]} />
        <meshStandardMaterial color={glass ? '#c5d8e6' : '#f7f4ee'} roughness={0.12} metalness={glass ? 0.08 : 0} side={DoubleSide} />
      </mesh>
      {glass && (
        <mesh>
          <boxGeometry args={[10, opening.height - 36, 6]} />
          <meshStandardMaterial color="#f7f4ee" />
        </mesh>
      )}
      <FrameBar y={opening.height / 2 - 8} width={opening.width + 16} height={18} />
      <FrameBar y={-opening.height / 2 + 8} width={opening.width + 16} height={18} />
      <FrameBar y={0} width={18} height={opening.height} x={-opening.width / 2 + 8} />
      <FrameBar y={0} width={18} height={opening.height} x={opening.width / 2 - 8} />
      {glass && <mesh position={[0, -opening.height / 2 - 8, 16]}><boxGeometry args={[opening.width + 40, 16, 28]} /><meshStandardMaterial color="#f7f4ee" /></mesh>}
    </group>
  )
}

function FrameBar({ x = 0, y, width, height }: { x?: number; y: number; width: number; height: number }) {
  return (
    <mesh position={[x, y, 10]}>
      <boxGeometry args={[width, height, 14]} />
      <meshStandardMaterial color="#f7f4ee" />
    </mesh>
  )
}

function KitchenFurniture({
  project,
  selectedId,
  marks,
  onSelect,
}: {
  project: KitchenProject
  selectedId: string
  marks: Map<string, 'refus' | 'attention'>
  onSelect: (id: string) => void
}) {
  const finish = kitchenFinish(project.finish)
  const placed = placeColumns(project.columns)
  const top = worktopTop(project.wall)
  const runs = worktopRuns(project.columns)
  const stone = project.finish === 'noir' ? '#d4cfc6' : '#e7e2d8'

  return (
    <group>
      {placed.map((column) => (
        <Column
          key={column.id}
          project={project}
          column={column}
          door={finish.color}
          carcass={finish.carcass}
          selected={column.id === selectedId}
          mark={marks.get(column.id) ?? null}
          onSelect={onSelect}
        />
      ))}
      {runs.map((run) => (
        <group key={`${run.x}-${run.width}`}>
          <Box x={run.x} y={top - project.wall.worktopThickness} z={0} width={run.width} height={project.wall.worktopThickness} depth={project.wall.baseDepth + project.rules.worktopOverhangMm} color={stone} />
          {project.wall.backsplashHeight > 0 && (
            <Box x={run.x} y={top} z={0} width={run.width} height={project.wall.backsplashHeight} depth={Math.max(12, project.rules.backsplashMm)} color="#f7f5f1" />
          )}
        </group>
      ))}
    </group>
  )
}

function Column({
  project,
  column,
  door,
  carcass,
  selected,
  mark,
  onSelect,
}: {
  project: KitchenProject
  column: PlacedColumn
  door: string
  carcass: string
  selected: boolean
  mark: 'refus' | 'attention' | null
  onSelect: (id: string) => void
}) {
  const { wall, rules } = project
  const pick = () => onSelect(column.id)
  if (column.kind === 'colonne') {
    const height = wall.ceilingHeight - rules.towerGapMm
    return (
      <group>
        <Box x={column.x} y={0} z={0} width={column.width} height={height} depth={wall.baseDepth} color={carcass} selected={selected} mark={mark} onClick={pick} />
        {column.tower === 'frigo'
          ? <Fridge x={column.x} y={wall.plinthHeight} z={wall.baseDepth} width={column.width} height={height - wall.plinthHeight} door={door} />
          : <Front x={column.x} y={wall.plinthHeight} z={wall.baseDepth} width={column.width} height={height - wall.plinthHeight} color={door} handle={column.handle} dark={project.finish === 'noir'} />}
      </group>
    )
  }

  const upper = column.upper === 'aucun' ? null : upperSpan(wall, rules, column.x, column.width)
  return (
    <group>
      {wall.plinthHeight > 0 && (
        <Box x={column.x + 18} y={0} z={18} width={column.width - 36} height={wall.plinthHeight - 4} depth={wall.baseDepth - 70} color="#2a2a28" />
      )}
      <Box x={column.x} y={wall.plinthHeight} z={0} width={column.width} height={wall.baseHeight} depth={wall.baseDepth} color={carcass} selected={selected} mark={mark} onClick={pick} />
      <BaseFront project={project} column={column} door={door} />
      {upper && column.upper === 'hotte' && (
        <Hood x={upper.x} y={upper.bottom} z={0} width={upper.width} depth={wall.upperDepth + 40} />
      )}
      {upper && column.upper !== 'hotte' && (
        <group>
          <Box x={upper.x} y={upper.bottom} z={0} width={upper.width} height={upper.top - upper.bottom} depth={wall.upperDepth} color={carcass} selected={selected} mark={mark} onClick={pick} />
          <Front
            x={upper.x}
            y={upper.bottom}
            z={wall.upperDepth}
            width={upper.width}
            height={upper.top - upper.bottom}
            color={column.upper === 'vitrine' ? '#d5e3ea' : door}
            handle={column.handle}
            dark={project.finish === 'noir'}
            glass={column.upper === 'micro-ondes'}
          />
        </group>
      )}
      {(column.base === 'plaque' || column.base === 'four-plaque') && (
        <Hob x={column.x} y={worktopTop(wall) + 3} z={wall.baseDepth * 0.22} width={column.width} />
      )}
      {column.base === 'evier' && (
        <Sink x={column.x} y={worktopTop(wall) - 6} z={wall.baseDepth * 0.28} width={column.width} />
      )}
    </group>
  )
}

function BaseFront({ project, column, door }: { project: KitchenProject; column: PlacedColumn; door: string }) {
  const { wall } = project
  const y = wall.plinthHeight
  const z = wall.baseDepth
  const dark = project.finish === 'noir'
  if (column.base === 'tiroirs') {
    const gap = 8
    const height = (wall.baseHeight - gap * 2) / 3
    return (
      <group>
        {[0, 1, 2].map((index) => (
          <Front key={index} x={column.x} y={y + index * (height + gap)} z={z} width={column.width} height={height} color={door} handle={column.handle} dark={dark} />
        ))}
      </group>
    )
  }
  if (column.base === 'four' || column.base === 'four-plaque') {
    return <Oven x={column.x} y={y} z={z} width={column.width} height={wall.baseHeight} />
  }
  if (column.base === 'lave-vaisselle') {
    return <Washer x={column.x} y={y} z={z} width={column.width} height={wall.baseHeight} />
  }
  return <Front x={column.x} y={y} z={z} width={column.width} height={wall.baseHeight} color={door} handle={column.handle} dark={dark} />
}

function Front({
  x, y, z, width, height, color, handle, dark, glass = false,
}: {
  x: number
  y: number
  z: number
  width: number
  height: number
  color: string
  handle: HandleId
  dark: boolean
  glass?: boolean
}) {
  const inset = 3
  return (
    <group>
      <mesh position={[x + width / 2, y + height / 2, z + 10]}>
        <boxGeometry args={[Math.max(8, width - inset * 2), Math.max(8, height - inset * 2), 18]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
      {glass && (
        <mesh position={[x + width / 2, y + height / 2, z + 20]}>
          <boxGeometry args={[width * 0.55, height * 0.42, 4]} />
          <meshStandardMaterial color="#1e2428" metalness={0.4} roughness={0.15} />
        </mesh>
      )}
      <HandleMark x={x + width / 2} y={y + height / 2} z={z + 22} width={width} handle={handle} dark={dark} />
    </group>
  )
}

function Oven({ x, y, z, width, height }: { x: number; y: number; z: number; width: number; height: number }) {
  const inset = 8
  return (
    <group>
      <mesh position={[x + width / 2, y + height / 2, z + 10]}>
        <boxGeometry args={[width - inset * 2, height - inset * 2, 18]} />
        <meshStandardMaterial color="#2c2c2a" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[x + width / 2, y + height * 0.58, z + 22]}>
        <boxGeometry args={[width * 0.62, height * 0.38, 6]} />
        <meshStandardMaterial color="#14181c" metalness={0.35} roughness={0.12} />
      </mesh>
      <mesh position={[x + width / 2, y + height * 0.28, z + 24]}>
        <boxGeometry args={[width * 0.46, 14, 10]} />
        <meshStandardMaterial color="#d5d5d2" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  )
}

function Washer({ x, y, z, width, height }: { x: number; y: number; z: number; width: number; height: number }) {
  return (
    <group>
      <mesh position={[x + width / 2, y + height / 2, z + 10]}>
        <boxGeometry args={[width - 8, height - 8, 18]} />
        <meshStandardMaterial color="#d7d8d6" metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[x + width / 2, y + height * 0.62, z + 22]}>
        <boxGeometry args={[width * 0.7, 8, 4]} />
        <meshStandardMaterial color="#8d8e8c" />
      </mesh>
      <mesh position={[x + width / 2, y + height * 0.42, z + 24]}>
        <boxGeometry args={[width * 0.42, 12, 8]} />
        <meshStandardMaterial color="#c8c8c6" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

function Fridge({ x, y, z, width, height, door }: { x: number; y: number; z: number; width: number; height: number; door: string }) {
  const split = height * 0.62
  return (
    <group>
      <Front x={x} y={y + split} z={z} width={width} height={height - split} color={door} handle="barre" dark={false} />
      <Front x={x} y={y} z={z} width={width} height={split - 6} color={door} handle="barre" dark={false} />
    </group>
  )
}

function Hood({ x, y, z, width, depth }: { x: number; y: number; z: number; width: number; depth: number }) {
  return (
    <mesh position={[x + width / 2, y + 180, z + depth / 2]}>
      <boxGeometry args={[width - 20, 280, depth]} />
      <meshStandardMaterial color="#cfd0ce" metalness={0.45} roughness={0.32} />
    </mesh>
  )
}

function Hob({ x, y, z, width }: { x: number; y: number; z: number; width: number }) {
  const glass = Math.min(560, width - 50)
  return (
    <group position={[x + width / 2, y, z + 220]}>
      <mesh>
        <boxGeometry args={[glass, 8, 480]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.18} />
      </mesh>
      {[[-glass * 0.22, -90], [glass * 0.22, -90], [-glass * 0.22, 90], [glass * 0.22, 90]].map(([cx, cz]) => (
        <mesh key={`${cx}-${cz}`} position={[cx, 6, cz]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[42, 4, 8, 20]} />
          <meshStandardMaterial color="#3a3a3a" />
        </mesh>
      ))}
    </group>
  )
}

function Sink({ x, y, z, width }: { x: number; y: number; z: number; width: number }) {
  const bowl = Math.min(520, width - 90)
  return (
    <group position={[x + width / 2, y, z + 180]}>
      <mesh>
        <boxGeometry args={[bowl + 28, 10, 360]} />
        <meshStandardMaterial color="#c5ccd0" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, -16, 0]}>
        <boxGeometry args={[bowl, 28, 300]} />
        <meshStandardMaterial color="#8ea0a6" metalness={0.4} roughness={0.22} />
      </mesh>
    </group>
  )
}

function HandleMark({ x, y, z, width, handle, dark }: { x: number; y: number; z: number; width: number; handle: HandleId; dark: boolean }) {
  const metal = dark ? '#d9d9d6' : '#4a4a48'
  if (handle === 'aucune') return null
  if (handle === 'integre') {
    return (
      <mesh position={[x, y + Math.min(70, width), z]}>
        <boxGeometry args={[Math.min(120, width - 36), 8, 6]} />
        <meshStandardMaterial color="#1c1c1c" />
      </mesh>
    )
  }
  if (handle === 'barre') {
    return (
      <mesh position={[x, y, z]}>
        <boxGeometry args={[Math.min(width - 70, 280), 10, 14]} />
        <meshStandardMaterial color={metal} metalness={0.65} roughness={0.28} />
      </mesh>
    )
  }
  return (
    <mesh position={[x + Math.min(70, width / 2 - 28), y, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[11, 11, 16, 16]} />
      <meshStandardMaterial color={metal} metalness={0.5} roughness={0.35} />
    </mesh>
  )
}

function Box({
  x, y, z, width, height, depth, color, onClick, selected = false, mark = null,
}: {
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  color: string
  onClick?: () => void
  selected?: boolean
  mark?: 'refus' | 'attention' | null
}) {
  return (
    <mesh
      position={[x + width / 2, y + height / 2, z + depth / 2]}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} roughness={0.78} />
      {selected && <Edges color="#1d4a42" threshold={15} />}
      {mark === 'refus' && <Edges color="#8d2f2a" threshold={15} />}
      {mark === 'attention' && <Edges color="#8a6a20" threshold={15} />}
    </mesh>
  )
}
