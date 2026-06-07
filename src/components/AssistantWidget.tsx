import { Bot, Mic, Send, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../context/useStore'

interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: SpeechRecognitionAlternativeLike
    }
  }
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const initialMessages: ChatMessage[] = [
  {
    role: 'assistant',
    text: 'Oi, eu sou a Josaninha. Pode perguntar qualquer coisa: produtos, receitas, pedidos ou uma dúvida do dia a dia.',
  },
]

async function requestJosaninhaReply(
  message: string,
  history: ChatMessage[],
  storeContext: unknown,
) {
  const response = await fetch('/api/josaninha', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history: history.slice(-8),
      storeContext,
    }),
  })

  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json')
    ? ((await response.json()) as { reply?: string; error?: string; code?: string; model?: string })
    : {}

  if (!response.ok) {
    throw new Error(data.error || 'Resposta indisponível')
  }

  const reply = data.reply?.trim()

  if (!reply) {
    throw new Error('Resposta vazia')
  }

  return reply
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export function AssistantWidget() {
  const { products, subscriptionPlans, settings } = useStore()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const speechRecognition = useMemo(() => getSpeechRecognitionConstructor(), [])
  const storeContext = useMemo(
    () => ({
      companyName: settings.companyName,
      shippingBase: settings.shippingBase,
      products: products.map((product) => ({
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        weight: product.weight,
        description: product.description,
      })),
      subscriptionPlans: subscriptionPlans.map((plan) => ({
        name: plan.name,
        cadence: plan.cadence,
        price: plan.price,
        description: plan.description,
      })),
    }),
    [products, settings.companyName, settings.shippingBase, subscriptionPlans],
  )

  async function sendMessage() {
    const text = input.trim()
    if (!text || thinking) {
      return
    }

    const userMessage: ChatMessage = { role: 'user', text }
    const nextHistory = [...messages, userMessage]

    setMessages((current) => [...current, userMessage])
    setInput('')
    setThinking(true)

    try {
      const reply = await requestJosaninhaReply(text, nextHistory, storeContext)
      setMessages((current) => [...current, { role: 'assistant', text: reply }])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text:
            error instanceof Error && error.message.includes('OPENAI_API_KEY')
              ? 'A Josaninha ainda não está conectada ao GPT porque falta configurar a OPENAI_API_KEY no servidor.'
              : 'Não consegui falar com o GPT agora. Tente novamente em instantes.',
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  function handleVoiceClick() {
    if (!speechRecognition) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: 'Seu navegador ainda não liberou captura de áudio aqui. Pode digitar que eu sigo te ajudando.',
        },
      ])
      return
    }

    const recognition = new speechRecognition()

    recognition.lang = 'pt-BR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()

      if (transcript) {
        setInput((current) => (current ? `${current} ${transcript}` : transcript))
      }
    }
    recognition.onerror = () => {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: 'Não consegui ouvir com clareza agora. Pode tentar de novo ou digitar a mensagem.',
        },
      ])
    }
    recognition.onend = () => setListening(false)

    setListening(true)
    recognition.start()
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
      {open && (
        <section className="w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-[#d9b894] bg-[#fffaf2] shadow-2xl">
          <header className="flex items-center justify-between bg-[#28513c] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <strong>Josaninha</strong>
            </div>
            <button
              className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-white/15"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
            >
              <X size={18} />
            </button>
          </header>
          <div className="max-h-[360px] overflow-y-auto bg-[#fff7ec] p-4">
            <div className="grid gap-3">
              {messages.map((message, index) => (
                <p
                  key={`${message.role}-${index}`}
                  className={`max-w-[88%] rounded-[8px] px-3 py-2 text-sm leading-5 ${
                    message.role === 'assistant'
                      ? 'bg-white text-[#4d3929]'
                      : 'ml-auto bg-[#c95324] text-white'
                  }`}
                >
                  {message.text}
                </p>
              ))}
              {thinking && (
                <p className="max-w-[88%] rounded-[8px] bg-white px-3 py-2 text-sm leading-5 text-[#4d3929]">
                  Josaninha está pensando...
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-[#eadcc8] p-3">
            <button
              className={`icon-small ${listening ? 'bg-[#28513c] text-white' : ''}`}
              type="button"
              onClick={handleVoiceClick}
              aria-label="Usar áudio"
              title={listening ? 'Ouvindo' : 'Usar áudio'}
            >
              <Mic size={17} />
            </button>
            <input
              className="min-w-0 flex-1 rounded-[8px] border border-[#d8c8b6] bg-white px-3 py-2 text-sm outline-none focus:border-[#c95324]"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Pergunte qualquer coisa..."
            />
            <button
              className="icon-small bg-[#c95324] text-white hover:bg-[#a8421f]"
              type="button"
              onClick={sendMessage}
              disabled={thinking}
              aria-label="Enviar mensagem"
              title="Enviar"
            >
              <Send size={17} />
            </button>
          </div>
        </section>
      )}

      <button
        className="flex items-center gap-2 rounded-[8px] bg-[#c95324] px-4 py-3 font-black text-white shadow-xl transition hover:bg-[#a8421f]"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Bot size={21} />
        Josaninha
      </button>
    </div>
  )
}
