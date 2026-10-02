import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addCaisson, duplicateCaisson, removeCaisson, setCaissonWidth } from '../domain/caissons'
import { recordChange, redoChange, undoChange } from '../domain/history'
import { applyHangingGap, applyRail, applyShelfCount, applyShelfGap } from '../domain/layout'
import { applyRules, applyWidths, createId, defaultProject, parseProject, serializeProject, setWallField } from '../domain/project'
import type { RuleProfile } from '../domain/profile'
import type { WallField } from '../domain/rules'
import type { Caisson, DoorFinishId, DoorMode, DrawerThickness, FinishId, Project, RailMode } from '../domain/types'

type ProjectApi = {
  project: Project
  selected: Caisson
  notice: string | null
  doorsOpen: boolean
  frameToken: number
  setWall: (field: WallField, value: number) => boolean
  setWidth: (width: number) => boolean
  setLocked: (locked: boolean) => void
  add: () => void
  duplicate: () => void
  remove: () => void
  select: (id: string) => void
  setShelves: (count: number) => void
  setShelfGap: (index: number, gap: number) => boolean
  setRail: (rail: RailMode) => boolean
  setHangingGap: (gap: number) => boolean
  setDrawers: (count: number) => void
  setDrawerThickness: (thickness: DrawerThickness) => void
  setDoor: (door: DoorMode) => void
  setDoorFinish: (finish: DoorFinishId) => void
  setFinish: (finish: FinishId) => void
  setRule: (field: keyof RuleProfile, value: number) => boolean
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  toggleDoors: () => void
  reframe: () => void
  save: () => void
  openText: (text: string) => void
  replace: (next: Project) => void
}

const ProjectContext = createContext<ProjectApi | null>(null)

type Snap = { project: Project; selectedId: string }

export function ProjectProvider({ children }: { children: ReactNode }) {
  const initial = defaultProject()
  const [project, setProject] = useState<Project>(initial)
  const [selectedId, setSelectedId] = useState(initial.caissons[0].id)
  const [notice, setNotice] = useState<string | null>(null)
  const [doorsOpen, setDoorsOpen] = useState(false)
  const [frameToken, setFrameToken] = useState(0)
  const [historyMark, setHistoryMark] = useState(0)
  const past = useRef<Snap[]>([])
  const future = useRef<Snap[]>([])

  const selected = project.caissons.find((caisson) => caisson.id === selectedId) ?? project.caissons[0]

  function bumpHistory() {
    setHistoryMark((mark) => mark + 1)
  }

  function remember() {
    past.current = recordChange(past.current, { project, selectedId })
    future.current = []
    bumpHistory()
  }

  function undo() {
    const step = undoChange(past.current, future.current, { project, selectedId })
    if (!step) return
    past.current = step.past
    future.current = step.future
    setProject(step.current.project)
    setSelectedId(step.current.selectedId)
    setNotice(null)
    bumpHistory()
  }

  function redo() {
    const step = redoChange(past.current, future.current, { project, selectedId })
    if (!step) return
    past.current = step.past
    future.current = step.future
    setProject(step.current.project)
    setSelectedId(step.current.selectedId)
    setNotice(null)
    bumpHistory()
  }

  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  undoRef.current = undo
  redoRef.current = redo

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (window.location.hash.startsWith('#cuisine')) return
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

  const api = useMemo<ProjectApi>(() => {
    function replaceSelected(next: Caisson) {
      setProject((current) => ({
        ...current,
        caissons: current.caissons.map((caisson) => (caisson.id === selected.id ? next : caisson)),
      }))
    }

    return {
      project,
      selected,
      notice,
      doorsOpen,
      frameToken,
      setWall(field, value) {
        const result = setWallField(project, field, value)
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
        const index = project.caissons.findIndex((caisson) => caisson.id === selected.id)
        const result = setCaissonWidth(
          project.caissons.map((caisson) => caisson.width),
          index,
          width,
          project.caissons.map((caisson) => caisson.locked),
        )
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        remember()
        setProject(applyWidths(project, result.widths))
        setNotice(null)
        return true
      },
      setLocked(locked) {
        if (selected.locked === locked) return
        remember()
        replaceSelected({ ...selected, locked })
        setNotice(null)
      },
      add() {
        const result = addCaisson(project.caissons, createId)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        remember()
        setProject({ ...project, caissons: result.caissons })
        setSelectedId(result.caissons[result.selectedIndex].id)
        setNotice(null)
      },
      duplicate() {
        const index = project.caissons.findIndex((caisson) => caisson.id === selected.id)
        const result = duplicateCaisson(project.caissons, index, createId)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        remember()
        setProject({ ...project, caissons: result.caissons })
        setSelectedId(result.caissons[result.selectedIndex].id)
        setNotice(null)
      },
      remove() {
        const index = project.caissons.findIndex((caisson) => caisson.id === selected.id)
        const result = removeCaisson(project.caissons, index)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        remember()
        setProject({ ...project, caissons: result.caissons })
        setSelectedId(result.caissons[result.selectedIndex].id)
        setNotice(null)
      },
      select(id) {
        setSelectedId(id)
      },
      setShelves(count) {
        remember()
        setProject((current) => ({
          ...current,
          caissons: current.caissons.map((caisson) =>
            caisson.id === selected.id ? applyShelfCount(current.wall, caisson, count, current.rules) : caisson,
          ),
        }))
        setNotice(null)
      },
      setShelfGap(index, gap) {
        const result = applyShelfGap(project.wall, selected, index, gap, project.rules)
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        remember()
        replaceSelected(result.caisson)
        setNotice(null)
        return true
      },
      setRail(rail) {
        const result = applyRail(project.wall, selected, rail, project.rules)
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        remember()
        replaceSelected(result.caisson)
        setNotice(null)
        return true
      },
      setHangingGap(gap) {
        const result = applyHangingGap(project.wall, selected, gap, project.rules)
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        remember()
        replaceSelected(result.caisson)
        setNotice(null)
        return true
      },
      setDrawers(count) {
        remember()
        const next = { ...selected, drawers: count }
        replaceSelected(applyShelfCount(project.wall, next, next.shelves, project.rules))
        setNotice(null)
      },
      setDrawerThickness(thickness) {
        remember()
        replaceSelected({ ...selected, drawerThickness: thickness })
        setNotice(null)
      },
      setDoor(door) {
        remember()
        const doorFinish =
          door === 'vitree'
            ? 'verre'
            : selected.doorFinish === 'verre' && door !== 'coulissante'
              ? project.finish
              : selected.doorFinish
        replaceSelected({ ...selected, door, doorFinish })
        setNotice(null)
      },
      setDoorFinish(finish) {
        remember()
        if (finish === 'verre' && selected.door === 'coulissante') {
          replaceSelected({ ...selected, doorFinish: finish })
          setNotice(null)
          return
        }
        const door: DoorMode = finish === 'verre' ? 'vitree' : selected.door === 'vitree' ? 'battante' : selected.door
        replaceSelected({ ...selected, door, doorFinish: finish })
        setNotice(null)
      },
      setFinish(finish) {
        remember()
        setProject((current) => ({ ...current, finish }))
      },
      setRule(field, value) {
        const result = applyRules(project, { [field]: value })
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        remember()
        setProject(result.project)
        setNotice(null)
        return true
      },
      undo,
      redo,
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      toggleDoors() {
        setDoorsOpen((open) => !open)
      },
      reframe() {
        setFrameToken((token) => token + 1)
      },
      save() {
        const blob = new Blob([serializeProject(project)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'caisson.json'
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      },
      openText(text) {
        try {
          const next = parseProject(text)
          remember()
          setProject(next)
          setSelectedId(next.caissons[0].id)
          setNotice(null)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Fichier refusé.')
        }
      },
      replace(next) {
        remember()
        setProject(next)
        if (!next.caissons.some((caisson) => caisson.id === selectedId)) setSelectedId(next.caissons[0].id)
        setNotice(null)
      },
    }
  }, [doorsOpen, frameToken, historyMark, notice, project, selected])

  return <ProjectContext.Provider value={api}>{children}</ProjectContext.Provider>
}

export function useProject(): ProjectApi {
  const api = useContext(ProjectContext)
  if (!api) throw new Error('Projet hors contexte.')
  return api
}
