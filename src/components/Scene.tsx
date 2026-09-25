import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { doorCountForCaisson, layoutCaisson, usableHeight } from '../domain/layout'
import { BACK, PANEL, RAIL_DIAMETER, doorFinishById, finishById, splitEven } from '../domain/rules'
import type { CaissonLayout } from '../domain/layout'
import type { Caisson, FinishId, Project } from '../domain/types'

type Rig = {
  target: { set: (x: number, y: number, z: number) => void }
  update: () => void
}

export type SceneView = 'envelope' | 'boxes' | 'interior' | 'facade'

export type PartPick = {
  caissonIndex: number
  role: string
  length: number | null
  width: number | null
}

export function Scene({
  project,
  selectedId,
  doorsOpen,
  frameToken,
  view,
  onSelect,
  highlight = null,
}: {
  project: Project
  selectedId: string
  doorsOpen: boolean
  frameToken: number
  view: SceneView
  onSelect: (id: string) => void
  highlight?: PartPick | null
}) {
  const focusY = (project.wall.socle + usableHeight(project.wall) / 2) / 1000
  const span = project.wall.width / 1000

  return (
    <Canvas camera={{ position: [1.2, 1.4, 3.4], fov: 40 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <color attach="background" args={['#d9d3c6']} />
      <ambientLight intensity={0.74} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} />
      <directionalLight position={[-4, 2, -2]} intensity={0.28} />
      <group scale={0.001} position={[-project.wall.width / 2000, 0, 0]}>
        <Room project={project} />
        <Furniture project={project} selectedId={selectedId} doorsOpen={doorsOpen} view={view} onSelect={onSelect} highlight={highlight} />
      </group>
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.04} minDistance={0.7} maxDistance={16} />
      <CameraRig span={span} focusY={focusY} token={frameToken} />
    </Canvas>
  )
}

function CameraRig({ span, focusY, token }: { span: number; focusY: number; token: number }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as Rig | null
  const spanRef = useRef(span)
  const focusRef = useRef(focusY)
  spanRef.current = span
  focusRef.current = focusY

  useEffect(() => {
    const width = spanRef.current
    const targetY = focusRef.current
    if (controls) controls.target.set(0, targetY, 0)
    camera.position.set(width * 0.28, targetY + 0.2, Math.max(2.5, width * 1.15))
    camera.lookAt(0, targetY, 0)
    controls?.update()
  }, [camera, controls, token])

  return null
}

function Room({ project }: { project: Project }) {
  const { width, height, depth } = project.wall
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, depth / 2]}>
        <planeGeometry args={[9000, 6000]} />
        <meshStandardMaterial color="#cfc6b8" roughness={1} />
      </mesh>
      <mesh position={[width / 2, height / 2, -20]}>
        <boxGeometry args={[width + 700, height + 240, 30]} />
        <meshStandardMaterial color="#c9c1b3" roughness={1} />
      </mesh>
    </group>
  )
}

function Furniture({
  project,
  selectedId,
  doorsOpen,
  view,
  onSelect,
  highlight,
}: {
  project: Project
  selectedId: string
  doorsOpen: boolean
  view: SceneView
  onSelect: (id: string) => void
  highlight: PartPick | null
}) {
  const color = finishById(project.finish).color
  const finish = project.finish
  let cursor = 0
  const showContents = view === 'interior' || view === 'facade'
  const showDoors = view === 'facade'
  const focus = view === 'boxes' || view === 'interior'

  return (
    <group>
      <Plinth project={project} color={color} highlight={highlight} />
      {view === 'envelope' ? (
        <Envelope project={project} color={color} finish={finish} />
      ) : (
        project.caissons.map((caisson, index) => {
          const x = cursor
          cursor += caisson.width
          return (
            <CaissonMesh
              key={caisson.id}
              caisson={caisson}
              index={index}
              x={x}
              wall={project.wall}
              color={color}
              finish={finish}
              doorsOpen={doorsOpen}
              showContents={showContents}
              showDoors={showDoors}
              focus={focus && !highlight}
              selected={caisson.id === selectedId}
              highlight={highlight}
              onSelect={() => onSelect(caisson.id)}
            />
          )
        })
      )}
    </group>
  )
}

function Envelope({ project, color, finish }: { project: Project; color: string; finish: FinishId }) {
  const height = usableHeight(project.wall)
  const { width, depth, socle } = project.wall
  const inner = width - 2 * PANEL
  const interior = height - 2 * PANEL
  return (
    <group position={[0, socle, 0]}>
      <Panel position={[PANEL / 2, height / 2, depth / 2]} size={[PANEL, height, depth]} color={color} />
      <Panel position={[width - PANEL / 2, height / 2, depth / 2]} size={[PANEL, height, depth]} color={color} />
      <Panel position={[PANEL + inner / 2, PANEL / 2, depth / 2]} size={[inner, PANEL, depth]} color={color} />
      <Panel position={[PANEL + inner / 2, height - PANEL / 2, depth / 2]} size={[inner, PANEL, depth]} color={color} />
      <Panel position={[PANEL + inner / 2, PANEL + interior / 2, BACK / 2]} size={[inner, interior, BACK]} color={backColor(finish)} />
    </group>
  )
}

function Plinth({ project, color, highlight }: { project: Project; color: string; highlight: PartPick | null }) {
  const socle = project.wall.socle
  if (socle <= 0) return null
  const { width, depth } = project.wall
  const returnDepth = depth - PANEL
  return (
    <group>
      <Panel position={[width / 2, socle / 2, depth - PANEL / 2]} size={[width, socle, PANEL]} color={color} tone={pieceTone(highlight, 1000, 'socle avant', width, socle)} />
      <Panel position={[PANEL / 2, socle / 2, returnDepth / 2]} size={[PANEL, socle, returnDepth]} color={color} tone={pieceTone(highlight, 1000, 'retour socle', returnDepth, socle)} />
      <Panel position={[width - PANEL / 2, socle / 2, returnDepth / 2]} size={[PANEL, socle, returnDepth]} color={color} tone={pieceTone(highlight, 1000, 'retour socle', returnDepth, socle)} />
    </group>
  )
}

function CaissonMesh({
  caisson,
  index,
  x,
  wall,
  color,
  finish,
  doorsOpen,
  showContents,
  showDoors,
  focus,
  selected,
  highlight,
  onSelect,
}: {
  caisson: Caisson
  index: number
  x: number
  wall: Project['wall']
  color: string
  finish: FinishId
  doorsOpen: boolean
  showContents: boolean
  showDoors: boolean
  focus: boolean
  selected: boolean
  highlight: PartPick | null
  onSelect: () => void
}) {
  const layout = layoutCaisson(wall, caisson)
  const depth = wall.depth
  const socle = wall.socle
  const boxHeight = layout.boxHeight
  const inner = caisson.width - 2 * PANEL
  const tone = (role: string, along: number, across: number) => pieceTone(highlight, index, role, along, across)

  return (
    <group position={[x, socle, 0]}>
      <Panel position={[PANEL / 2, boxHeight / 2, depth / 2]} size={[PANEL, boxHeight, depth]} color={color} selected={selected} focus={focus} tone={tone('joue', boxHeight, depth)} />
      <Panel position={[caisson.width - PANEL / 2, boxHeight / 2, depth / 2]} size={[PANEL, boxHeight, depth]} color={color} selected={selected} focus={focus} tone={tone('joue', boxHeight, depth)} />
      <Panel position={[PANEL + inner / 2, PANEL / 2, depth / 2]} size={[inner, PANEL, depth]} color={color} selected={selected} focus={focus} tone={tone('dessous', inner, depth)} />
      <Panel position={[PANEL + inner / 2, boxHeight - PANEL / 2, depth / 2]} size={[inner, PANEL, depth]} color={color} selected={selected} focus={focus} tone={tone('dessus', inner, depth)} />
      <Panel
        position={[PANEL + inner / 2, PANEL + layout.interiorHeight / 2, BACK / 2]}
        size={[inner, layout.interiorHeight, BACK]}
        color={backColor(finish)}
        tone={tone('fond rapporté', layout.interiorHeight, inner)}
      />
      {focus && selected && (
        <mesh position={[caisson.width / 2, boxHeight / 2, depth / 2]}>
          <boxGeometry args={[caisson.width + 16, boxHeight + 16, depth + 16]} />
          <meshBasicMaterial color="#1d4a42" wireframe />
        </mesh>
      )}
      {showContents && layout.shelves.map((shelf, shelfIndex) => (
        <Panel
          key={`${caisson.id}-shelf-${shelfIndex}`}
          position={[PANEL + inner / 2, (shelf.bottom + shelf.top) / 2, BACK + layout.shelfDepth / 2]}
          size={[inner, PANEL, layout.shelfDepth]}
          color={color}
          tone={tone('étagère', inner, layout.shelfDepth)}
        />
      ))}
      {showContents && layout.closingShelf && (
        <Panel
          position={[PANEL + inner / 2, (layout.closingShelf.bottom + layout.closingShelf.top) / 2, BACK + layout.shelfDepth / 2]}
          size={[inner, PANEL, layout.shelfDepth]}
          color={color}
          tone={tone('dessus tiroirs', inner, layout.shelfDepth)}
        />
      )}
      {showContents && layout.rails.map((rail) => (
        <mesh key={rail.kind} position={[PANEL + inner / 2, rail.axis, depth * 0.58]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[RAIL_DIAMETER / 2, RAIL_DIAMETER / 2, inner, 20]} />
          <meshStandardMaterial {...metalLook(pieceTone(highlight, index, 'tringle', inner, inner))} />
        </mesh>
      ))}
      {showContents && <Drawers layout={layout} width={caisson.width} depth={depth} color={color} tone={(role, along, across) => tone(role, along, across)} />}
      {showDoors && caisson.door !== 'aucune' && (
        <HingedDoors
          width={caisson.width}
          height={boxHeight}
          depth={depth}
          color={doorFinishById(caisson.doorFinish).color}
          glass={caisson.door === 'vitree' || caisson.doorFinish === 'verre'}
          open={doorsOpen}
          caissonIndex={index}
          highlight={highlight}
        />
      )}
      <mesh position={[caisson.width / 2, boxHeight / 2, depth + 40]} onClick={(event) => { event.stopPropagation(); onSelect() }}>
        <planeGeometry args={[caisson.width, boxHeight]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Drawers({
  layout,
  width,
  depth,
  color,
  tone,
}: {
  layout: CaissonLayout
  width: number
  depth: number
  color: string
  tone: (role: string, along: number, across: number) => PanelTone
}) {
  const inner = layout.interiorWidth
  const board = layout.drawerThickness
  const boxWidth = inner - 2 * board
  const boxDepth = layout.drawerDepth
  const leftX = PANEL + board / 2
  const rightX = width - PANEL - board / 2
  const sideZ = depth - board - boxDepth / 2
  return (
    <group>
      {layout.drawers.map((drawer, index) => {
        const boxBottom = drawer.bottom + (drawer.height - drawer.boxHeight) / 2
        const boxMidY = boxBottom + drawer.boxHeight / 2
        const frontZ = depth - board - board / 2
        const backZ = depth - board - boxDepth + board / 2
        const showBox = tone('côté tiroir', boxDepth, drawer.boxHeight) === 'hot'
          || tone('devant tiroir', boxWidth, drawer.boxHeight) === 'hot'
          || tone('derrière tiroir', boxWidth, drawer.boxHeight) === 'hot'
          || tone('fond tiroir', boxWidth, boxDepth - 2 * board) === 'hot'
        return (
          <group key={index}>
            <Panel
              position={[PANEL + inner / 2, drawer.bottom + drawer.height / 2, depth - board / 2]}
              size={[inner - 2, Math.max(8, drawer.height - 2), board]}
              color={color}
              tone={tone('façade tiroir', inner, drawer.height)}
            />
            {showBox && (
              <group>
                <Panel position={[leftX, boxMidY, sideZ]} size={[board, drawer.boxHeight, boxDepth]} color={color} tone={tone('côté tiroir', boxDepth, drawer.boxHeight)} />
                <Panel position={[rightX, boxMidY, sideZ]} size={[board, drawer.boxHeight, boxDepth]} color={color} tone={tone('côté tiroir', boxDepth, drawer.boxHeight)} />
                <Panel position={[width / 2, boxMidY, frontZ]} size={[boxWidth, drawer.boxHeight, board]} color={color} tone={tone('devant tiroir', boxWidth, drawer.boxHeight)} />
                <Panel position={[width / 2, boxMidY, backZ]} size={[boxWidth, drawer.boxHeight, board]} color={color} tone={tone('derrière tiroir', boxWidth, drawer.boxHeight)} />
                <Panel
                  position={[width / 2, boxBottom + BACK / 2, sideZ]}
                  size={[boxWidth, BACK, Math.max(8, boxDepth - 2 * board)]}
                  color={color}
                  tone={tone('fond tiroir', boxWidth, boxDepth - 2 * board)}
                />
              </group>
            )}
          </group>
        )
      })}
    </group>
  )
}

function HingedDoors({
  width,
  height,
  depth,
  color,
  glass,
  open,
  caissonIndex,
  highlight,
}: {
  width: number
  height: number
  depth: number
  color: string
  glass: boolean
  open: boolean
  caissonIndex: number
  highlight: PartPick | null
}) {
  const count = doorCountForCaisson(width)
  const widths = splitEven(width, count)
  let cursor = 0
  return (
    <group>
      {widths.map((doorWidth, index) => {
        const hingeLeft = index === 0
        const hingeX = hingeLeft ? cursor : cursor + doorWidth
        const angle = open ? (hingeLeft ? -1.15 : 1.15) : 0
        const node = (
          <group key={`${hingeX}-${doorWidth}`} position={[hingeX, height / 2, depth + 1]} rotation={[0, angle, 0]}>
            <Panel
              position={[hingeLeft ? doorWidth / 2 : -doorWidth / 2, 0, PANEL / 2]}
              size={[Math.max(8, doorWidth - 2), height - 2, PANEL]}
              color={color}
              glass={glass}
              tone={pieceTone(highlight, caissonIndex, 'porte', height, doorWidth)}
            />
          </group>
        )
        cursor += doorWidth
        return node
      })}
    </group>
  )
}

type PanelTone = 'plain' | 'hot' | 'dim'

function pieceTone(pick: PartPick | null, caissonIndex: number, role: string, along: number, across: number): PanelTone {
  if (!pick) return 'plain'
  if (pick.caissonIndex !== caissonIndex || pick.role !== role) return 'dim'
  if (pick.width == null) return pick.length === along || pick.length === across ? 'hot' : 'dim'
  if (pick.length == null) return 'hot'
  const long = Math.max(along, across)
  const short = Math.min(along, across)
  return pick.length === long && pick.width === short ? 'hot' : 'dim'
}

function metalLook(tone: PanelTone) {
  return {
    color: tone === 'hot' ? '#e7fff6' : '#c5c9ce',
    metalness: 0.72,
    roughness: 0.28,
    transparent: tone === 'dim',
    opacity: tone === 'dim' ? 0.16 : 1,
    emissive: tone === 'hot' ? '#1d4a42' : '#000000',
    emissiveIntensity: tone === 'hot' ? 0.45 : 0,
  }
}

function Panel({
  position,
  size,
  color,
  selected = false,
  focus = false,
  tone = 'plain',
  glass = false,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  selected?: boolean
  focus?: boolean
  tone?: PanelTone
  glass?: boolean
}) {
  const hot = tone === 'hot' || (tone === 'plain' && selected)
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={tone === 'hot' ? '#f4fff9' : color}
        roughness={glass ? 0.08 : 0.62}
        metalness={glass ? 0.05 : 0.02}
        transparent={glass || tone === 'dim'}
        opacity={tone === 'dim' ? 0.14 : glass ? 0.38 : 1}
        emissive={hot ? '#1d4a42' : '#000000'}
        emissiveIntensity={tone === 'hot' ? 0.62 : hot ? (focus ? 0.5 : 0.22) : 0}
      />
    </mesh>
  )
}

function backColor(finish: FinishId): string {
  if (finish === 'blanc') return '#e6e0d4'
  if (finish === 'anthracite') return '#2c3033'
  return '#b59258'
}
