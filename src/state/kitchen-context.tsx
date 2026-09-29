import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { recordChange, redoChange, undoChange } from '../domain/history'
import { createId } from '../domain/project'
import { addKitchenColumn, canCorrectIssue, inspectKitchen, removeKitchenColumn, setColumnWidth } from '../kitchen/layout'
import {
  addOpening,
  defaultKitchen,
  parseKitchen,
  removeOpening,
  serializeKitchen,
  setKitchenWall,
  updateOpening,
} from '../kitchen/project'
import type { BaseRole, HandleId, KitchenColumn, KitchenFinishId, KitchenProject, KitchenWall, Opening, OpeningKind, TowerRole, UpperRole } from '../kitchen/types'

type Snap = { project: KitchenProject; selectedId: string }

type KitchenApi = {
  project: KitchenProject
  selected: KitchenColumn
  notice: string | null
  issues: ReturnType<typeof inspectKitchen>['issues']
  canUndo: boolean
  canRedo: boolean
  setWall: (field: keyof KitchenWall, value: number) => boolean
  setWidth: (width: number) => boolean
  setLocked: (locked: boolean) => void
  setKind: (kind: KitchenColumn['kind']) => void
  setBase: (base: BaseRole) => void
  setTower: (tower: TowerRole) => void
  setUpper: (upper: UpperRole) => void
  setHandle: (handle: HandleId) => void
  setFinish: (finish: KitchenFinishId) => void
  setName: (name: string) => void
  correct: (columnId: string) => void
  add: () => void
  remove: () => void
  select: (id: string) => void
  addZone: (kind: OpeningKind) => void
  setZone: (id: string, patch: Partial<Pick<Opening, 'x' | 'width' | 'bottom' | 'height'>>) => boolean
  removeZone: (id: string) => void
  undo: () => void
  redo: () => void
  save: () => void
  openText: (text: string) => void
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
        replaceSelected({ ...selected, kind, upper: kind === 'colonne' ? 'aucun' : selected.upper })
        setNotice(null)
      },
      setBase(base) {
        remember()
        replaceSelected({ ...selected, kind: 'bas', base })
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
      add() {
        const result = addKitchenColumn(project.columns, createId)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        remember()
        setProject({ ...project, columns: result.columns })
        setSelectedId(result.columns[result.selectedIndex].id)
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
      addZone(kind) {
        const result = addOpening(project, kind)
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
    }
  }, [historyMark, issues, notice, project, selected])

  return <KitchenContext.Provider value={api}>{children}</KitchenContext.Provider>
}

export function useKitchen(): KitchenApi {
  const api = useContext(KitchenContext)
  if (!api) throw new Error('Cuisine hors contexte.')
  return api
}
