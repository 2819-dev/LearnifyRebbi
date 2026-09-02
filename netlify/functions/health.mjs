export default async () =>
  Response.json({ ok: true, name: 'Guide' })

export const config = {
  path: '/api/health',
}
