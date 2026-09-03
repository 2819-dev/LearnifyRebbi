import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const TARGET = 'https://xdsnoqckoolwatgwtyfy.supabase.co/functions/v1'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkc25vcWNrb29sd2F0Z3d0eWZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzMzODksImV4cCI6MjEwMzcwOTM4OX0.3Nx7Aq40Tj10-Woc_5gcPUNU23qJWWI8X7kdwKvHXgg'

const app = new Hono()
app.use('/api/*', cors())

async function proxy(c, name) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: ANON,
  }
  const auth = c.req.header('authorization')
  if (auth) headers.Authorization = auth
  const method = c.req.method
  const res = await fetch(`${TARGET}/${name}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : await c.req.text(),
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
  })
}

app.all('/api/account', (c) => proxy(c, 'guide-account'))
app.all('/api/rebbe', (c) => proxy(c, 'guide-rebbe'))
app.all('/api/health', (c) => proxy(c, 'guide-health'))
app.get('/api/voices', (c) => proxy(c, 'guide-rebbe'))

const port = Number(process.env.PORT || 8787)
console.log(`Guide API proxy on http://localhost:${port} -> ${TARGET}`)
serve({ fetch: app.fetch, port })
