import { json, optionsResponse } from '../_shared/http.ts'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  return json({ ok: true, name: 'Guide' })
})
