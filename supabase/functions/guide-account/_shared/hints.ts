import { query } from './db.ts'

export async function trainingHintsForPrompt(): Promise<string> {
  const rows = await query<{ prompt: string; correction: string }>(
    'select prompt, correction from guide.training order by created_at desc limit 12',
  )
  return rows
    .map(
      (t) =>
        '- When similar to "' +
        String(t.prompt).slice(0, 120) +
        '", prefer: ' +
        String(t.correction).slice(0, 220),
    )
    .join('\n')
}
