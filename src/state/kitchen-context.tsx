import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { recordChange, redoChange, undoChange } from '../domain/history'
import { createId } from '../domain/project'
import { addKitchenColumn, canCorrectIssue, inspectKitchen, removeKitchenColumn, setColumnWidth, swapColumn, type KitchenAdd } from '../kitchen/layout'
import {
  addOpening,
  defaultKitchen,
  moveColumn,
  moveIsland,
  parseKitchen,
  removeOpening,
  serializeKitchen,
  setIsland,
  setKitchenWall,
  setLSide,
  setRoomDepth,
  setShape,
  setWallFinish,
  updateOpening,
} from '../kitchen/project'
import type { BaseRole, DeckRole, HandleId, KitchenColumn, KitchenFinishId, KitchenProject, KitchenShape, KitchenWall, LSide, Opening, OpeningKind, TowerRole, UpperRole, WallFinishId, WallId } from '../kitchen/types'

type Snap = { project: KitchenProject; selectedId: string }

type KitchenApi = {
  project: KitchenProject
  selected: KitchenColumn
  notice: string | null
  issues: ReturnType<typeof inspectKitchen>['issues']
  canUndo: boolean
  canRedo: boolean
  setWall: (field: keyof KitchenWall, value: number) => boolean
  setDepth: (depth: number) => boolean
  setShape: (shape: KitchenShape) => void
  setLSide: (side: LSide) => void
  setIsland: (island: boolean) => void
  setWidth: (width: number) => boolean
  setLocked: (locked: boolean) => void
  setKind: (kind: KitchenColumn['kind']) => void
  setBase: (base: BaseRole) => void
  setDeck: (deck: DeckRole) => void
  setTower: (tower: TowerRole) => void
  setUpper: (upper: UpperRole) => void
  setHandle: (handle: HandleId) => void
  setFinish: (finish: KitchenFinishId) => void
  setWallFinish: (wallId: 'A' | 'B' | 'C' | 'D', finish: WallFinishId) => void
  setName: (name: string) => void
  correct: (columnId: string) => void
  add: (wallId: WallId, spec: KitchenAdd) => void
  swap: (direction: -1 | 1) => void
  remove: () => void
  select: (id: string) => void
  placeColumn: (id: string, x: number) => void
  placeOpening: (id: string, patch: { x: number; bottom: number }) => void
  placeIsland: (x: number, z: number) => void
  addZone: (kind: OpeningKind, wallId?: WallId) => void
  setZone: (id: string, patch: Partial<Pick<Opening, 'x' | 'width' | 'bottom' | 'height' | 'swing'>>) => boolean
  removeZone: (id: string) => void
  undo: () => void
  redo: () => void
  save: () => void
  openText: (text: string) => void
  replace: (next: KitchenProject) => void
}

const KitchenContext = createContext<KitchenApi | null>(null)

export function KitchenProvider({ children }: { children: ReactNode }) {
  const initial = defaultKitchen()
  const [project, setProject] = useState(initial)
  const [selectedId, setSelectedId] = useState(initial.columns[0].id)
  const [notice, setNotice] = useState<string | null>(null)
  const [historyMark, setHistoryMark] = useState(0)
  const past = useRef<Snap[]>([])
  const future = useRef<Snap[]>([])
  const selected = project.columns.find((column) => column.id === selectedId) ?? project.columns[0]
  const issues = inspectKitchen(project).issues

  function bump() {
    setHistoryMark((mark) => mark + 1)
  }

  function remember() {
    past.current = recordChange(past.current, { project, selectedId })
    future.current = []
    bump()
  }

  function undo() {
    const step = undoChange(past.current, future.current, { project, selectedId })
    if (!step) return
    past.current = step.past
    future.current = step.future
    setProject(step.current.project)
    setSelectedId(step.current.selectedId)
    setNotice(null)
    bump()
  }

  function redo() {
    const step = redoChange(past.current, future.current, { project, selectedId })
    if (!step) return
    past.current = step.past
    future.current = step.future
    setProject(step.current.project)
    setSelectedId(step.current.selectedId)
    setNotice(null)
    bump()
  }

  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  undoRef.current = undo
  redoRef.current = redo

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!window.location.hash.startsWith('#cuisine')) return
      const key = event.key.toLowerCase()
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undoRef.current()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function replaceSelected(next: KitchenColumn) {
    setProject((current) => ({
      ...current,
      columns: current.columns.map((column) => (column.id === selected.id ? next : column)),
    }))
  }

  const api = useMemo<KitchenApi>(() => {
    return {
      project,
      selected,
      notice,
      issues,
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      setWall(field, value) {
        const result = setKitchenWall(project, field, value)
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        remember()
        setProject(result.project)
        setNotice(null)
        return true
      },
      setDepth(depth) {
        const result = setRoomDepth(project, depth)
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        remember()
        setProject(result.project)
        setNotice(null)
        return true
      },
      setShape(shape) {
        if (project.room.shape === shape) return
        remember()
        setProject(setShape(project, shape))
        setNotice(null)
      },
      setIsland(island) {
        if (project.room.island === island) return
        remember()
        setProject(setIsland(project, island))
        setNotice(null)
      },
      setLSide(side) {
        if (project.room.lSide === side) return
        remember()
        setProject(setLSide(project, side))
        setNotice(null)
      },
      setWidth(width) {
        const index = project.columns.findIndex((column) => column.id === selected.id)
        const result = setColumnWidth(project, index, width)
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        remember()
        setProject({ ...project, columns: result.columns })
        setNotice(null)
        return true
      },
      setLocked(locked) {
        if (selected.locked === locked) return
        remember()
        replaceSelected({ ...selected, locked })
        setNotice(null)
      },
      setKind(kind) {
        remember()
        replaceSelected({ ...selected, kind, upper: kind === 'bas' ? selected.upper : 'aucun' })
        setNotice(null)
      },
      setBase(base) {
        remember()
        replaceSelected({ ...selected, kind: 'bas', base })
        setNotice(null)
      },
      setDeck(deck) {
        remember()
        replaceSelected({ ...selected, deck })
        setNotice(null)
      },
      setTower(tower) {
        remember()
        replaceSelected({ ...selected, kind: 'colonne', tower, upper: 'aucun' })
        setNotice(null)
      },
      setUpper(upper) {
        remember()
        replaceSelected({ ...selected, upper })
        setNotice(null)
      },
      setHandle(handle) {
        remember()
        replaceSelected({ ...selected, handle })
        setNotice(null)
      },
      setFinish(finish) {
        remember()
        setProject({ ...project, finish })
        setNotice(null)
      },
      setWallFinish(wallId, finish) {
        if (project.room.finishes[wallId] === finish) return
        remember()
        setProject(setWallFinish(project, wallId, finish))
        setNotice(null)
      },
      setName(name) {
        const next = name.trim() || 'Cuisine'
        if (next === project.name) return
        remember()
        setProject({ ...project, name: next })
        setNotice(null)
      },
      correct(columnId) {
        const column = project.columns.find((item) => item.id === columnId)
        if (!column) return
        const target = issues.find((issue) => issue.columnId === columnId && canCorrectIssue(issue))
        if (!target) return
        const upper = target.level === 'refus' ? 'aucun' : 'hotte'
        if (column.upper === upper) return
        remember()
        setProject({
          ...project,
          columns: project.columns.map((item) => (item.id === columnId ? { ...item, upper } : item)),
        })
        setNotice(null)
      },
      add(wallId, spec) {
        const result = addKitchenColumn(project, wallId, spec, createId)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        remember()
        setProject({ ...project, columns: result.columns })
        setSelectedId(result.columns[result.selectedIndex].id)
        setNotice(null)
      },
      swap(direction) {
        const result = swapColumn(project, selected.id, direction)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        remember()
        setProject({ ...project, columns: result.columns })
        setNotice(null)
      },
      placeColumn(id, x) {
        const column = project.columns.find((item) => item.id === id)
        if (!column || column.locked || column.x === x) return
        remember()
        setProject(moveColumn(project, id, x))
        setNotice(null)
      },
      placeOpening(id, patch) {
        const result = updateOpening(project, id, patch)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        const current = project.openings.find((opening) => opening.id === id)
        if (current && current.x === result.project.openings.find((opening) => opening.id === id)?.x && current.bottom === result.project.openings.find((opening) => opening.id === id)?.bottom) return
        remember()
        setProject(result.project)
        setNotice(null)
      },
      placeIsland(x, z) {
        const next = moveIsland(project, x, z)
        if (next.room.islandX === project.room.islandX && next.room.islandZ === project.room.islandZ) return
        remember()
        setProject(next)
        setNotice(null)
      },
      remove() {
        const index = project.columns.findIndex((column) => column.id === selected.id)
        const result = removeKitchenColumn(project.columns, index)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        remember()
        setProject({ ...project, columns: result.columns })
        setSelectedId(result.columns[result.selectedIndex].id)
        setNotice(null)
      },
      select(id) {
        setSelectedId(id)
      },
      addZone(kind, wallId = 'A') {
        const result = addOpening(project, kind, wallId)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        remember()
        setProject(result.project)
        setNotice(null)
      },
      setZone(id, patch) {
        const result = updateOpening(project, id, patch)
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        remember()
        setProject(result.project)
        setNotice(null)
        return true
      },
      removeZone(id) {
        remember()
        setProject(removeOpening(project, id))
        setNotice(null)
      },
      undo,
      redo,
      save() {
        const blob = new Blob([serializeKitchen(project)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'cuisine.json'
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      },
      openText(text) {
        try {
          const next = parseKitchen(text)
          remember()
          setProject(next)
          setSelectedId(next.columns[0].id)
          setNotice(null)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Fichier refusé.')
        }
      },
      replace(next) {
        remember()
        setProject(next)
        if (!next.columns.some((column) => column.id === selectedId)) setSelectedId(next.columns[0].id)
        setNotice(null)
      },
    }
  }, [historyMark, issues, notice, project, selected])

  return <KitchenContext.Provider value={api}>{children}</KitchenContext.Provider>
}

export function useKitchen(): KitchenApi {
  const api = useContext(KitchenContext)
  if (!api) throw new Error('Cuisine hors contexte.')
  return api
}
