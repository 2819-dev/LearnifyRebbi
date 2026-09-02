export type ChatMessage = {
  role: 'user' | 'model'
  content: string
}

export async function askRebbe(payload: {
  messages: ChatMessage[]
  gemaraRef: string
  hebrewLine: string
  englishLine: string
  lineIndex: number
  mode: 'teach' | 'continue' | 'ask'
  question?: string
}): Promise<string> {
  const res = await fetch('/api/rebbe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Rebbe is unavailable right now.')
  }
  return String(data.reply || '')
}
