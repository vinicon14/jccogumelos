import { supabase } from '../lib/supabase'

const CHAT_SESSION_KEY = 'jc-cogumelos-chat-session'
const CHAT_LOCAL_KEY = 'jc-cogumelos-chat-messages'

interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
}

function getOrCreateSessionId(): string {
  let id = window.localStorage.getItem(CHAT_SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    window.localStorage.setItem(CHAT_SESSION_KEY, id)
  }
  return id
}

function loadLocalMessages(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(CHAT_LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalMessages(messages: ChatMessage[]) {
  window.localStorage.setItem(CHAT_LOCAL_KEY, JSON.stringify(messages))
}

export async function loadChatHistory(): Promise<ChatMessage[] | null> {
  if (!supabase) {
    return null
  }

  const sessionId = getOrCreateSessionId()

  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, text')
    .eq('session_id', sessionId)
    .order('id', { ascending: true })

  if (error) {
    return null
  }

  if (data && data.length > 0) {
    const messages = data as ChatMessage[]
    saveLocalMessages(messages)
    return messages
  }

  return null
}

export async function saveChatMessage(message: ChatMessage) {
  const localMessages = loadLocalMessages()
  localMessages.push(message)
  saveLocalMessages(localMessages)

  if (!supabase) {
    return
  }

  const sessionId = getOrCreateSessionId()

  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: message.role,
    text: message.text,
  })
}

export async function clearChatHistory() {
  window.localStorage.removeItem(CHAT_LOCAL_KEY)

  if (!supabase) {
    return
  }

  const sessionId = getOrCreateSessionId()

  await supabase
    .from('chat_messages')
    .delete()
    .eq('session_id', sessionId)
}
