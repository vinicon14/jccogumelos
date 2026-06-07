import { Bot, Mic, Send, X } from 'lucide-react'
import { useMemo, useState } from 'react'

interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
}

const initialMessages: ChatMessage[] = [
  {
    role: 'assistant',
    text: 'Oi, eu sou a Jozaninha. Pode perguntar qualquer coisa: produtos, receitas, pedidos ou uma dúvida do dia a dia.',
  },
]

function buildFallbackReply(message: string) {
  const normalized = message.toLowerCase()
  const cleanMessage = message.trim().replace(/\s+/g, ' ')

  if (normalized.includes('receita') || normalized.includes('preparar') || normalized.includes('cozinhar')) {
    return 'Para um preparo rápido: salteie shimeji com manteiga, alho, shoyu leve e finalize com cebolinha. Para risoto, o shitake premium entrega mais aroma.'
  }

  if (normalized.includes('assinatura') || normalized.includes('mensal')) {
    return 'Temos kits semanal, quinzenal e mensal. O plano mensal é ótimo para manter variedade em casa e acumular pontos de fidelidade.'
  }

  if (normalized.includes('atacado') || normalized.includes('restaurante')) {
    return 'Para atacado, recomendo o Kit Chef Semanal. Ele tem preço por volume e pode ser ajustado para restaurantes, mercados e chefs.'
  }

  if (normalized.includes('pedido') || normalized.includes('entrega')) {
    return 'Você pode acompanhar seus pedidos pela área do cliente: pagamento, separação, envio e entrega.'
  }

  if (normalized.includes('whatsapp')) {
    return 'O WhatsApp abre a conversa direta para tirar dúvidas e combinar pedidos com mais rapidez.'
  }

  if (normalized.includes('preço') || normalized.includes('valor') || normalized.includes('quanto custa')) {
    return 'Os valores ficam no catálogo e podem ser ajustados no painel de admin. Se você quiser uma escolha equilibrada, comece por shimeji para o dia a dia ou shitake para pratos com mais presença.'
  }

  if (
    normalized.includes('shimeji') ||
    normalized.includes('shitake') ||
    normalized.includes('shiitake') ||
    normalized.includes('portobello') ||
    normalized.includes('cogumelo')
  ) {
    return 'Boa escolha. Cogumelos mais delicados, como shimeji, combinam com preparos rápidos. Shitake e portobello aguentam receitas mais intensas, grelhados e molhos.'
  }

  return `Entendi sua pergunta sobre "${cleanMessage.slice(0, 90)}". De forma direta: posso te ajudar com isso e, se quiser conectar com a loja, transformo a ideia em sugestão de produto, preparo ou pedido.`
}

async function requestJozaninhaReply(message: string, history: ChatMessage[]) {
  const response = await fetch('/api/jozaninha', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history: history.slice(-8),
    }),
  })

  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.includes('application/json')) {
    throw new Error('Resposta indisponível')
  }

  const data = (await response.json()) as { reply?: string }
  const reply = data.reply?.trim()

  if (!reply) {
    throw new Error('Resposta vazia')
  }

  return reply
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [thinking, setThinking] = useState(false)
  const speechSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    [],
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
      const reply = await requestJozaninhaReply(text, nextHistory)
      setMessages((current) => [...current, { role: 'assistant', text: reply }])
    } catch {
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: buildFallbackReply(text) },
      ])
    } finally {
      setThinking(false)
    }
  }

  function handleVoiceClick() {
    if (!speechSupported) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: 'Seu navegador ainda não liberou captura de áudio aqui. Pode digitar que eu sigo te ajudando.',
        },
      ])
      return
    }

    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
          text: 'Entrada por voz detectada. Em breve, ela poderá transformar sua fala em mensagem para a Jozaninha.',
      },
    ])
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
      {open && (
        <section className="w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-[#d9b894] bg-[#fffaf2] shadow-2xl">
          <header className="flex items-center justify-between bg-[#28513c] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <strong>Jozaninha</strong>
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
                  Jozaninha está pensando...
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-[#eadcc8] p-3">
            <button
              className="icon-small"
              type="button"
              onClick={handleVoiceClick}
              aria-label="Usar áudio"
              title="Usar áudio"
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
        Jozaninha
      </button>
    </div>
  )
}
