import { Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { defaultRoom, footprint, mountRun, builtWalls } from './room'
import type { WallId } from './types'

describe('room mounts', () => {
  it('builds a straight wall, an L on either side, or a U', () => {
    expect(builtWalls('lineaire')).toEqual(['A'])
    expect(builtWalls('l', 'gauche')).toEqual(['A', 'B'])
    expect(builtWalls('l', 'droite')).toEqual(['A', 'C'])
    expect(builtWalls('u')).toEqual(['A', 'B', 'C'])
  })
  it('keeps a run on every wall inside its footprint', () => {
    const width = 3600
    const room = defaultRoom(width)
    const cases: [WallId, number, number, number][] = [
      ['A', 200, 600, 560],
      ['B', 560, 600, 560],
      ['C', 100, 600, 560],
      ['D', 80, 800, 560],
      ['ilot', 0, 700, room.islandDepth],
    ]
    for (const [wallId, along, size, into] of cases) {
      const box = footprint(room, width, wallId, along, size, into)
      const mount = mountRun(room, width, wallId, along, size)
      const group = new Object3D()
      group.position.set(mount.x, 0, mount.z)
      group.rotation.y = mount.rot
      for (const [x, z] of [[0, 0], [size, 0], [0, into], [size, into]] as const) {
        const child = new Object3D()
        child.position.set(x, 0, z)
        group.add(child)
        group.updateMatrixWorld(true)
        const point = child.getWorldPosition(new Vector3())
        expect(point.x).toBeGreaterThanOrEqual(box.x - 1)
        expect(point.x).toBeLessThanOrEqual(box.x + box.w + 1)
        expect(point.z).toBeGreaterThanOrEqual(box.z - 1)
        expect(point.z).toBeLessThanOrEqual(box.z + box.d + 1)
      }
    }
  })
})
