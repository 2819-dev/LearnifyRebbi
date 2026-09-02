export default async () =>
  Response.json({ ok: true, name: 'Lomed' })

export const config = {
  path: '/api/health',
}
