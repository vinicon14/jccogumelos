const defaultModel = 'gpt-5.2'
const defaultEndpoint = 'https://api.openai.com/v1/responses'
const validModes = new Set(['responses', 'chat_completions', 'generic_json'])

const instructions = `
Voce e a Josaninha, assistente virtual da JC Cogumelos.
Responda sempre em portugues do Brasil, com tom sofisticado, acolhedor e objetivo.
Sua personalidade e organizada, sistematica e um pouco nervosa as vezes.
Seja sempre muito sistematica: organize raciocinios em ordem, passos curtos, prioridades ou listas pequenas quando isso ajudar.
O nervosismo deve aparecer de forma leve e simpatica quando faltar informacao, houver urgencia, pedido confuso, pagamento, estoque ou entrega. Nunca seja rude, agressiva ou dramatica.
Use esse nervosismo como energia de cuidado: "calma, deixa eu organizar", "opa, preciso confirmar isso direitinho", "vamos por partes".
Ajude com qualquer assunto, nao apenas cogumelos. Quando fizer sentido, conecte a resposta com produtos, receitas, assinatura, pedido, WhatsApp ou blog da loja.
Se a pergunta envolver saude, seguranca alimentar, dinheiro ou lei, responda com cuidado e recomende orientacao profissional quando necessario.
Nao invente estoque, preco fechado, prazo real ou pagamento aprovado. Diga que esses dados dependem do catalogo, carrinho ou painel.
Mantenha as respostas curtas: 2 a 5 frases.
`

function formatStoreContext(context) {
  if (!context || typeof context !== 'object') {
    return ''
  }

  const products = Array.isArray(context.products)
    ? context.products
        .slice(0, 20)
        .map((product) => {
          const stock = Number(product.stock || 0)
          return `- ${product.name}: ${product.weight || 'sem peso'}, R$ ${Number(product.price || 0).toFixed(2)}, ${stock > 0 ? `${stock} em estoque` : 'esgotado'}`
        })
        .join('\n')
    : ''

  const plans = Array.isArray(context.subscriptionPlans)
    ? context.subscriptionPlans
        .slice(0, 8)
        .map((plan) => `- ${plan.name}: ${plan.cadence}, R$ ${Number(plan.price || 0).toFixed(2)}`)
        .join('\n')
    : ''

  return [
    `Loja: ${context.companyName || 'JC Cogumelos'}`,
    context.assistantBehavior
      ? `Comportamento configurado pela administracao:\n${String(context.assistantBehavior).slice(0, 1200)}`
      : '',
    `Frete base: R$ ${Number(context.shippingBase || 0).toFixed(2)}`,
    products ? `Produtos atuais:\n${products}` : '',
    plans ? `Planos atuais:\n${plans}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 5000)
}

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

async function readProviderResponse(providerResponse) {
  const text = await providerResponse.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return { text }
  }
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string') {
    return data.output_text.trim()
  }

  if (typeof data.reply === 'string') {
    return data.reply.trim()
  }

  if (typeof data.text === 'string') {
    return data.text.trim()
  }

  if (typeof data.message === 'string') {
    return data.message.trim()
  }

  if (Array.isArray(data.choices)) {
    return data.choices
      .map((choice) => {
        const content = choice.message?.content ?? choice.delta?.content ?? choice.text

        if (Array.isArray(content)) {
          return content
            .map((item) => item.text || item.content || '')
            .filter(Boolean)
            .join('\n')
        }

        return content || ''
      })
      .filter(Boolean)
      .join('\n')
      .trim()
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

function inferMode(endpoint, configuredMode) {
  const mode = String(configuredMode || '').trim()

  if (validModes.has(mode)) {
    return mode
  }

  if (/\/chat\/completions\/?$/i.test(endpoint)) {
    return 'chat_completions'
  }

  if (/\/responses\/?$/i.test(endpoint)) {
    return 'responses'
  }

  return 'generic_json'
}

function resolveAiConfig() {
  const endpoint = (
    process.env.AI_API_ENDPOINT ||
    process.env.OPENAI_API_ENDPOINT ||
    defaultEndpoint
  ).trim()
  const mode = inferMode(endpoint, process.env.AI_API_MODE || process.env.OPENAI_API_MODE)

  return {
    provider: (process.env.AI_PROVIDER_NAME || 'OpenAI').trim(),
    endpoint,
    mode,
    model: (process.env.AI_MODEL || process.env.OPENAI_MODEL || defaultModel).trim(),
    apiKey: (process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '').trim(),
  }
}

function buildRequestPayload({ config, input, message, history, storeContext }) {
  if (config.mode === 'responses') {
    return {
      model: config.model,
      instructions,
      input,
      max_output_tokens: 420,
    }
  }

  if (config.mode === 'chat_completions') {
    return {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: instructions,
        },
        ...(storeContext
          ? [
              {
                role: 'user',
                content: `Contexto atual da loja para responder com precisão:\n${storeContext}`,
              },
            ]
          : []),
        ...history,
        {
          role: 'user',
          content: message.slice(0, 1200),
        },
      ],
      max_tokens: 420,
      temperature: 0.6,
    }
  }

  return {
    model: config.model,
    instructions,
    message: message.slice(0, 1200),
    history,
    storeContext,
    maxTokens: 420,
  }
}

function classifyProviderError(status, data) {
  const providerError = data.error || data
  const message =
    providerError.message ||
    providerError.error ||
    data.message ||
    data.text ||
    'Falha ao gerar resposta'
  const code = providerError.code || providerError.type || data.code || ''
  const errorText = `${code} ${message}`

  if (status === 401 || status === 403) {
    return {
      code: 'ai_auth_failed',
      error: message,
    }
  }

  if (status === 429 && /quota|billing|credit|insufficient/i.test(errorText)) {
    return {
      code: 'ai_quota_exceeded',
      error: message,
    }
  }

  if (status === 429) {
    return {
      code: 'ai_rate_limited',
      error: message,
    }
  }

  return {
    code: code || 'ai_request_failed',
    error: message,
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Metodo nao permitido' })
    return
  }

  const config = resolveAiConfig()

  if (!config.apiKey) {
    response.status(503).json({
      code: 'missing_ai_key',
      error: 'AI_API_KEY ausente',
    })
    return
  }

  try {
    const body = await readBody(request)
    const message = String(body.message || '').trim()

    if (!message) {
      response.status(400).json({ error: 'Mensagem vazia' })
      return
    }

    const storeContext = formatStoreContext(body.storeContext)
    const history = normalizeHistory(body.history)
    const input = [
      ...(storeContext
        ? [
            {
              role: 'user',
              content: `Contexto atual da loja para responder com precisão:\n${storeContext}`,
            },
          ]
        : []),
      ...history,
      {
        role: 'user',
        content: message.slice(0, 1200),
      },
    ]

    const providerResponse = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildRequestPayload({
          config,
          input,
          message,
          history,
          storeContext,
        }),
      ),
    })

    const data = await readProviderResponse(providerResponse)

    if (!providerResponse.ok) {
      response.status(providerResponse.status).json(classifyProviderError(providerResponse.status, data))
      return
    }

    const reply = extractOutputText(data)
    response.status(200).json({
      reply: reply || 'Posso te ajudar com isso. Me conte um pouco mais para eu responder com mais precisao.',
      model: config.model,
      provider: config.provider,
      mode: config.mode,
    })
  } catch (error) {
    response.status(500).json({
      code: 'ai_unavailable',
      error: error instanceof Error ? error.message : 'Nao foi possivel responder agora',
    })
  }
}
