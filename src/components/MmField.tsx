import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export function MmField({
  label,
  value,
  hint,
  onCommit,
  min,
  max,
  step = 10,
}: {
  label: string
  value: number
  hint: string
  onCommit: (value: number) => boolean
  min?: number
  max?: number
  step?: number
}) {
  const [text, setText] = useState(String(value))
  const valueRef = useRef(value)
  const timers = useRef<{ delay: number; repeat: number } | null>(null)
  valueRef.current = value

  useEffect(() => {
    setText(String(value))
  }, [value])

  useEffect(() => () => stopHold(), [])

  function commit() {
    const trimmed = text.trim()
    if (!/^-?\d+$/.test(trimmed)) {
      setText(String(value))
      onCommit(Number.NaN)
      return
    }
    let next = Number(trimmed)
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    if (next === value) {
      setText(String(value))
      return
    }
    const ok = onCommit(next)
    setText(String(ok ? next : value))
  }

  function stepBy(direction: 1 | -1, amount: number): boolean {
    const current = valueRef.current
    let next = current + direction * amount
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    if (next === current) return false
    const ok = onCommit(next)
    if (ok) valueRef.current = next
    return ok
  }

  function stopHold() {
    if (!timers.current) return
    window.clearTimeout(timers.current.delay)
    window.clearInterval(timers.current.repeat)
    timers.current = null
  }

  function hold(event: ReactPointerEvent<HTMLButtonElement>, direction: 1 | -1) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    stopHold()
    let ticks = 0
    const run = () => {
      ticks += 1
      const amount = ticks > 18 ? step * 10 : ticks > 6 ? step * 5 : step
      return stepBy(direction, amount)
    }
    if (!run()) return
    const delay = window.setTimeout(() => {
      const repeat = window.setInterval(() => {
        if (!run()) stopHold()
      }, 50)
      if (timers.current) timers.current.repeat = repeat
    }, 280)
    timers.current = { delay, repeat: 0 }
  }

  return (
    <div className="field">
      <span>{label}</span>
      <div className="mm">
        <button
          type="button"
          aria-label="Diminuer"
          disabled={min !== undefined && value <= min}
          onPointerDown={(event) => hold(event, -1)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
        >
          −
        </button>
        <input
          inputMode="numeric"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <button
          type="button"
          aria-label="Augmenter"
          disabled={max !== undefined && value >= max}
          onPointerDown={(event) => hold(event, 1)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
        >
          +
        </button>
      </div>
      <small>{hint}</small>
    </div>
  )
}
