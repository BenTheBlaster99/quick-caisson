export type CopilotCommand = {
  action: string
  target: string
  parameters: Record<string, number | string>
  confidence: number
  reason: string
}

export type PhraseResult = { ok: true; commands: CopilotCommand[] } | { ok: false; error: string }

export type CopilotMode = 'dressing' | 'cuisine'

export type CopilotProvider = {
  id: string
  read: (text: string, mode: CopilotMode) => PhraseResult
}

export function command(
  action: string,
  target: string,
  parameters: Record<string, number | string>,
  reason: string,
): CopilotCommand {
  return { action, target, parameters, confidence: 1, reason }
}
