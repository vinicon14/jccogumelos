import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey)
}
