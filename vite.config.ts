import { createHmac, pbkdf2Sync, randomUUID, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

interface OpenAIResponsePayload {
  output_text?: string
  reply?: string
  text?: string
  message?: string
  code?: string
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  choices?: Array<{
    text?: string
    message?: {
      content?: string | Array<{ text?: string; content?: string }>
    }
    delta?: {
      content?: string
    }
  }>
  output?: Array<{
    content?: Array<{
      text?: string
      output_text?: string
    }>
  }>
  error?: {
    message?: string
    code?: string
    type?: string
    status?: string
  }
}

interface MercadoPagoPaymentPayload {
  amount?: unknown
  orderId?: unknown
  description?: unknown
  expirationMinutes?: unknown
  idempotencyKey?: unknown
  payerEmail?: unknown
  customer?: {
    name?: unknown
    email?: unknown
  }
  items?: Array<{
    id?: unknown
    name?: unknown
    quantity?: unknown
    unitPrice?: unknown
    price?: unknown
  }>
}

interface MercadoPagoResponsePayload {
  id?: unknown
  status?: unknown
  status_detail?: unknown
  external_reference?: unknown
  transaction_amount?: unknown
  total_paid_amount?: unknown
  date_approved?: unknown
  message?: string
  error?: string
  cause?: unknown
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
      ticket_url?: string
    }
  }
  transactions?: {
    payments?: Array<{
      id?: unknown
      status?: unknown
      status_detail?: unknown
      payment_method?: {
        qr_code?: string
        qrCode?: string
        qr_code_text?: string
        qr_code_base64?: string
        qrCodeBase64?: string
        ticket_url?: string
        ticketUrl?: string
      }
    }>
  }
  transaction?: {
    payments?: Array<{
      id?: unknown
      status?: unknown
      status_detail?: unknown
      payment_method?: Record<string, unknown>
    }>
  }
  payments?: Array<{
    id?: unknown
    status?: unknown
    status_detail?: unknown
    payment_method?: Record<string, unknown>
  }>
}

interface VercelEnvResponsePayload {
  message?: string
  error?: {
    message?: string
  }
  failed?: Array<{
    error?: {
      message?: string
    }
  }>
}

const josaninhaInstructions = `
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

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

const validAiModes = new Set([
  'responses',
  'chat_completions',
  'gemini',
  'generic_json',
])

const allowedAdminSecrets = {
  MERCADO_PAGO_ACCESS_TOKEN: {
    label: 'Access Token Mercado Pago',
    validate(value: string) {
      return value.trim().length >= 30
    },
  },
  OPENAI_API_KEY: {
    label: 'Chave GPT / OpenAI',
    validate(value: string) {
      const token = value.trim()
      return token.startsWith('sk-') && token.length >= 40
    },
  },
  AI_API_KEY: {
    label: 'Chave da API da Josaninha',
    validate(value: string) {
      return value.trim().length >= 10
    },
  },
  AI_PROVIDER_NAME: {
    label: 'Provedor da Josaninha',
    validate(value: string) {
      const name = value.trim()
      return name.length >= 2 && name.length <= 80
    },
  },
  AI_API_ENDPOINT: {
    label: 'Endpoint da API da Josaninha',
    validate(value: string) {
      try {
        const url = new URL(value.trim())
        return url.protocol === 'https:' && url.hostname.length > 3
      } catch {
        return false
      }
    },
  },
  AI_MODEL: {
    label: 'Modelo da Josaninha',
    validate(value: string) {
      const model = value.trim()
      return model.length >= 1 && model.length <= 120
    },
  },
  AI_API_MODE: {
    label: 'Modo da API da Josaninha',
    validate(value: string) {
      return validAiModes.has(value.trim())
    },
  },
}

type AllowedAdminSecretKey = keyof typeof allowedAdminSecrets

function isAllowedAdminSecretKey(key: string): key is AllowedAdminSecretKey {
  return key in allowedAdminSecrets
}

function normalizeAdminSecretEntries(body: {
  key?: unknown
  value?: unknown
  entries?: Array<{ key?: unknown; value?: unknown }>
  secrets?: Record<string, unknown>
}) {
  if (Array.isArray(body.entries)) {
    return body.entries.map((entry) => ({
      key: String(entry.key || '').trim(),
      value: String(entry.value || '').trim(),
    }))
  }

  if (body.secrets && typeof body.secrets === 'object') {
    return Object.entries(body.secrets).map(([key, value]) => ({
      key: String(key || '').trim(),
      value: String(value || '').trim(),
    }))
  }

  return [
    {
      key: String(body.key || '').trim(),
      value: String(body.value || '').trim(),
    },
  ]
}

function getVercelProjectId(env: Record<string, string>) {
  return (
    env.VERCEL_TARGET_PROJECT_ID ||
    env.VERCEL_PROJECT_ID ||
    env.VERCEL_PROJECT_NAME ||
    'jccogumelos'
  ).trim()
}

function getVercelTeamId(env: Record<string, string>) {
  return (
    env.VERCEL_TARGET_TEAM_ID ||
    env.VERCEL_TEAM_ID ||
    env.VERCEL_ORG_ID ||
    ''
  ).trim()
}

async function triggerVercelRedeploy(env: Record<string, string>) {
  const redeployHookUrl = env.VERCEL_REDEPLOY_HOOK_URL?.trim()

  if (!redeployHookUrl) {
    return 'not_configured'
  }

  const redeployResponse = await fetch(redeployHookUrl, { method: 'POST' })
  return redeployResponse.ok ? 'triggered' : 'failed'
}

async function upsertVercelSecret(
  env: Record<string, string>,
  key: AllowedAdminSecretKey,
  value: string,
  options: { redeploy?: boolean } = {},
) {
  const vercelToken = env.VERCEL_API_TOKEN?.trim()
  const projectId = getVercelProjectId(env)
  const teamId = getVercelTeamId(env)

  if (!vercelToken) {
    return {
      status: 503,
      body: {
        code: 'missing_vercel_api_token',
        error: 'Configure VERCEL_API_TOKEN na Vercel para salvar secrets pelo painel.',
      },
    }
  }

  if (!projectId) {
    return {
      status: 503,
      body: {
        code: 'missing_vercel_project_id',
        error: 'Configure VERCEL_PROJECT_ID ou VERCEL_TARGET_PROJECT_ID.',
      },
    }
  }

  const url = new URL(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env`,
  )
  url.searchParams.set('upsert', 'true')

  if (teamId) {
    url.searchParams.set('teamId', teamId)
  }

  const vercelResponse = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type: 'sensitive',
      target: ['production'],
      comment: `${allowedAdminSecrets[key].label} salvo pelo painel administrativo da JC Cogumelos.`,
    }),
  })
  const data = (await vercelResponse.json()) as VercelEnvResponsePayload

  if (!vercelResponse.ok || data.failed?.length) {
    const firstFailure = data.failed?.[0]?.error
    return {
      status: vercelResponse.ok ? 400 : vercelResponse.status,
      body: {
        error:
          firstFailure?.message ||
          data.error?.message ||
          data.message ||
          'A Vercel recusou a atualização do secret.',
      },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      key,
      label: allowedAdminSecrets[key].label,
      target: 'production',
      redeploy: options.redeploy === false ? 'not_configured' : await triggerVercelRedeploy(env),
    },
  }
}

function getHeader(request: IncomingMessage, name: string) {
  const value = request.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function getMercadoPagoAccessToken(env: Record<string, string>) {
  return (
    env.MERCADO_PAGO_ACCESS_TOKEN ||
    env.MP_ACCESS_TOKEN ||
    env.BANK_PAYMENT_API_SECRET ||
    ''
  ).trim()
}

function getMercadoPagoWebhookSecret(env: Record<string, string>) {
  return (env.MERCADO_PAGO_WEBHOOK_SECRET || env.BANK_PAYMENT_WEBHOOK_SECRET || '').trim()
}

function getMercadoPagoQueryParam(request: IncomingMessage, name: string) {
  const url = new URL(request.url || '/', 'http://localhost')
  return url.searchParams.get(name) || ''
}

function getMercadoPagoNotificationUrl(
  env: Record<string, string>,
  request: IncomingMessage,
) {
  if (env.MERCADO_PAGO_WEBHOOK_URL) {
    return env.MERCADO_PAGO_WEBHOOK_URL
  }

  const host = getHeader(request, 'x-forwarded-host') || getHeader(request, 'host')
  const protocol = getHeader(request, 'x-forwarded-proto') || 'http'
  return host ? `${protocol}://${host}/api/mercado-pago-webhook` : undefined
}

function sanitizeMercadoPagoAmount(amount: unknown) {
  const value = Number(amount)
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : 0
}

function createMercadoPagoPaymentPayload(
  env: Record<string, string>,
  body: MercadoPagoPaymentPayload,
  request: IncomingMessage,
) {
  const amount = sanitizeMercadoPagoAmount(body.amount)
  const minutes = Math.max(Number(body.expirationMinutes || 30), 30)
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  const orderId = String(body.orderId || `JC-${Date.now()}`)
  const customer = body.customer || {}
  const payerEmail = String(customer.email || body.payerEmail || '').trim()

  return {
    transaction_amount: amount,
    description: String(body.description || `Pedido ${orderId} - JC Cogumelos`).slice(0, 255),
    payment_method_id: 'pix',
    external_reference: orderId,
    notification_url: getMercadoPagoNotificationUrl(env, request),
    date_of_expiration: expiresAt,
    payer: {
      email: payerEmail,
      first_name: String(customer.name || 'Cliente').split(' ')[0],
    },
    additional_info: {
      items: Array.isArray(body.items)
        ? body.items.slice(0, 30).map((item) => ({
            id: String(item.id || item.name || randomUUID()).slice(0, 64),
            title: String(item.name || 'Produto JC Cogumelos').slice(0, 128),
            quantity: Number(item.quantity || 1),
            unit_price: sanitizeMercadoPagoAmount(item.unitPrice || item.price || 0),
          }))
        : [],
    },
  }
}

function createMercadoPagoOrderPayload(
  env: Record<string, string>,
  body: MercadoPagoPaymentPayload,
  request: IncomingMessage,
) {
  const amount = sanitizeMercadoPagoAmount(body.amount)
  const minutes = Math.max(Number(body.expirationMinutes || 30), 30)
  const orderId = String(body.orderId || `JC-${Date.now()}`)
  const customer = body.customer || {}

  return {
    type: 'online',
    total_amount: amount.toFixed(2),
    external_reference: orderId,
    processing_mode: 'automatic',
    notification_url: getMercadoPagoNotificationUrl(env, request),
    transactions: {
      payments: [
        {
          amount: amount.toFixed(2),
          payment_method: {
            id: 'pix',
            type: 'bank_transfer',
          },
          expiration_time: `PT${minutes}M`,
        },
      ],
    },
    payer: {
      email: String(customer.email || body.payerEmail || '').trim(),
    },
  }
}

function parseMercadoPagoPayment(data: MercadoPagoResponsePayload, mode: string) {
  const orderPayment =
    data.transactions?.payments?.[0] ||
    data.transaction?.payments?.[0] ||
    data.payments?.[0] ||
    {}
  const paymentMethod =
    orderPayment.payment_method ||
    data.point_of_interaction?.transaction_data ||
    {}

  const qrCode =
    ('qr_code' in paymentMethod ? paymentMethod.qr_code : '') ||
    ('qrCode' in paymentMethod ? paymentMethod.qrCode : '') ||
    ('qr_code_text' in paymentMethod ? paymentMethod.qr_code_text : '') ||
    data.point_of_interaction?.transaction_data?.qr_code ||
    ''
  const qrCodeBase64 =
    ('qr_code_base64' in paymentMethod ? paymentMethod.qr_code_base64 : '') ||
    ('qrCodeBase64' in paymentMethod ? paymentMethod.qrCodeBase64 : '') ||
    data.point_of_interaction?.transaction_data?.qr_code_base64 ||
    ''
  const ticketUrl =
    ('ticket_url' in paymentMethod ? paymentMethod.ticket_url : '') ||
    ('ticketUrl' in paymentMethod ? paymentMethod.ticketUrl : '') ||
    data.point_of_interaction?.transaction_data?.ticket_url ||
    ''

  return {
    provider: 'mercado_pago',
    mode,
    paymentId: String(orderPayment.id || data.id || ''),
    orderId: String(data.id || ''),
    status: String(orderPayment.status || data.status || 'pending'),
    statusDetail: String(orderPayment.status_detail || data.status_detail || ''),
    externalReference: String(data.external_reference || ''),
    qrCode: String(qrCode || ''),
    qrCodeBase64: String(qrCodeBase64 || ''),
    ticketUrl: String(ticketUrl || ''),
    rawStatus: data.status || orderPayment.status || null,
  }
}

async function generateMercadoPagoPix(
  env: Record<string, string>,
  bodyText: string,
  request: IncomingMessage,
) {
  const accessToken = getMercadoPagoAccessToken(env)
  if (!accessToken) {
    return {
      status: 503,
      body: {
        code: 'missing_mercado_pago_access_token',
        error: 'Configure MERCADO_PAGO_ACCESS_TOKEN na Vercel para gerar Pix Mercado Pago.',
      },
    }
  }

  const body = JSON.parse(bodyText || '{}') as MercadoPagoPaymentPayload
  const amount = sanitizeMercadoPagoAmount(body.amount)
  const payerEmail = String(body.customer?.email || body.payerEmail || '').trim()

  if (!amount || !payerEmail) {
    return { status: 400, body: { error: 'Informe valor do pedido e e-mail do pagador.' } }
  }

  const mode = (env.MERCADO_PAGO_API_MODE || 'payments').toLowerCase()
  const baseUrl = env.MERCADO_PAGO_API_BASE || 'https://api.mercadopago.com'
  const endpoint = mode === 'orders' ? '/v1/orders' : '/v1/payments'
  const payload =
    mode === 'orders'
      ? createMercadoPagoOrderPayload(env, body, request)
      : createMercadoPagoPaymentPayload(env, body, request)

  const mercadoPagoResponse = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': String(
        body.idempotencyKey || `${String(body.orderId || 'JC')}-${Math.round(amount * 100)}`,
      ),
    },
    body: JSON.stringify(payload),
  })
  const data = (await mercadoPagoResponse.json()) as MercadoPagoResponsePayload

  if (!mercadoPagoResponse.ok) {
    return {
      status: mercadoPagoResponse.status,
      body: {
        error: data.message || data.error || 'Mercado Pago recusou a criacao do Pix.',
        details: data.cause || data,
      },
    }
  }

  return {
    status: 200,
    body: {
      payment: parseMercadoPagoPayment(data, mode === 'orders' ? 'orders' : 'payments'),
    },
  }
}

function parseMercadoPagoSignature(signatureHeader: string | undefined) {
  return String(signatureHeader || '')
    .split(',')
    .map((part) => part.split('='))
    .reduce<Record<string, string>>((result, [key, value]) => {
      result[String(key || '').trim()] = String(value || '').trim()
      return result
    }, {})
}

function safeCompareHex(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected || '', 'hex')
  const actualBuffer = Buffer.from(actual || '', 'hex')

  return (
    expectedBuffer.length > 0 &&
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  )
}

function verifyMercadoPagoWebhook(env: Record<string, string>, request: IncomingMessage) {
  const secret = getMercadoPagoWebhookSecret(env)
  if (!secret) {
    return { configured: false, valid: true }
  }

  const { ts, v1 } = parseMercadoPagoSignature(getHeader(request, 'x-signature'))
  const requestId = getHeader(request, 'x-request-id')
  const dataId = getMercadoPagoQueryParam(request, 'data.id')

  if (!ts || !v1) {
    return { configured: true, valid: false }
  }

  const manifest = [
    dataId ? `id:${dataId};` : '',
    requestId ? `request-id:${requestId};` : '',
    `ts:${ts};`,
  ].join('')
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  return { configured: true, valid: safeCompareHex(expected, v1) }
}

function parseMercadoPagoStatus(data: MercadoPagoResponsePayload) {
  return {
    provider: 'mercado_pago',
    paymentId: String(data.id || ''),
    status: String(data.status || 'pending'),
    statusDetail: String(data.status_detail || ''),
    externalReference: String(data.external_reference || ''),
    amount: Number(data.transaction_amount || data.total_paid_amount || 0),
    paidAt: data.date_approved || null,
  }
}

async function getMercadoPagoStatus(
  env: Record<string, string>,
  bodyText: string,
  request: IncomingMessage,
) {
  const accessToken = getMercadoPagoAccessToken(env)
  if (!accessToken) {
    return {
      status: 503,
      body: {
        code: 'missing_mercado_pago_access_token',
        error: 'Configure MERCADO_PAGO_ACCESS_TOKEN na Vercel para consultar pagamentos.',
      },
    }
  }

  const body = request.method === 'POST' ? JSON.parse(bodyText || '{}') : {}
  const paymentId = String(
    body.paymentId ||
      getMercadoPagoQueryParam(request, 'paymentId') ||
      getMercadoPagoQueryParam(request, 'id') ||
      '',
  ).trim()

  if (!paymentId) {
    return { status: 400, body: { error: 'Informe o paymentId do Mercado Pago.' } }
  }

  const baseUrl = env.MERCADO_PAGO_API_BASE || 'https://api.mercadopago.com'
  const mercadoPagoResponse = await fetch(`${baseUrl}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const data = (await mercadoPagoResponse.json()) as MercadoPagoResponsePayload

  if (!mercadoPagoResponse.ok) {
    return {
      status: mercadoPagoResponse.status,
      body: {
        error: data.message || data.error || 'Nao foi possivel consultar o pagamento.',
        details: data.cause || data,
      },
    }
  }

  return { status: 200, body: { payment: parseMercadoPagoStatus(data) } }
}

function verifyPassword(password: string, encodedHash: string) {
  const parts = encodedHash.includes('$') ? encodedHash.split('$') : encodedHash.split(':')
  const [algorithm, iterationsText, salt, hash] = parts
  const iterations = Number(iterationsText)

  if (
    algorithm !== 'pbkdf2_sha256' ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100000 ||
    !salt ||
    !hash
  ) {
    return false
  }

  const expected = Buffer.from(hash, 'base64')
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, 'sha256')

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function getAdminSecret(email: string, passwordHash: string, env: Record<string, string>) {
  return env.ADMIN_SESSION_SECRET || `${email}:${passwordHash}`
}

function signTokenPayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function createAdminToken(email: string, secret: string) {
  const adminExpiresAt = Date.now() + 8 * 60 * 60 * 1000
  const payload = Buffer.from(
    JSON.stringify({ sub: email, role: 'admin', exp: adminExpiresAt }),
  ).toString('base64url')

  return {
    adminToken: `${payload}.${signTokenPayload(payload, secret)}`,
    adminExpiresAt,
  }
}

function verifyAdminToken(token: unknown, email: string, secret: string) {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature) {
    return null
  }

  const expected = signTokenPayload(payload, secret)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    sub?: string
    role?: string
    exp?: number
  }

  if (decoded.role !== 'admin' || decoded.sub !== email || !decoded.exp || decoded.exp < Date.now()) {
    return null
  }

  return decoded
}

function extractOutputText(data: OpenAIResponsePayload) {
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

  if (Array.isArray(data.candidates)) {
    return data.candidates
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text || '')
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (!Array.isArray(data.output)) {
    return ''
  }

  return data.output
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text || content.output_text || '')
    .filter(Boolean)
    .join('\n')
    .trim()
}

function normalizeHistory(history: unknown) {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .slice(-8)
    .map((message) => {
      const item = message as { role?: unknown; text?: unknown }

      return {
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.text || '').slice(0, 800),
      }
    })
    .filter((message) => message.content.trim())
}

function formatStoreContext(context: unknown) {
  if (!context || typeof context !== 'object') {
    return ''
  }

  const storeContext = context as {
    companyName?: unknown
    assistantBehavior?: unknown
    shippingBase?: unknown
    products?: Array<{
      name?: unknown
      weight?: unknown
      price?: unknown
      stock?: unknown
    }>
    subscriptionPlans?: Array<{
      name?: unknown
      cadence?: unknown
      price?: unknown
    }>
  }

  const products = Array.isArray(storeContext.products)
    ? storeContext.products
        .slice(0, 20)
        .map((product) => {
          const stock = Number(product.stock || 0)
          return `- ${String(product.name || 'Produto')}: ${String(product.weight || 'sem peso')}, R$ ${Number(product.price || 0).toFixed(2)}, ${
            stock > 0 ? `${stock} em estoque` : 'esgotado'
          }`
        })
        .join('\n')
    : ''

  const plans = Array.isArray(storeContext.subscriptionPlans)
    ? storeContext.subscriptionPlans
        .slice(0, 8)
        .map(
          (plan) =>
            `- ${String(plan.name || 'Plano')}: ${String(plan.cadence || 'cadencia')}, R$ ${Number(plan.price || 0).toFixed(2)}`,
        )
        .join('\n')
    : ''

  return [
    `Loja: ${String(storeContext.companyName || 'JC Cogumelos')}`,
    storeContext.assistantBehavior
      ? `Comportamento configurado pela administracao:\n${String(storeContext.assistantBehavior).slice(0, 1200)}`
      : '',
    `Frete base: R$ ${Number(storeContext.shippingBase || 0).toFixed(2)}`,
    products ? `Produtos atuais:\n${products}` : '',
    plans ? `Planos atuais:\n${plans}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 5000)
}

type AiMode = 'responses' | 'chat_completions' | 'gemini' | 'generic_json'

interface AiConfig {
  provider: string
  endpoint: string
  mode: AiMode
  model: string
  apiKey: string
}

async function readProviderResponse(providerResponse: Response) {
  const text = await providerResponse.text()

  if (!text) {
    return {} as OpenAIResponsePayload
  }

  try {
    return JSON.parse(text) as OpenAIResponsePayload
  } catch {
    return { text } as OpenAIResponsePayload
  }
}

function inferAiMode(endpoint: string, configuredMode?: string): AiMode {
  const mode = String(configuredMode || '').trim()

  if (validAiModes.has(mode)) {
    return mode as AiMode
  }

  if (/\/chat\/completions\/?$/i.test(endpoint)) {
    return 'chat_completions'
  }

  if (/\/responses\/?$/i.test(endpoint)) {
    return 'responses'
  }

  if (/generativelanguage\.googleapis\.com|:generateContent$/i.test(endpoint)) {
    return 'gemini'
  }

  return 'generic_json'
}

function resolveAiConfig(env: Record<string, string>): AiConfig {
  const endpoint = (
    env.AI_API_ENDPOINT ||
    env.OPENAI_API_ENDPOINT ||
    'https://api.openai.com/v1/responses'
  ).trim()

  return {
    provider: (env.AI_PROVIDER_NAME || 'OpenAI').trim(),
    endpoint,
    mode: inferAiMode(endpoint, env.AI_API_MODE || env.OPENAI_API_MODE),
    model: (env.AI_MODEL || env.OPENAI_MODEL || 'gpt-4o').trim(),
    apiKey: (env.AI_API_KEY || env.OPENAI_API_KEY || '').trim(),
  }
}

function resolveProviderEndpoint(config: AiConfig) {
  if (
    config.mode === 'gemini' &&
    (config.endpoint.includes('{model}') || /%7Bmodel%7D/i.test(config.endpoint))
  ) {
    return config.endpoint
      .replaceAll('{model}', encodeURIComponent(config.model))
      .replace(/%7Bmodel%7D/gi, encodeURIComponent(config.model))
  }

  return config.endpoint
}

function buildAiRequestPayload({
  config,
  input,
  message,
  history,
  storeContext,
}: {
  config: AiConfig
  input: Array<{ role: string; content: string }>
  message: string
  history: Array<{ role: string; content: string }>
  storeContext: string
}) {
  if (config.mode === 'responses') {
    return {
      model: config.model,
      instructions: josaninhaInstructions,
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
          content: josaninhaInstructions,
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

  if (config.mode === 'gemini') {
    const systemContext = [
      josaninhaInstructions,
      storeContext
        ? `Contexto atual da loja para responder com precisão:\n${storeContext}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    return {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: systemContext,
            },
          ],
        },
        ...history.map((item) => ({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [
            {
              text: item.content,
            },
          ],
        })),
        {
          role: 'user',
          parts: [
            {
              text: message.slice(0, 1200),
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 420,
        temperature: 0.6,
      },
    }
  }

  return {
    model: config.model,
    instructions: josaninhaInstructions,
    message: message.slice(0, 1200),
    history,
    storeContext,
    maxTokens: 420,
  }
}

function classifyAiError(status: number, data: OpenAIResponsePayload) {
  const providerError = data.error
  const message =
    providerError?.message ||
    data.message ||
    data.text ||
    'Falha ao gerar resposta'
  const code = providerError?.code || providerError?.type || data.code || ''
  const errorText = `${code} ${providerError?.status || ''} ${message}`

  if (status === 401 || status === 403) {
    return { code: 'ai_auth_failed', error: message }
  }

  if (status === 429 && /quota|billing|credit|insufficient/i.test(errorText)) {
    return { code: 'ai_quota_exceeded', error: message }
  }

  if (status === 429) {
    return { code: 'ai_rate_limited', error: message }
  }

  return { code: code || 'ai_request_failed', error: message }
}

async function generateJosaninhaReply(env: Record<string, string>, body: string) {
  const config = resolveAiConfig(env)

  if (!config.apiKey) {
    return {
      status: 503,
      body: {
        code: 'missing_ai_key',
        error: 'AI_API_KEY ausente',
      },
    }
  }

  const payload = JSON.parse(body || '{}') as {
    message?: unknown
    history?: unknown
    storeContext?: unknown
  }
  const message = String(payload.message || '').trim()

  if (!message) {
    return { status: 400, body: { error: 'Mensagem vazia' } }
  }

  const storeContext = formatStoreContext(payload.storeContext)
  const history = normalizeHistory(payload.history)
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

  const providerResponse = await fetch(resolveProviderEndpoint(config), {
    method: 'POST',
    headers: {
      ...(config.mode === 'gemini'
        ? { 'x-goog-api-key': config.apiKey }
        : { Authorization: `Bearer ${config.apiKey}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      buildAiRequestPayload({
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
    return {
      status: providerResponse.status,
      body: classifyAiError(providerResponse.status, data),
    }
  }

  return {
    status: 200,
    body: {
      reply:
        extractOutputText(data) ||
        'Posso te ajudar com isso. Me conte um pouco mais para eu responder com mais precisao.',
      model: config.model,
      provider: config.provider,
      mode: config.mode,
    },
  }
}

function localApiPlugin(env: Record<string, string>): Plugin {
  const adminEmail = (env.ADMIN_EMAIL || env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()
  const adminPasswordHash = env.ADMIN_PASSWORD_HASH?.trim()

  return {
    name: 'jc-local-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/admin-login', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Metodo nao permitido' })
          return
        }

        if (!adminEmail || !adminPasswordHash) {
          sendJson(response, 503, { error: 'Admin nao configurado' })
          return
        }

        try {
          const body = JSON.parse(await readBody(request)) as {
            email?: string
            password?: string
          }
          const email = body.email?.trim().toLowerCase()
          const password = body.password ?? ''

          if (email !== adminEmail || !verifyPassword(password, adminPasswordHash)) {
            sendJson(response, 401, { error: 'Credenciais invalidas' })
            return
          }

          const session = createAdminToken(
            adminEmail,
            getAdminSecret(adminEmail, adminPasswordHash, env),
          )

          sendJson(response, 200, {
            user: {
              id: 'admin',
              name: 'Admin',
              email: adminEmail,
              phone: '',
              city: '',
              accountType: 'atacado',
              role: 'admin',
            },
            ...session,
          })
        } catch {
          sendJson(response, 400, { error: 'Requisicao invalida' })
        }
      })

      server.middlewares.use('/api/admin-session', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Metodo nao permitido' })
          return
        }

        if (!adminEmail || !adminPasswordHash) {
          sendJson(response, 503, { error: 'Admin nao configurado' })
          return
        }

        try {
          const body = JSON.parse(await readBody(request)) as { token?: string }
          const session = verifyAdminToken(
            body.token,
            adminEmail,
            getAdminSecret(adminEmail, adminPasswordHash, env),
          )

          if (!session) {
            sendJson(response, 401, { error: 'Sessao administrativa invalida' })
            return
          }

          sendJson(response, 200, {
            user: {
              id: 'admin',
              name: 'Admin',
              email: adminEmail,
              phone: '',
              city: '',
              accountType: 'atacado',
              role: 'admin',
            },
            adminExpiresAt: session.exp,
          })
        } catch {
          sendJson(response, 401, { error: 'Sessao administrativa invalida' })
        }
      })

      server.middlewares.use('/api/admin-secret', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Metodo nao permitido' })
          return
        }

        if (!adminEmail || !adminPasswordHash) {
          sendJson(response, 503, { error: 'Admin nao configurado' })
          return
        }

        try {
          const body = JSON.parse(await readBody(request)) as {
            adminToken?: string
            key?: string
            value?: string
            entries?: Array<{ key?: string; value?: string }>
            secrets?: Record<string, string>
          }
          const adminToken =
            body.adminToken ||
            String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')
          const session = verifyAdminToken(
            adminToken,
            adminEmail,
            getAdminSecret(adminEmail, adminPasswordHash, env),
          )

          if (!session) {
            sendJson(response, 401, { error: 'Sessao administrativa invalida' })
            return
          }

          const entries = normalizeAdminSecretEntries(body)

          if (!entries.length) {
            sendJson(response, 400, { error: 'Nenhuma configuracao enviada.' })
            return
          }

          for (const entry of entries) {
            if (!isAllowedAdminSecretKey(entry.key)) {
              sendJson(response, 400, { error: 'Secret nao permitido.' })
              return
            }

            if (!allowedAdminSecrets[entry.key].validate(entry.value)) {
              sendJson(response, 400, {
                error: `Informe um valor valido para ${allowedAdminSecrets[entry.key].label}.`,
              })
              return
            }
          }

          const saved: Array<{ key: AllowedAdminSecretKey; label: string }> = []

          for (const entry of entries) {
            const key = entry.key as AllowedAdminSecretKey
            const result = await upsertVercelSecret(env, key, entry.value, {
              redeploy: false,
            })

            if (result.status !== 200) {
              sendJson(response, result.status, result.body)
              return
            }

            saved.push({
              key,
              label: allowedAdminSecrets[key].label,
            })
          }

          sendJson(response, 200, {
            ok: true,
            key: saved[0]?.key,
            label: saved.length === 1 ? saved[0]?.label : `${saved.length} configurações`,
            labels: saved.map((item) => item.label),
            target: 'production',
            redeploy: await triggerVercelRedeploy(env),
          })
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : 'Nao foi possivel salvar o secret.',
          })
        }
      })

      server.middlewares.use('/api/josaninha', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Metodo nao permitido' })
          return
        }

        try {
          const result = await generateJosaninhaReply(env, await readBody(request))
          sendJson(response, result.status, result.body)
        } catch {
          sendJson(response, 500, { error: 'Nao foi possivel responder agora' })
        }
      })

      server.middlewares.use('/api/mercado-pago-pix', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Metodo nao permitido' })
          return
        }

        try {
          const result = await generateMercadoPagoPix(env, await readBody(request), request)
          sendJson(response, result.status, result.body)
        } catch (error) {
          sendJson(response, 500, {
            error:
              error instanceof Error
                ? error.message
                : 'Nao foi possivel gerar Pix Mercado Pago.',
          })
        }
      })

      server.middlewares.use('/api/mercado-pago-status', async (request, response) => {
        if (!['GET', 'POST'].includes(request.method || '')) {
          sendJson(response, 405, { error: 'Metodo nao permitido' })
          return
        }

        try {
          const result = await getMercadoPagoStatus(
            env,
            request.method === 'POST' ? await readBody(request) : '{}',
            request,
          )
          sendJson(response, result.status, result.body)
        } catch (error) {
          sendJson(response, 500, {
            error:
              error instanceof Error
                ? error.message
                : 'Nao foi possivel consultar o pagamento.',
          })
        }
      })

      server.middlewares.use('/api/mercado-pago-webhook', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Metodo nao permitido' })
          return
        }

        const signature = verifyMercadoPagoWebhook(env, request)
        if (!signature.valid) {
          sendJson(response, 401, { error: 'Webhook Mercado Pago invalido' })
          return
        }

        try {
          const body = JSON.parse(await readBody(request) || '{}') as {
            action?: string
            id?: string
            type?: string
            data?: { id?: string }
          }
          sendJson(response, 200, {
            received: true,
            verified: signature.configured,
            provider: 'mercado_pago',
            topic: getMercadoPagoQueryParam(request, 'type') || body.type || '',
            action: body.action || '',
            dataId:
              getMercadoPagoQueryParam(request, 'data.id') ||
              String(body.data?.id || body.id || ''),
          })
        } catch {
          sendJson(response, 400, { error: 'Webhook Mercado Pago invalido' })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), localApiPlugin(env)],
  }
})
