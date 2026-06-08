import { createHmac, pbkdf2Sync, randomUUID, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

interface OpenAIResponsePayload {
  output_text?: string
  output?: Array<{
    content?: Array<{
      text?: string
      output_text?: string
    }>
  }>
  error?: {
    message?: string
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
}

type AllowedAdminSecretKey = keyof typeof allowedAdminSecrets

function isAllowedAdminSecretKey(key: string): key is AllowedAdminSecretKey {
  return key in allowedAdminSecrets
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

async function upsertVercelSecret(
  env: Record<string, string>,
  key: AllowedAdminSecretKey,
  value: string,
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

  let redeploy = 'not_configured'
  const redeployHookUrl = env.VERCEL_REDEPLOY_HOOK_URL?.trim()

  if (redeployHookUrl) {
    const redeployResponse = await fetch(redeployHookUrl, { method: 'POST' })
    redeploy = redeployResponse.ok ? 'triggered' : 'failed'
  }

  return {
    status: 200,
    body: {
      ok: true,
      key,
      label: allowedAdminSecrets[key].label,
      target: 'production',
      redeploy,
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
    `Frete base: R$ ${Number(storeContext.shippingBase || 0).toFixed(2)}`,
    products ? `Produtos atuais:\n${products}` : '',
    plans ? `Planos atuais:\n${plans}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 5000)
}

async function generateJosaninhaReply(env: Record<string, string>, body: string) {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return {
      status: 503,
      body: {
        code: 'missing_openai_key',
        error: 'OPENAI_API_KEY ausente',
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

  const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-5.2',
      instructions: josaninhaInstructions,
      input: [
        ...(payload.storeContext
          ? [
              {
                role: 'user',
                content: `Contexto atual da loja para responder com precisão:\n${formatStoreContext(payload.storeContext)}`,
              },
            ]
          : []),
        ...normalizeHistory(payload.history),
        {
          role: 'user',
          content: message.slice(0, 1200),
        },
      ],
      max_output_tokens: 420,
    }),
  })

  const data = (await openaiResponse.json()) as OpenAIResponsePayload

  if (!openaiResponse.ok) {
    return {
      status: openaiResponse.status,
      body: { error: data.error?.message || 'Falha ao gerar resposta' },
    }
  }

  return {
    status: 200,
    body: {
      reply:
        extractOutputText(data) ||
        'Posso te ajudar com isso. Me conte um pouco mais para eu responder com mais precisao.',
      model: env.OPENAI_MODEL || 'gpt-5.2',
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

          const key = String(body.key || '').trim()
          const value = String(body.value || '').trim()

          if (!isAllowedAdminSecretKey(key)) {
            sendJson(response, 400, { error: 'Secret nao permitido.' })
            return
          }

          if (!allowedAdminSecrets[key].validate(value)) {
            sendJson(response, 400, {
              error: `Informe um valor valido para ${allowedAdminSecrets[key].label}.`,
            })
            return
          }

          const result = await upsertVercelSecret(env, key, value)
          sendJson(response, result.status, result.body)
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
