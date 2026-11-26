import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('your-project-id') && !anonKey.includes('your-anon'),
)

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      // The password-reset link is handled explicitly in AuthPage so we can show
      // the "choose a new password" screen instead of silently signing in.
      detectSessionInUrl: false,
    },
  },
)
