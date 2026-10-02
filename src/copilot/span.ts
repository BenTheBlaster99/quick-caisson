const COUNT_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
}

export function readCount(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word)
  return COUNT_WORDS[word] ?? null
}

export const COUNT_PATTERN = String.raw`\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix`

/** Metres, centimetres, and millimetres become whole millimetres. A bare number is already millimetres. */
export function findMillimetres(text: string): number | null {
  const compact = text.match(/(\d+)\s*(?:metres|metre|m)\s*(\d{2})\b/)
  if (compact) return Number(compact[1]) * 1000 + Number(compact[2]) * 10
  const decimal = text.match(/(\d+)\.(\d{1,2})\s*(?:metres|metre|m)\b/)
  if (decimal) return Number(decimal[1]) * 1000 + Number(decimal[2].padEnd(2, '0')) * 10
  const metres = text.match(/(\d+)\s*(?:metres|metre|m)\b/)
  if (metres) return Number(metres[1]) * 1000
  const centimetres = text.match(/(\d+)\s*cm\b/)
  if (centimetres) return Number(centimetres[1]) * 10
  const millimetres = text.match(/(\d+)\s*mm\b/)
  if (millimetres) return Number(millimetres[1])
  const bare = text.match(/\b(\d{2,4})\b/)
  if (bare) return Number(bare[1])
  return null
}
