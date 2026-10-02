/** Solid parts of a wall once its openings are cut out. The drawing reads this; it does not invent the holes. */
export function wallPieces(
  length: number,
  ceiling: number,
  openings: { x: number; width: number; bottom: number; height: number }[],
): { x: number; y: number; w: number; h: number }[] {
  const pieces: { x: number; y: number; w: number; h: number }[] = []
  const sorted = [...openings].sort((a, b) => a.x - b.x)
  let cursor = 0
  for (const opening of sorted) {
    const left = Math.max(cursor, Math.min(opening.x, length))
    if (left > cursor) pieces.push({ x: cursor, y: 0, w: left - cursor, h: ceiling })
    const start = Math.max(0, Math.min(opening.x, length))
    const end = Math.max(start, Math.min(opening.x + opening.width, length))
    if (opening.bottom > 0) pieces.push({ x: start, y: 0, w: end - start, h: Math.min(opening.bottom, ceiling) })
    const top = Math.min(ceiling, opening.bottom + opening.height)
    if (top < ceiling && end > start) pieces.push({ x: start, y: top, w: end - start, h: ceiling - top })
    cursor = Math.max(cursor, end)
  }
  if (cursor < length) pieces.push({ x: cursor, y: 0, w: length - cursor, h: ceiling })
  return pieces.filter((piece) => piece.w > 1 && piece.h > 1)
}
