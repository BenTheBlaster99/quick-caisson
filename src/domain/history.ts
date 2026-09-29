export function recordChange<T>(past: T[], current: T, limit = 40): T[] {
  return [...past, current].slice(-limit)
}

export function undoChange<T>(past: T[], future: T[], current: T): { past: T[]; future: T[]; current: T } | null {
  if (past.length === 0) return null
  const previous = past[past.length - 1]
  return { past: past.slice(0, -1), future: [current, ...future], current: previous }
}

export function redoChange<T>(past: T[], future: T[], current: T): { past: T[]; future: T[]; current: T } | null {
  if (future.length === 0) return null
  const next = future[0]
  return { past: [...past, current], future: future.slice(1), current: next }
}
