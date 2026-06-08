import { supabase } from '../lib/supabase'

const APP_STATE_TABLE = 'app_state'
const warnedRemoteIds = new Set<string>()

function warnRemoteOnce(id: string, error: unknown) {
  if (warnedRemoteIds.has(id)) {
    return
  }

  warnedRemoteIds.add(id)
  console.warn(
    `Persistência Supabase indisponível para "${id}". Usando fallback local.`,
    error,
  )
}

export async function loadRemotePayload<T>(id: string): Promise<T | null> {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from(APP_STATE_TABLE)
    .select('payload')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    warnRemoteOnce(id, error)
    return null
  }

  return (data?.payload as T | undefined) ?? null
}

export async function saveRemotePayload<T>(id: string, payload: T) {
  if (!supabase) {
    return false
  }

  const { error } = await supabase.from(APP_STATE_TABLE).upsert({
    id,
    payload,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    warnRemoteOnce(id, error)
    return false
  }

  return true
}

export function subscribeRemotePayload<T>(
  id: string,
  onPayload: (payload: T) => void,
) {
  if (!supabase) {
    return () => undefined
  }

  const client = supabase
  const channel = client
    .channel(`jc-cogumelos-${id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: APP_STATE_TABLE,
        filter: `id=eq.${id}`,
      },
      (change) => {
        const row = change.new as { payload?: T } | null

        if (row?.payload) {
          onPayload(row.payload)
        }
      },
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}
