import { useEffect, useState } from 'react'

export function MmField({
  label,
  value,
  hint,
  onCommit,
}: {
  label: string
  value: number
  hint: string
  onCommit: (value: number) => boolean
}) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  function commit() {
    const trimmed = text.trim()
    if (!/^-?\d+$/.test(trimmed)) {
      setText(String(value))
      onCommit(Number.NaN)
      return
    }
    const next = Number(trimmed)
    if (next === value) return
    const ok = onCommit(next)
    if (!ok) setText(String(value))
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      <small>{hint}</small>
    </label>
  )
}
