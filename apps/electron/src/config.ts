// Connection details baked in at build time — safe for client-side (anon key + RLS).
// Override via env vars for different deployments.
export const SUPABASE_URL = process.env.OPERATE1_SUPABASE_URL
  || 'https://yhdyuzdfocvtgyatnrqz.supabase.co'

export const SUPABASE_ANON_KEY = process.env.OPERATE1_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZHl1emRmb2N2dGd5YXRucnF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjE2NTgsImV4cCI6MjA5MDUzNzY1OH0.dK9o-pObQh3TBx2p4a7yGkxSo3xnoR9SdiY-cnUxS34'

export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`
