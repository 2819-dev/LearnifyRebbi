import { fail, json, optionsResponse, tokenFrom } from '../_shared/http.ts'
import { handleAccountAction } from '../_shared/account.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  let body: Record<string, unknown> = {}
  if (req.method !== 'GET') {
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
  }

  const url = new URL(req.url)
  const action = String(
    body.action ||
      url.searchParams.get('action') ||
      (req.method === 'GET' ? 'me' : ''),
  )

  try {
    return json(await handleAccountAction(action, body, tokenFrom(req, body)))
  } catch (err) {
    console.error((err as Error)?.message || err)
    return fail(err)
  }
})
