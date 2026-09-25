import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { addCaisson, removeCaisson, setCaissonWidth } from '../domain/caissons'
import { applyWidths, createId, defaultProject, parseProject, serializeProject, setWallField } from '../domain/project'
import type { WallField } from '../domain/rules'
import type { Caisson, FinishId, FrontMode, Project } from '../domain/types'

type ProjectApi = {
  project: Project
  selected: Caisson
  notice: string | null
  doorsOpen: boolean
  frameToken: number
  setWall: (field: WallField, value: number) => boolean
  setWidth: (width: number) => boolean
  add: () => void
  remove: () => void
  select: (id: string) => void
  patchSelected: (patch: Partial<Pick<Caisson, 'shelves' | 'rail' | 'drawers' | 'pantalonniere'>>) => void
  setFront: (front: FrontMode) => void
  setFinish: (finish: FinishId) => void
  toggleDoors: () => void
  reframe: () => void
  save: () => void
  openText: (text: string) => void
}

const ProjectContext = createContext<ProjectApi | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const initial = defaultProject()
  const [project, setProject] = useState<Project>(initial)
  const [selectedId, setSelectedId] = useState(initial.caissons[0].id)
  const [notice, setNotice] = useState<string | null>(null)
  const [doorsOpen, setDoorsOpen] = useState(false)
  const [frameToken, setFrameToken] = useState(0)

  const selected = project.caissons.find((caisson) => caisson.id === selectedId) ?? project.caissons[0]

  const api = useMemo<ProjectApi>(() => {
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
        )
        if (!result.ok) {
          setNotice(result.error)
          return false
        }
        setProject(applyWidths(project, result.widths))
        setNotice(null)
        return true
      },
      add() {
        const result = addCaisson(project.caissons, createId)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
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
        setProject({ ...project, caissons: result.caissons })
        setSelectedId(result.caissons[result.selectedIndex].id)
        setNotice(null)
      },
      select(id) {
        setSelectedId(id)
      },
      patchSelected(patch) {
        setProject((current) => ({
          ...current,
          caissons: current.caissons.map((caisson) =>
            caisson.id === selected.id ? { ...caisson, ...patch } : caisson,
          ),
        }))
        setNotice(null)
      },
      setFront(front) {
        setProject((current) => ({ ...current, front }))
      },
      setFinish(finish) {
        setProject((current) => ({ ...current, finish }))
      },
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
          setProject(next)
          setSelectedId(next.caissons[0].id)
          setNotice(null)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Fichier refusé.')
        }
      },
    }
  }, [doorsOpen, frameToken, notice, project, selected])

  return <ProjectContext.Provider value={api}>{children}</ProjectContext.Provider>
}

export function useProject(): ProjectApi {
  const api = useContext(ProjectContext)
  if (!api) throw new Error('Projet hors contexte.')
  return api
}
