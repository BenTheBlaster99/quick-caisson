import { ContactShadows, Edges, OrbitControls, Text } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DoubleSide, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { cutRun, inspectKitchen, placeColumns, upperSpan, worktopRuns, worktopTop, type PlacedColumn } from '../../kitchen/layout'
import { kitchenFinish, wallFinish } from '../../kitchen/finishes'
import { mountRun, wallLength, builtWalls, WALL_THICK } from '../../kitchen/room'
import { wallPieces } from '../../kitchen/wall-pieces'
import { moveColumn, moveIsland } from '../../kitchen/project'
import type { HandleId, KitchenProject, Opening, WallId } from '../../kitchen/types'

type Rig = {
  target: { set: (x: number, y: number, z: number) => void }
  update: () => void
}

export type KitchenCamera = 'perspective' | 'fond' | 'gauche' | 'droit' | 'top'

function nearWall(mode: KitchenCamera): WallId | null {
  if (mode === 'perspective' || mode === 'fond') return 'D'
  if (mode === 'gauche') return 'C'
  if (mode === 'droit') return 'B'
  return null
}

export function KitchenScene({
  project,
  selectedId,
  frameToken,
  cameraMode,
  onSelect,
  onMoveColumn,
  onMoveOpening,
  onMoveIsland,
}: {
  project: KitchenProject
  selectedId: string
  frameToken: number
  cameraMode: KitchenCamera
  onSelect: (id: string) => void
  onMoveColumn: (id: string, x: number) => void
  onMoveOpening: (id: string, patch: { x: number; bottom: number }) => void
  onMoveIsland: (x: number, z: number) => void
}) {
  return (
    <Canvas camera={{ position: [2.2, 2.1, 6.4], fov: 46, near: 0.05, far: 80 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <World
        project={project}
        selectedId={selectedId}
        frameToken={frameToken}
        cameraMode={cameraMode}
        onSelect={onSelect}
        onMoveColumn={onMoveColumn}
        onMoveOpening={onMoveOpening}
        onMoveIsland={onMoveIsland}
      />
    </Canvas>
  )
}

function World({
  project,
  selectedId,
  frameToken,
  cameraMode,
  onSelect,
  onMoveColumn,
  onMoveOpening,
  onMoveIsland,
}: {
  project: KitchenProject
  selectedId: string
  frameToken: number
  cameraMode: KitchenCamera
  onSelect: (id: string) => void
  onMoveColumn: (id: string, x: number) => void
  onMoveOpening: (id: string, patch: { x: number; bottom: number }) => void
  onMoveIsland: (x: number, z: number) => void
}) {
  const [preview, setPreview] = useState<KitchenProject | null>(null)
  const [dragging, setDragging] = useState(false)
  const shown = preview ?? project
  const span = Math.max(shown.wall.width, shown.room.depth) / 1000
  const eye = worktopTop(shown.wall) / 1000
  const hidden = nearWall(cameraMode)
  const marks = new Map<string, 'refus' | 'attention'>()
  for (const issue of inspectKitchen(shown).issues) {
    if (!issue.columnId) continue
    const current = marks.get(issue.columnId)
    if (issue.level === 'refus' || current !== 'refus') marks.set(issue.columnId, issue.level)
  }

  return (
    <>
      <color attach="background" args={['#ece7df']} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[3.2, 5.4, 4]} intensity={1.45} />
      <directionalLight position={[-3, 2.2, -1]} intensity={0.22} />
      <DragBridge
        project={project}
        setPreview={setPreview}
        setDragging={setDragging}
        onMoveColumn={onMoveColumn}
        onMoveOpening={onMoveOpening}
        onMoveIsland={onMoveIsland}
      >
        <group scale={0.001} position={[-shown.wall.width / 2000, 0, -shown.room.depth / 2000]}>
          <Room project={shown} hidden={hidden} />
          <WallNames project={shown} />
          {shown.openings.filter((opening) => opening.wallId !== 'ilot' && opening.wallId !== 'D' && opening.wallId !== hidden && builtWalls(shown.room.shape, shown.room.lSide).includes(opening.wallId)).map((opening) => (
            <Mount key={opening.id} project={shown} wallId={opening.wallId} along={opening.x} size={opening.width}>
              <OpeningMark project={shown} opening={opening} />
            </Mount>
          ))}
          <KitchenFurniture project={shown} selectedId={selectedId} marks={marks} onSelect={onSelect} />
        </group>
      </DragBridge>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.32} scale={Math.max(6, span + 1.4)} blur={2.2} far={1.4} color="#3a342c" />
      <OrbitControls makeDefault enabled={!dragging} maxPolarAngle={cameraMode === 'top' ? Math.PI / 2.2 : Math.PI / 2.02} minDistance={1.4} maxDistance={32} />
      <CameraRig width={shown.wall.width} depth={shown.room.depth} eye={eye} token={frameToken} mode={cameraMode} />
    </>
  )
}

function CameraRig({ width, depth, eye, token, mode }: { width: number; depth: number; eye: number; token: number; mode: KitchenCamera }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as Rig | null
  const sizeRef = useRef({ width, depth, eye })
  sizeRef.current = { width, depth, eye }

  useEffect(() => {
    const w = sizeRef.current.width / 1000
    const d = sizeRef.current.depth / 1000
    const focusY = Math.max(1.05, sizeRef.current.eye + 0.25)
    const reach = Math.max(w, d) * 0.72 + 2.8
    const pose = mode === 'fond'
      ? { x: 0, y: focusY + 0.35, z: d / 2 + reach, tx: 0, ty: focusY, tz: -d * 0.08 }
      : mode === 'gauche'
        ? { x: w / 2 + reach, y: focusY + 0.45, z: d * 0.08, tx: -w * 0.08, ty: focusY, tz: 0 }
        : mode === 'droit'
          ? { x: -w / 2 - reach, y: focusY + 0.45, z: d * 0.08, tx: w * 0.08, ty: focusY, tz: 0 }
          : mode === 'top'
            ? { x: 0, y: Math.max(w, d) * 2.15 + 1.2, z: 0.04, tx: 0, ty: 0, tz: 0 }
            : { x: w * 0.42, y: focusY + 1.15, z: d / 2 + reach, tx: -w * 0.06, ty: focusY * 0.72, tz: -d * 0.12 }
    if (camera instanceof PerspectiveCamera) {
      camera.fov = mode === 'top' ? 38 : 46
      camera.updateProjectionMatrix()
    }
    camera.position.set(pose.x, pose.y, pose.z)
    camera.lookAt(pose.tx, pose.ty, pose.tz)
    if (controls) controls.target.set(pose.tx, pose.ty, pose.tz)
    controls?.update()
  }, [camera, controls, mode, token])

  return null
}

type DragSession =
  | { kind: 'column'; id: string; wallId: WallId; grab: number; origin: number }
  | { kind: 'opening'; id: string; wallId: WallId; grabAlong: number; grabY: number; originX: number; originBottom: number }
  | { kind: 'island'; grabX: number; grabZ: number; originX: number; originZ: number }

const DragContext = createContext<(drag: DragSession) => void>(() => {})

function DragBridge({
  project,
  setPreview,
  setDragging,
  onMoveColumn,
  onMoveOpening,
  onMoveIsland,
  children,
}: {
  project: KitchenProject
  setPreview: (project: KitchenProject | null) => void
  setDragging: (dragging: boolean) => void
  onMoveColumn: (id: string, x: number) => void
  onMoveOpening: (id: string, patch: { x: number; bottom: number }) => void
  onMoveIsland: (x: number, z: number) => void
  children: ReactNode
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null
  const drag = useRef<DragSession | null>(null)
  const base = useRef(project)
  const latest = useRef(project)
  const raycaster = useMemo(() => new Raycaster(), [])
  const pointer = useMemo(() => new Vector2(), [])
  const handlers = useRef({ onMoveColumn, onMoveOpening, onMoveIsland, setPreview, setDragging })
  handlers.current = { onMoveColumn, onMoveOpening, onMoveIsland, setPreview, setDragging }
  base.current = drag.current ? base.current : project

  function begin(session: DragSession) {
    drag.current = session
    base.current = project
    latest.current = project
    if (controls) controls.enabled = false
    setDragging(true)
  }

  useEffect(() => {
    const dom = gl.domElement
    function move(event: PointerEvent) {
      const session = drag.current
      if (!session) return
      const rect = dom.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const source = base.current
      const hit = new Vector3()
      const steep = Math.abs(raycaster.ray.direction.y) > 0.82
      const plane = session.kind === 'island' || steep
        ? new Plane(new Vector3(0, 1, 0), session.kind === 'island' ? -worktopTop(source.wall) / 1000 : 0)
        : wallPlane(session.kind === 'column' ? session.wallId : session.wallId, source.wall.width, source.room.depth)
      if (!raycaster.ray.intersectPlane(plane, hit)) return
      const room = roomOf(hit, source.wall.width, source.room.depth)
      let next = source
      if (session.kind === 'column') {
        const along = alongOf(session.wallId, room, source.room.islandX)
        next = moveColumn(source, session.id, along - session.grab)
      } else if (session.kind === 'opening') {
        const along = alongOf(session.wallId, room, source.room.islandX)
        next = slideOpening(source, session.id, along - session.grabAlong, room.y - session.grabY)
      } else {
        next = moveIsland(source, room.x - session.grabX, room.z - session.grabZ)
      }
      latest.current = next
      handlers.current.setPreview(next)
    }
    function up() {
      const session = drag.current
      if (!session) return
      drag.current = null
      if (controls) controls.enabled = true
      const next = latest.current
      handlers.current.setDragging(false)
      handlers.current.setPreview(null)
      if (session.kind === 'column') {
        const column = next.columns.find((item) => item.id === session.id)
        if (column && Math.abs(column.x - session.origin) >= 2) handlers.current.onMoveColumn(column.id, column.x)
      } else if (session.kind === 'opening') {
        const opening = next.openings.find((item) => item.id === session.id)
        if (opening && (Math.abs(opening.x - session.originX) >= 2 || Math.abs(opening.bottom - session.originBottom) >= 2)) {
          handlers.current.onMoveOpening(opening.id, { x: opening.x, bottom: opening.bottom })
        }
      } else if (Math.abs(next.room.islandX - session.originX) >= 2 || Math.abs(next.room.islandZ - session.originZ) >= 2) {
        handlers.current.onMoveIsland(next.room.islandX, next.room.islandZ)
      }
    }
    dom.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      dom.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [camera, controls, gl, pointer, raycaster])

  return <DragContext.Provider value={begin}>{children}</DragContext.Provider>
}

function roomOf(point: Vector3, width: number, depth: number) {
  return {
    x: (point.x + width / 2000) * 1000,
    y: point.y * 1000,
    z: (point.z + depth / 2000) * 1000,
  }
}

function alongOf(wallId: WallId, room: { x: number; z: number }, islandX: number) {
  if (wallId === 'B' || wallId === 'C') return room.z
  if (wallId === 'ilot') return room.x - islandX
  return room.x
}

function wallPlane(wallId: WallId, width: number, depth: number) {
  if (wallId === 'B') return new Plane(new Vector3(1, 0, 0), width / 2000)
  if (wallId === 'C') return new Plane(new Vector3(1, 0, 0), -width / 2000)
  if (wallId === 'D') return new Plane(new Vector3(0, 0, 1), -depth / 2000)
  return new Plane(new Vector3(0, 0, 1), depth / 2000)
}

function slideOpening(project: KitchenProject, id: string, x: number, bottom: number): KitchenProject {
  const opening = project.openings.find((item) => item.id === id)
  if (!opening) return project
  const length = wallLength(project, opening.wallId)
  const nextX = Math.round(Math.max(0, Math.min(x, length - opening.width)))
  const nextBottom = opening.kind === 'porte' ? 0 : Math.round(Math.max(0, Math.min(bottom, project.wall.ceilingHeight - opening.height)))
  return {
    ...project,
    openings: project.openings.map((item) => (item.id === id ? { ...item, x: nextX, bottom: nextBottom } : item)),
  }
}

function Mount({ project, wallId, along, size, children }: { project: KitchenProject; wallId: WallId; along: number; size: number; children: ReactNode }) {
  const mount = mountRun(project.room, project.wall.width, wallId, along, size)
  return <group position={[mount.x, 0, mount.z]} rotation={[0, mount.rot, 0]}>{children}</group>
}

function Room({ project, hidden }: { project: KitchenProject; hidden: WallId | null }) {
  const { width } = project.wall
  const depth = project.room.depth
  const thick = WALL_THICK
  const walls = builtWalls(project.room.shape, project.room.lSide).filter((wallId) => wallId !== hidden)
  const x0 = walls.includes('B') ? -thick : 0
  const x1 = walls.includes('C') ? width + thick : width
  const z0 = walls.includes('A') ? -thick : 0
  const z1 = walls.includes('D') ? depth + thick : depth
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, -10, (z0 + z1) / 2]} receiveShadow>
        <boxGeometry args={[x1 - x0, 20, z1 - z0]} />
        <meshStandardMaterial color="#e7e0d6" roughness={1} />
      </mesh>
      {walls.map((wallId) => (
        <WallShell key={wallId} project={project} wallId={wallId} />
      ))}
    </group>
  )
}

function WallShell({ project, wallId }: { project: KitchenProject; wallId: WallId }) {
  const length = wallLength(project, wallId)
  const ceiling = project.wall.ceilingHeight
  const holes = project.openings.filter((opening) => opening.wallId === wallId && opening.kind !== 'interdit')
  return (
    <group>
      {wallPieces(length, ceiling, holes).map((piece) => (
        <WallPiece key={`${piece.x}-${piece.y}-${piece.w}-${piece.h}`} project={project} wallId={wallId} piece={piece} />
      ))}
    </group>
  )
}

function WallPiece({
  project,
  wallId,
  piece,
}: {
  project: KitchenProject
  wallId: WallId
  piece: { x: number; y: number; w: number; h: number }
}) {
  const { width } = project.wall
  const depth = project.room.depth
  const thick = WALL_THICK
  const y = piece.y + piece.h / 2
  const paint = wallId === 'ilot' ? wallFinish('blanc') : wallFinish(project.room.finishes[wallId])
  const material = <meshStandardMaterial color={paint.color} roughness={paint.roughness} metalness={paint.metalness} />
  if (wallId === 'A') {
    return <mesh position={[piece.x + piece.w / 2, y, -thick / 2]}><boxGeometry args={[piece.w, piece.h, thick]} />{material}</mesh>
  }
  if (wallId === 'B') {
    return <mesh position={[-thick / 2, y, piece.x + piece.w / 2]}><boxGeometry args={[thick, piece.h, piece.w]} />{material}</mesh>
  }
  if (wallId === 'C') {
    return <mesh position={[width + thick / 2, y, piece.x + piece.w / 2]}><boxGeometry args={[thick, piece.h, piece.w]} />{material}</mesh>
  }
  return <mesh position={[piece.x + piece.w / 2, y, depth + thick / 2]}><boxGeometry args={[piece.w, piece.h, thick]} />{material}</mesh>
}

function OpeningMark({ project, opening }: { project: KitchenProject; opening: Opening }) {
  const begin = useContext(DragContext)
  const y = opening.bottom + opening.height / 2
  function down(event: { stopPropagation: () => void; point: Vector3 }) {
    event.stopPropagation()
    const room = roomOf(event.point, project.wall.width, project.room.depth)
    const along = alongOf(opening.wallId, room, project.room.islandX)
    begin({
      kind: 'opening',
      id: opening.id,
      wallId: opening.wallId,
      grabAlong: along - opening.x,
      grabY: room.y - y,
      originX: opening.x,
      originBottom: opening.bottom,
    })
  }
  if (opening.kind === 'interdit') {
    return (
      <mesh position={[opening.width / 2, y, 6]} onPointerDown={down}>
        <boxGeometry args={[opening.width, opening.height, 8]} />
        <meshStandardMaterial color="#e7b2ac" transparent opacity={0.45} />
      </mesh>
    )
  }
  if (opening.kind === 'porte') return <DoorLeaf opening={opening} onPointerDown={down} />
  return <WindowLeaf opening={opening} onPointerDown={down} />
}

function DoorLeaf({ opening, onPointerDown }: { opening: Opening; onPointerDown: (event: { stopPropagation: () => void; point: Vector3 }) => void }) {
  const leafW = Math.max(40, opening.width - 16)
  const leafH = Math.max(40, opening.height - 12)
  return (
    <group position={[0, 0, 8]} onPointerDown={onPointerDown}>
      <mesh position={[opening.width / 2, opening.height / 2, 0]}>
        <boxGeometry args={[opening.width + 24, 28, 70]} />
        <meshStandardMaterial color="#f3efe8" />
      </mesh>
      <mesh position={[10, opening.height / 2, 0]}>
        <boxGeometry args={[28, opening.height, 70]} />
        <meshStandardMaterial color="#f3efe8" />
      </mesh>
      <mesh position={[opening.width - 10, opening.height / 2, 0]}>
        <boxGeometry args={[28, opening.height, 70]} />
        <meshStandardMaterial color="#f3efe8" />
      </mesh>
      <group position={[opening.width / 2, 0, 0]} scale={[opening.swing === 'droite' ? -1 : 1, 1, 1]}>
      <group position={[14 - opening.width / 2, 0, 0]} rotation={[0, -0.42, 0]}>
        <mesh position={[leafW / 2, leafH / 2, 18]} onPointerDown={onPointerDown}>
          <boxGeometry args={[leafW, leafH, 36]} />
          <meshStandardMaterial color="#f7f4ee" roughness={0.55} />
        </mesh>
        <mesh position={[leafW / 2, leafH * 0.72, 40]}>
          <boxGeometry args={[leafW * 0.72, leafH * 0.36, 8]} />
          <meshStandardMaterial color="#efeae3" />
        </mesh>
        <mesh position={[leafW / 2, leafH * 0.28, 40]}>
          <boxGeometry args={[leafW * 0.72, leafH * 0.36, 8]} />
          <meshStandardMaterial color="#efeae3" />
        </mesh>
        <mesh position={[leafW - 70, leafH * 0.48, 62]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[14, 14, 28, 16]} />
          <meshStandardMaterial color="#c2b8a4" metalness={0.7} roughness={0.28} />
        </mesh>
      </group>
      </group>
    </group>
  )
}

function WindowLeaf({ opening, onPointerDown }: { opening: Opening; onPointerDown: (event: { stopPropagation: () => void; point: Vector3 }) => void }) {
  const y = opening.bottom + opening.height / 2
  const paneW = (opening.width - 70) / 2
  const paneH = opening.height - 56
  return (
    <group position={[opening.width / 2, y, 0]} onPointerDown={onPointerDown}>
      <FrameBar y={opening.height / 2 - 16} width={opening.width + 20} height={32} />
      <FrameBar y={-opening.height / 2 + 16} width={opening.width + 20} height={32} />
      <FrameBar y={0} width={32} height={opening.height} x={-opening.width / 2 + 16} />
      <FrameBar y={0} width={32} height={opening.height} x={opening.width / 2 - 16} />
      <mesh>
        <boxGeometry args={[18, opening.height - 48, 28]} />
        <meshStandardMaterial color="#1c1c1c" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (paneW / 2 + 10), 0, 0]}>
          <planeGeometry args={[Math.max(20, paneW), Math.max(20, paneH)]} />
          <meshStandardMaterial color="#c5d8e6" roughness={0.08} metalness={0.12} transparent opacity={0.72} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, -opening.height / 2 - 10, 36]} onPointerDown={onPointerDown}>
        <boxGeometry args={[opening.width + 80, 28, 90]} />
        <meshStandardMaterial color="#1c1c1c" />
      </mesh>
    </group>
  )
}

function FrameBar({ x = 0, y, width, height }: { x?: number; y: number; width: number; height: number }) {
  return (
    <mesh position={[x, y, 10]}>
      <boxGeometry args={[width, height, 14]} />
      <meshStandardMaterial color="#1c1c1c" />
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
  const live = project.columns.filter((column) => column.wallId !== 'ilot' || project.room.island)
  const placed = placeColumns(live)
  const top = worktopTop(project.wall)
  const runs = worktopRuns(live)
  const stone = project.finish === 'noir' ? '#d4cfc6' : '#e7e2d8'
  const begin = useContext(DragContext)

  function grabColumn(column: PlacedColumn, point: Vector3) {
    const room = roomOf(point, project.wall.width, project.room.depth)
    const along = alongOf(column.wallId, room, project.room.islandX)
    begin({ kind: 'column', id: column.id, wallId: column.wallId, grab: along - column.x, origin: column.x })
  }

  function grabIsland(point: Vector3) {
    const room = roomOf(point, project.wall.width, project.room.depth)
    begin({
      kind: 'island',
      grabX: room.x - project.room.islandX,
      grabZ: room.z - project.room.islandZ,
      originX: project.room.islandX,
      originZ: project.room.islandZ,
    })
  }

  return (
    <group>
      {placed.map((column) => (
        <Mount key={column.id} project={project} wallId={column.wallId} along={column.x} size={column.width}>
          <Column
            project={project}
            column={{ ...column, x: 0 }}
            door={finish.color}
            carcass={finish.carcass}
            selected={column.id === selectedId}
            mark={marks.get(column.id) ?? null}
            onSelect={onSelect}
            onGrab={(point) => grabColumn(column, point)}
          />
        </Mount>
      ))}
      {runs.map((run) => {
        const depth = run.wallId === 'ilot' ? project.room.islandDepth : project.wall.baseDepth + project.rules.worktopOverhangMm
        return (
          <Mount key={`${run.wallId}-${run.x}`} project={project} wallId={run.wallId} along={run.x} size={run.width}>
            <Box
              x={0}
              y={top - project.wall.worktopThickness}
              z={0}
              width={run.width}
              height={project.wall.worktopThickness}
              depth={depth}
              color={stone}
              onGrab={run.wallId === 'ilot' ? grabIsland : undefined}
            />
            {run.wallId !== 'ilot' && project.wall.backsplashHeight > 0 && cutRun(run.x, run.width, project.openings
              .filter((opening) => opening.wallId === run.wallId && opening.kind === 'fenetre' && opening.bottom < top + project.wall.backsplashHeight && opening.bottom + opening.height > top)
              .map((opening) => ({ x: opening.x, width: opening.width })))
              .map((part) => (
                <Box key={`${part.x}-${part.width}`} x={part.x - run.x} y={top} z={0} width={part.width} height={project.wall.backsplashHeight} depth={Math.max(12, project.rules.backsplashMm)} color="#f7f5f1" />
              ))}
            {project.wall.plinthHeight > 0 && (
              <Box
                x={0}
                y={0}
                z={0}
                width={run.width}
                height={Math.max(4, project.wall.plinthHeight - 4)}
                depth={(run.wallId === 'ilot' ? project.room.islandDepth : project.wall.baseDepth) - 40}
                color="#2a2a28"
              />
            )}
          </Mount>
        )
      })}
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
  onGrab,
}: {
  project: KitchenProject
  column: PlacedColumn
  door: string
  carcass: string
  selected: boolean
  mark: 'refus' | 'attention' | null
  onSelect: (id: string) => void
  onGrab: (point: Vector3) => void
}) {
  const { wall, rules } = project
  const boxDepth = column.wallId === 'ilot' ? project.room.islandDepth : wall.baseDepth
  const pick = () => onSelect(column.id)
  const grab = (point: Vector3) => onGrab(point)
  if (column.kind === 'colonne') {
    const height = wall.ceilingHeight - rules.towerGapMm
    return (
      <group>
        <Box x={column.x} y={0} z={0} width={column.width} height={height} depth={boxDepth} color={carcass} selected={selected} mark={mark} onClick={pick} onGrab={grab} />
        {column.tower === 'frigo'
          ? <Fridge x={column.x} y={wall.plinthHeight} z={boxDepth} width={column.width} height={height - wall.plinthHeight} door={door} onGrab={grab} />
          : <Front x={column.x} y={wall.plinthHeight} z={boxDepth} width={column.width} height={height - wall.plinthHeight} color={door} handle={column.handle} dark={project.finish === 'noir'} onGrab={grab} />}
      </group>
    )
  }

  if (column.kind === 'angle') {
    return <AngleCabinet project={project} column={column} door={door} carcass={carcass} selected={selected} mark={mark} onSelect={pick} onGrab={grab} />
  }

  const upper = column.upper === 'aucun' ? null : upperSpan(wall, rules, column.x, column.width)
  return (
    <group>
      <Box x={column.x} y={wall.plinthHeight} z={0} width={column.width} height={wall.baseHeight} depth={boxDepth} color={carcass} selected={selected} mark={mark} onClick={pick} onGrab={grab} />
      <BaseFront project={project} column={column} door={door} onGrab={grab} />
      {upper && column.upper === 'hotte' && (
        <Hood x={upper.x} y={upper.bottom} z={0} width={upper.width} depth={wall.upperDepth + 40} />
      )}
      {upper && column.upper !== 'hotte' && (
        <group>
          <Box x={upper.x} y={upper.bottom} z={0} width={upper.width} height={upper.top - upper.bottom} depth={wall.upperDepth} color={carcass} selected={selected} mark={mark} onClick={pick} onGrab={grab} />
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
            onGrab={grab}
          />
        </group>
      )}
      {column.deck === 'plaque' && (
        <Hob x={column.x} y={worktopTop(wall) + 3} z={boxDepth * 0.22} width={column.width} />
      )}
      {column.deck === 'evier' && (
        <Sink x={column.x} y={worktopTop(wall) - 6} z={boxDepth * 0.28} width={column.width} />
      )}
    </group>
  )
}

function WallNames({ project }: { project: KitchenProject }) {
  const walls = builtWalls(project.room.shape, project.room.lSide)
  const { width } = project.wall
  const depth = project.room.depth
  return (
    <group>
      {walls.includes('A') && (
        <Text position={[width / 2, 1500, 70]} fontSize={120} color="#3a342c" anchorX="center" anchorY="middle">
          Mur du fond
        </Text>
      )}
      {walls.includes('B') && (
        <Text position={[70, 1500, depth / 2]} rotation={[0, Math.PI / 2, 0]} fontSize={120} color="#3a342c" anchorX="center" anchorY="middle">
          Mur gauche
        </Text>
      )}
      {walls.includes('C') && (
        <Text position={[width - 70, 1500, depth / 2]} rotation={[0, -Math.PI / 2, 0]} fontSize={120} color="#3a342c" anchorX="center" anchorY="middle">
          Mur droit
        </Text>
      )}
    </group>
  )
}

function AngleCabinet({
  project, column, door, carcass, selected, mark, onSelect, onGrab,
}: {
  project: KitchenProject
  column: PlacedColumn
  door: string
  carcass: string
  selected: boolean
  mark: 'refus' | 'attention' | null
  onSelect: () => void
  onGrab: (point: Vector3) => void
}) {
  const { wall } = project
  const depth = wall.baseDepth
  const width = column.width
  const right = column.returnWall === 'C'
  const returnX = right ? width - depth : 0
  const faceX = right ? 0 : depth
  const faceW = Math.max(80, width - depth)
  return (
    <group>
      <Box x={0} y={wall.plinthHeight} z={0} width={width} height={wall.baseHeight} depth={depth} color={carcass} selected={selected} mark={mark} onClick={onSelect} onGrab={onGrab} />
      <Box x={returnX} y={wall.plinthHeight} z={0} width={depth} height={wall.baseHeight} depth={width} color={carcass} onClick={onSelect} onGrab={onGrab} />
      <Front x={faceX} y={wall.plinthHeight} z={depth} width={faceW} height={wall.baseHeight} color={door} handle={column.handle} dark={project.finish === 'noir'} onGrab={onGrab} />
      {wall.plinthHeight > 0 && (
        <Box x={returnX} y={0} z={depth} width={depth} height={Math.max(4, wall.plinthHeight - 4)} depth={Math.max(40, width - depth)} color="#2a2a28" />
      )}
    </group>
  )
}

function BaseFront({ project, column, door, onGrab }: { project: KitchenProject; column: PlacedColumn; door: string; onGrab?: (point: Vector3) => void }) {
  const { wall } = project
  const y = wall.plinthHeight
  const z = column.wallId === 'ilot' ? project.room.islandDepth : wall.baseDepth
  const dark = project.finish === 'noir'
  if (column.base === 'tiroirs') {
    const gap = 8
    const height = (wall.baseHeight - gap * 2) / 3
    return (
      <group>
        {[0, 1, 2].map((index) => (
          <Front key={index} x={column.x} y={y + index * (height + gap)} z={z} width={column.width} height={height} color={door} handle={column.handle} dark={dark} onGrab={onGrab} />
        ))}
      </group>
    )
  }
  if (column.base === 'four') {
    return <Oven x={column.x} y={y} z={z} width={column.width} height={wall.baseHeight} />
  }
  if (column.base === 'lave-vaisselle') {
    return <Washer x={column.x} y={y} z={z} width={column.width} height={wall.baseHeight} />
  }
  return <Front x={column.x} y={y} z={z} width={column.width} height={wall.baseHeight} color={door} handle={column.handle} dark={dark} onGrab={onGrab} />
}

function Front({
  x, y, z, width, height, color, handle, dark, glass = false, onGrab,
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
  onGrab?: (point: Vector3) => void
}) {
  const inset = 3
  return (
    <group>
      <mesh
        position={[x + width / 2, y + height / 2, z + 10]}
        onPointerDown={(event) => {
          event.stopPropagation()
          onGrab?.(event.point)
        }}
      >
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

function Fridge({ x, y, z, width, height, door, onGrab }: { x: number; y: number; z: number; width: number; height: number; door: string; onGrab?: (point: Vector3) => void }) {
  const split = height * 0.36
  const body = '#e6e7e4'
  const grip = door === '#1c1c1c' ? '#d5d5d2' : '#3c3c3a'
  function down(event: { stopPropagation: () => void; point: Vector3 }) {
    event.stopPropagation()
    onGrab?.(event.point)
  }
  return (
    <group>
      <mesh position={[x + width / 2, y + height / 2, z + 8]} onPointerDown={down}>
        <boxGeometry args={[width - 10, height - 8, 24]} />
        <meshStandardMaterial color={body} metalness={0.35} roughness={0.32} />
      </mesh>
      <mesh position={[x + width / 2, y + height - split / 2 - 6, z + 22]} onPointerDown={down}>
        <boxGeometry args={[width - 28, split - 16, 8]} />
        <meshStandardMaterial color={door} roughness={0.4} metalness={0.08} />
      </mesh>
      <mesh position={[x + width / 2, y + (height - split) / 2, z + 22]} onPointerDown={down}>
        <boxGeometry args={[width - 28, height - split - 28, 8]} />
        <meshStandardMaterial color={door} roughness={0.4} metalness={0.08} />
      </mesh>
      <mesh position={[x + width - 42, y + height - split / 2 - 6, z + 36]}>
        <boxGeometry args={[14, split * 0.55, 16]} />
        <meshStandardMaterial color={grip} metalness={0.72} roughness={0.22} />
      </mesh>
      <mesh position={[x + width - 42, y + (height - split) * 0.55, z + 36]}>
        <boxGeometry args={[14, Math.min(280, (height - split) * 0.35), 16]} />
        <meshStandardMaterial color={grip} metalness={0.72} roughness={0.22} />
      </mesh>
      <mesh position={[x + width / 2, y + 18, z + 24]}>
        <boxGeometry args={[width * 0.72, 16, 6]} />
        <meshStandardMaterial color="#2a2a28" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[x + 16, y + height / 2, z + 28]}>
        <boxGeometry args={[4, height - 36, 2]} />
        <meshStandardMaterial color="#b7b8b4" />
      </mesh>
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
  x, y, z, width, height, depth, color, onClick, onGrab, selected = false, mark = null,
}: {
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  color: string
  onClick?: () => void
  onGrab?: (point: Vector3) => void
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
      onPointerDown={(event) => {
        if (!onGrab) return
        event.stopPropagation()
        onGrab(event.point)
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
