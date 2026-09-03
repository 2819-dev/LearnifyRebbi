export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const PII_KEYS = new Set([
  'phone',
  'phoneNumber',
  'tel',
  'mobile',
  'password',
  'passwordHash',
  'password_hash',
  'hash',
  'salt',
  'token_hash',
  'value',
])

export function scrubPii(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubPii)
  if (value instanceof Date) return value.toISOString()
  if (!value || typeof value !== 'object') return value
  const iso =
    typeof (value as { toISOString?: unknown }).toISOString === 'function' &&
    Object.keys(value as object).length === 0
      ? (value as Date).toISOString()
      : null
  if (iso) return iso
  const out: Record<string, unknown> = {}
  for (const [key, next] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(key)) continue
    out[key] = scrubPii(next)
  }
  return out
}

export function safeErrorMessage(err: unknown): string {
  const raw = String((err as { message?: string })?.message || 'Request failed')
  return raw.replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted]')
}

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(scrubPii(payload)), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function optionsResponse(): Response {
  return new Response('ok', { status: 200, headers: corsHeaders })
}

export function tokenFrom(req: Request, body: Record<string, unknown> = {}): string {
  const header = req.headers.get('authorization') || ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return String(body.token || '')
}

export function httpStatus(err: unknown): number {
  const status = Number((err as { status?: number })?.status)
  return status >= 400 && status < 600 ? status : 500
}

export function fail(err: unknown): Response {
  return json({ error: safeErrorMessage(err) }, httpStatus(err))
}

export function httpError(message: string, status: number): Error {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  return err
}
