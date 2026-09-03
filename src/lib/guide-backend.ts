/** Public Guide API on Supabase Edge Functions. Safe to ship in the browser. */
export const GUIDE_SUPABASE_URL = 'https://xdsnoqckoolwatgwtyfy.supabase.co'
/** Legacy anon JWT — used as the `apikey` header for Edge Function calls. */
export const GUIDE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkc25vcWNrb29sd2F0Z3d0eWZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzMzODksImV4cCI6MjEwMzcwOTM4OX0.3Nx7Aq40Tj10-Woc_5gcPUNU23qJWWI8X7kdwKvHXgg'

export const GUIDE_FUNCTIONS = {
  account: `${GUIDE_SUPABASE_URL}/functions/v1/guide-account`,
  rebbe: `${GUIDE_SUPABASE_URL}/functions/v1/guide-rebbe`,
  health: `${GUIDE_SUPABASE_URL}/functions/v1/guide-health`,
} as const
