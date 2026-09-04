/** Free Microsoft Edge neural TTS (no API key) — warm adult male voices. */

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WIN_EPOCH = 11644473600
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0]!
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`
const UA =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ` +
  `Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`

/** Guide voice id → warm US English male neural voice. */
export const EDGE_MALE_VOICES: Record<string, string> = {
  Charon: 'en-US-AndrewNeural',
  Sadaltager: 'en-US-ChristopherNeural',
  Schedar: 'en-US-GuyNeural',
  Gacrux: 'en-US-BrianNeural',
}

const HEBREW_MALE = 'he-IL-AvriNeural'

function uuidNoDash(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

async function sha256HexUpper(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

async function secMsGec(): Promise<string> {
  let ticks = Date.now() / 1000 + WIN_EPOCH
  ticks -= ticks % 300
  ticks = Math.floor(ticks * (1e9 / 100))
  return sha256HexUpper(`${ticks}${TRUSTED_CLIENT_TOKEN}`)
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitize(text: string): string {
  return [...String(text || '')]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if ((code >= 0 && code <= 8) || (code >= 11 && code <= 12) || (code >= 14 && code <= 31)) {
        return ' '
      }
      return ch
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksMostlyHebrew(text: string): boolean {
  const letters = text.replace(/\s+/g, '')
  if (!letters) return false
  const he = (letters.match(/[\u0590-\u05FF]/g) || []).length
  return he / letters.length > 0.4
}

function edgeVoiceFor(guideVoice: string, text: string): string {
  if (looksMostlyHebrew(text)) return HEBREW_MALE
  return EDGE_MALE_VOICES[guideVoice] || EDGE_MALE_VOICES.Charon
}

function mkSsml(voice: string, text: string): string {
  return (
    "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>" +
    `<voice name='${voice}'>` +
    `<prosody rate='-8%' pitch='-2Hz'>${escapeXml(text)}</prosody>` +
    '</voice></speak>'
  )
}

function jsDateString(): string {
  const d = new Date()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ` +
    `${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ` +
    'GMT+0000 (Coordinated Universal Time)'
  )
}

function b64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

/** Minimal client WebSocket over Deno TLS — needed so we can send Edge's required headers. */
class DenoTlsWebSocket {
  #conn: Deno.TcpConn & Deno.TlsConn
  #buf = new Uint8Array(0)
  closed = false

  private constructor(conn: Deno.TcpConn & Deno.TlsConn) {
    this.#conn = conn
  }

  static async connect(urlStr: string, headers: Record<string, string>): Promise<DenoTlsWebSocket> {
    const u = new URL(urlStr)
    const conn = await Deno.connectTls({ hostname: u.hostname, port: 443 })
    const keyBytes = crypto.getRandomValues(new Uint8Array(16))
    const key = b64(keyBytes)
    const path = `${u.pathname}${u.search}`
    const lines = [
      `GET ${path} HTTP/1.1`,
      `Host: ${u.hostname}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
      '',
      '',
    ]
    const encoder = new TextEncoder()
    await conn.write(encoder.encode(lines.join('\r\n')))

    const ws = new DenoTlsWebSocket(conn)
    const headerBytes = await ws.#readUntil(encoder.encode('\r\n\r\n'))
    const headerText = new TextDecoder().decode(headerBytes)
    if (!headerText.startsWith('HTTP/1.1 101')) {
      try {
        conn.close()
      } catch {
        // ignore
      }
      throw new Error(`Edge TTS handshake failed: ${headerText.split('\r\n')[0]}`)
    }
    return ws
  }

  async #readMore(): Promise<boolean> {
    const chunk = new Uint8Array(8192)
    const n = await this.#conn.read(chunk)
    if (n === null) return false
    const next = new Uint8Array(this.#buf.length + n)
    next.set(this.#buf)
    next.set(chunk.subarray(0, n), this.#buf.length)
    this.#buf = next
    return true
  }

  async #readUntil(marker: Uint8Array): Promise<Uint8Array> {
    while (true) {
      const idx = indexOf(this.#buf, marker)
      if (idx >= 0) {
        const out = this.#buf.slice(0, idx + marker.length)
        this.#buf = this.#buf.slice(idx + marker.length)
        return out
      }
      if (!(await this.#readMore())) throw new Error('Edge TTS connection closed during handshake')
    }
  }

  async #ensure(n: number): Promise<void> {
    while (this.#buf.length < n) {
      if (!(await this.#readMore())) throw new Error('Edge TTS connection closed')
    }
  }

  async sendText(text: string): Promise<void> {
    const payload = new TextEncoder().encode(text)
    await this.#writeFrame(0x1, payload)
  }

  async #writeFrame(opcode: number, payload: Uint8Array): Promise<void> {
    const maskKey = crypto.getRandomValues(new Uint8Array(4))
    const masked = new Uint8Array(payload.length)
    for (let i = 0; i < payload.length; i++) masked[i] = payload[i]! ^ maskKey[i % 4]!

    let header: Uint8Array
    if (payload.length < 126) {
      header = new Uint8Array(2 + 4)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | payload.length
      header.set(maskKey, 2)
    } else if (payload.length < 65536) {
      header = new Uint8Array(4 + 4)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | 126
      header[2] = (payload.length >> 8) & 0xff
      header[3] = payload.length & 0xff
      header.set(maskKey, 4)
    } else {
      header = new Uint8Array(10 + 4)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | 127
      const view = new DataView(header.buffer)
      view.setUint32(2, 0)
      view.setUint32(6, payload.length)
      header.set(maskKey, 10)
    }
    const frame = new Uint8Array(header.length + masked.length)
    frame.set(header)
    frame.set(masked, header.length)
    await this.#conn.write(frame)
  }

  async *messages(signal?: AbortSignal): AsyncGenerator<{ type: 'text' | 'binary'; data: Uint8Array | string }> {
    while (!this.closed) {
      if (signal?.aborted) throw new Error('Edge TTS timed out')
      await this.#ensure(2)
      const b0 = this.#buf[0]!
      const b1 = this.#buf[1]!
      const opcode = b0 & 0x0f
      const masked = (b1 & 0x80) !== 0
      let len = b1 & 0x7f
      let offset = 2
      if (len === 126) {
        await this.#ensure(4)
        len = (this.#buf[2]! << 8) | this.#buf[3]!
        offset = 4
      } else if (len === 127) {
        await this.#ensure(10)
        // Big payloads; high 32 bits should be 0 for our use
        len =
          (this.#buf[6]! << 24) |
          (this.#buf[7]! << 16) |
          (this.#buf[8]! << 8) |
          this.#buf[9]!
        offset = 10
      }
      let maskKey: Uint8Array | null = null
      if (masked) {
        await this.#ensure(offset + 4)
        maskKey = this.#buf.slice(offset, offset + 4)
        offset += 4
      }
      await this.#ensure(offset + len)
      let payload = this.#buf.slice(offset, offset + len)
      this.#buf = this.#buf.slice(offset + len)
      if (maskKey) {
        const unmasked = new Uint8Array(payload.length)
        for (let i = 0; i < payload.length; i++) unmasked[i] = payload[i]! ^ maskKey[i % 4]!
        payload = unmasked
      }

      if (opcode === 0x8) {
        this.closed = true
        return
      }
      if (opcode === 0x9) {
        // ping → pong
        await this.#writeFrame(0xa, payload)
        continue
      }
      if (opcode === 0xa) continue // pong
      if (opcode === 0x1) {
        yield { type: 'text', data: new TextDecoder().decode(payload) }
      } else if (opcode === 0x2) {
        yield { type: 'binary', data: payload }
      }
    }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    try {
      this.#conn.close()
    } catch {
      // ignore
    }
  }
}

function indexOf(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

async function synthesizeOneChunk(text: string, voice: string): Promise<Uint8Array> {
  const gec = await secMsGec()
  const connectionId = uuidNoDash()
  const url =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&ConnectionId=${connectionId}` +
    `&Sec-MS-GEC=${gec}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`

  const headers: Record<string, string> = {
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    'User-Agent': UA,
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    Cookie: `MUID=${uuidNoDash().toUpperCase()}`,
  }

  const ws = await DenoTlsWebSocket.connect(url, headers)
  const chunks: Uint8Array[] = []
  const ac = new AbortController()
  const timer = setTimeout(() => {
    ac.abort()
    ws.close()
  }, 25000)

  try {
    const config =
      `X-Timestamp:${jsDateString()}\r\n` +
      'Content-Type:application/json; charset=utf-8\r\n' +
      'Path:speech.config\r\n\r\n' +
      '{"context":{"synthesis":{"audio":{"metadataoptions":{' +
      '"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"' +
      '},' +
      '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"' +
      '}}}}\r\n'
    await ws.sendText(config)

    const requestId = uuidNoDash()
    const ssml = mkSsml(voice, text)
    const ssmlMsg =
      `X-RequestId:${requestId}\r\n` +
      'Content-Type:application/ssml+xml\r\n' +
      `X-Timestamp:${jsDateString()}Z\r\n` +
      'Path:ssml\r\n\r\n' +
      ssml
    await ws.sendText(ssmlMsg)

    for await (const msg of ws.messages(ac.signal)) {
      if (msg.type === 'text') {
        if (String(msg.data).includes('Path:turn.end')) break
        continue
      }
      const bytes = msg.data as Uint8Array
      if (bytes.length < 2) continue
      const headerLen = (bytes[0]! << 8) | bytes[1]!
      if (headerLen + 2 > bytes.length) continue
      const header = new TextDecoder().decode(bytes.slice(2, 2 + headerLen))
      if (!header.includes('Path:audio')) continue
      const audio = bytes.slice(2 + headerLen)
      if (audio.length) chunks.push(audio)
    }
  } finally {
    clearTimeout(timer)
    ws.close()
  }

  if (!chunks.length) throw new Error('No audio returned from Edge TTS')
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.length
  }
  return merged
}

function splitByBytes(text: string, maxBytes = 1800): string[] {
  const encoder = new TextEncoder()
  if (encoder.encode(text).length <= maxBytes) return [text]
  const parts = text.split(/(?<=[.!?])\s+/)
  const out: string[] = []
  let cur = ''
  for (const part of parts) {
    const next = cur ? `${cur} ${part}` : part
    if (encoder.encode(next).length <= maxBytes) {
      cur = next
    } else {
      if (cur) out.push(cur)
      if (encoder.encode(part).length <= maxBytes) cur = part
      else {
        const words = part.split(/\s+/)
        cur = ''
        for (const w of words) {
          const tryNext = cur ? `${cur} ${w}` : w
          if (encoder.encode(tryNext).length <= maxBytes) cur = tryNext
          else {
            if (cur) out.push(cur)
            cur = w
          }
        }
      }
    }
  }
  if (cur) out.push(cur)
  return out.length ? out : [text.slice(0, 200)]
}

/**
 * Synthesize MP3 audio with a warm adult male Edge neural voice.
 * Returns raw MPEG bytes.
 */
export async function synthesizeEdgeMaleMp3(
  text: string,
  guideVoice = 'Charon',
): Promise<Uint8Array> {
  const spoken = sanitize(text)
  if (!spoken) throw new Error('Nothing to speak')

  const voice = edgeVoiceFor(guideVoice, spoken)
  const pieces = splitByBytes(spoken, 1800)
  const buffers: Uint8Array[] = []
  for (const piece of pieces) {
    buffers.push(await synthesizeOneChunk(piece, voice))
  }
  const total = buffers.reduce((n, b) => n + b.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const b of buffers) {
    merged.set(b, offset)
    offset += b.length
  }
  return merged
}

export const EDGE_UA = UA
