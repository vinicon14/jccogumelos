const defaultModel = process.env.OPENAI_MODEL || 'gpt-5.2'

const instructions = `
Voce e a Josaninha, assistente virtual da JC Cogumelos.
Responda sempre em portugues do Brasil, com tom sofisticado, acolhedor e objetivo.
Ajude com qualquer assunto, nao apenas cogumelos. Quando fizer sentido, conecte a resposta com produtos, receitas, assinatura, pedido, WhatsApp ou blog da loja.
Se a pergunta envolver saude, seguranca alimentar, dinheiro ou lei, responda com cuidado e recomende orientacao profissional quando necessario.
Nao invente estoque, preco fechado, prazo real ou pagamento aprovado. Diga que esses dados dependem do catalogo, carrinho ou painel.
Mantenha as respostas curtas: 2 a 5 frases.
`

async function readBody(request) {
  if (request.body) {
    return typeof request.body === 'string' ? JSON.parse(request.body) : request.body
  }

  const chunks = []
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk))
  }

  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string') {
    return data.output_text.trim()
  }

  if (!Array.isArray(data.output)) {
    return ''
  }

  return data.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((content) => content.text || content.output_text || '')
    .filter(Boolean)
    .join('\n')
    .trim()
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .slice(-8)
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.text || '').slice(0, 800),
    }))
    .filter((message) => message.content.trim())
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Metodo nao permitido' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    response.status(503).json({ error: 'OPENAI_API_KEY ausente' })
    return
  }

  try {
    const body = await readBody(request)
    const message = String(body.message || '').trim()

    if (!message) {
      response.status(400).json({ error: 'Mensagem vazia' })
      return
    }

    const input = [
      ...normalizeHistory(body.history),
      {
        role: 'user',
        content: message.slice(0, 1200),
      },
    ]

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: defaultModel,
        instructions,
        input,
        max_output_tokens: 420,
      }),
    })

    const data = await openaiResponse.json()

    if (!openaiResponse.ok) {
      response.status(openaiResponse.status).json({
        error: data.error?.message || 'Falha ao gerar resposta',
      })
      return
    }

    const reply = extractOutputText(data)
    response.status(200).json({
      reply: reply || 'Posso te ajudar com isso. Me conte um pouco mais para eu responder com mais precisao.',
      model: defaultModel,
    })
  } catch {
    response.status(500).json({ error: 'Nao foi possivel responder agora' })
  }
}
