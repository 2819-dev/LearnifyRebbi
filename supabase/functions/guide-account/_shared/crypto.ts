const PBKDF2_ITERS = 120000

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, '')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return bytesToHex(new Uint8Array(digest))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERS },
    key,
    256,
  )
  return (
    'pbkdf2$' +
    PBKDF2_ITERS +
    '$' +
    bytesToHex(salt) +
    '$' +
    bytesToHex(new Uint8Array(bits))
  )
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = String(stored || '').split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  const salt = hexToBytes(parts[2])
  const prev = hexToBytes(parts[3])
  if (!iterations || salt.length === 0 || prev.length === 0) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    prev.length * 8,
  )
  return timingSafeEqual(prev, new Uint8Array(bits))
}

export function randomToken(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
}

export function normalizePhone(phone: unknown): string {
  return String(phone || '').replace(/[^\d+]/g, '')
}

export function phoneDigits(phone: unknown): string {
  return String(phone || '')
    .replace(/\D/g, '')
    .replace(/^1(?=\d{10}$)/, '')
    .slice(-10)
}

export async function phoneDigestHex(phone: unknown): Promise<string | null> {
  const digits = phoneDigits(phone)
  if (digits.length < 10) return null
  return sha256Hex('guide.owner.v1:' + digits)
}

export async function digestMatches(
  left: string | null,
  right: string | null,
): Promise<boolean> {
  if (!left || !right) return false
  return timingSafeEqual(hexToBytes(left), hexToBytes(right))
}
