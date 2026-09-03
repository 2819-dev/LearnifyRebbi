import postgres from 'npm:postgres@3.4.7'

type Sql = ReturnType<typeof postgres>

let cached: Sql | null = null

export function sql(): Sql {
  if (cached) return cached
  const url =
    Deno.env.get('SUPABASE_DB_URL') ||
    Deno.env.get('DATABASE_URL')
  if (!url) throw new Error('Database is not configured')
  cached = postgres(url, {
    max: 1,
    idle_timeout: 8,
    connect_timeout: 12,
    prepare: false,
  })
  return cached
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await sql().unsafe(text, params as never[])) as unknown as T[]
}

export async function setting(key: string): Promise<string> {
  const rows = await query<{ value: string }>(
    'select value from guide.settings where key = $1 limit 1',
    [key],
  )
  return String(rows[0]?.value || '')
}
