import { randomUUID } from 'node:crypto'

const defaultBaseUrl = 'https://api.mercadopago.com'

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

function getAccessToken() {
  return (
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.BANK_PAYMENT_API_SECRET ||
    ''
  ).trim()
}

function getNotificationUrl(request) {
  if (process.env.MERCADO_PAGO_WEBHOOK_URL) {
    return process.env.MERCADO_PAGO_WEBHOOK_URL
  }

  const host = request.headers['x-forwarded-host'] || request.headers.host
  const protocol = request.headers['x-forwarded-proto'] || 'https'
  return host ? `${protocol}://${host}/api/mercado-pago-webhook` : undefined
}

function sanitizeAmount(amount) {
  const value = Number(amount)
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : 0
}

function createPaymentPayload(body, request) {
  const amount = sanitizeAmount(body.amount)
  const minutes = Math.max(Number(body.expirationMinutes || 5), 5)
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  const orderId = String(body.orderId || `JC-${Date.now()}`)
  const customer = body.customer || {}
  const payerEmail = String(customer.email || body.payerEmail || '').trim()

  return {
    transaction_amount: amount,
    description: String(body.description || `Pedido ${orderId} - JC Cogumelos`).slice(0, 255),
    payment_method_id: 'pix',
    external_reference: orderId,
    notification_url: getNotificationUrl(request),
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
            unit_price: sanitizeAmount(item.unitPrice || item.price || 0),
          }))
        : [],
    },
  }
}

function createOrderPayload(body, request) {
  const amount = sanitizeAmount(body.amount)
  const minutes = Math.max(Number(body.expirationMinutes || 5), 5)
  const orderId = String(body.orderId || `JC-${Date.now()}`)
  const customer = body.customer || {}

  return {
    type: 'online',
    total_amount: amount.toFixed(2),
    external_reference: orderId,
    processing_mode: 'automatic',
    notification_url: getNotificationUrl(request),
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

function parseMercadoPagoPayment(data, mode) {
  const orderPayment =
    data?.transactions?.payments?.[0] ||
    data?.transaction?.payments?.[0] ||
    data?.payments?.[0] ||
    {}
  const paymentMethod =
    orderPayment.payment_method ||
    orderPayment.paymentMethod ||
    data?.point_of_interaction?.transaction_data ||
    {}

  const qrCode =
    paymentMethod.qr_code ||
    paymentMethod.qrCode ||
    paymentMethod.qr_code_text ||
    data?.point_of_interaction?.transaction_data?.qr_code ||
    ''
  const qrCodeBase64 =
    paymentMethod.qr_code_base64 ||
    paymentMethod.qrCodeBase64 ||
    data?.point_of_interaction?.transaction_data?.qr_code_base64 ||
    ''
  const ticketUrl =
    paymentMethod.ticket_url ||
    paymentMethod.ticketUrl ||
    data?.point_of_interaction?.transaction_data?.ticket_url ||
    ''

  return {
    provider: 'mercado_pago',
    mode,
    paymentId: String(orderPayment.id || data.id || ''),
    orderId: String(data.id || ''),
    status: String(orderPayment.status || data.status || 'pending'),
    statusDetail: String(orderPayment.status_detail || data.status_detail || ''),
    externalReference: String(data.external_reference || ''),
    qrCode,
    qrCodeBase64,
    ticketUrl,
    rawStatus: data.status || orderPayment.status || null,
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Metodo nao permitido' })
    return
  }

  const accessToken = getAccessToken()
  if (!accessToken) {
    response.status(503).json({
      code: 'missing_mercado_pago_access_token',
      error: 'Configure a integração de pagamento na Vercel para gerar Pix.',
    })
    return
  }

  try {
    const body = await readBody(request)
    const amount = sanitizeAmount(body.amount)
    const payerEmail = String(body.customer?.email || body.payerEmail || '').trim()

    if (!amount || !payerEmail) {
      response.status(400).json({
        error: 'Informe valor do pedido e e-mail do pagador.',
      })
      return
    }

    const mode = (process.env.MERCADO_PAGO_API_MODE || 'payments').toLowerCase()
    const baseUrl = process.env.MERCADO_PAGO_API_BASE || defaultBaseUrl
    const endpoint = mode === 'orders' ? '/v1/orders' : '/v1/payments'
    const payload =
      mode === 'orders'
        ? createOrderPayload(body, request)
        : createPaymentPayload(body, request)

    const mercadoPagoResponse = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': String(body.idempotencyKey || `${body.orderId}-${Math.round(amount * 100)}`),
      },
      body: JSON.stringify(payload),
    })
    const data = await mercadoPagoResponse.json()

    if (!mercadoPagoResponse.ok) {
      response.status(mercadoPagoResponse.status).json({
        error: 'O provedor de pagamento recusou a criacao do Pix.',
        details: data.cause || data,
      })
      return
    }

    response.status(200).json({
      payment: parseMercadoPagoPayment(data, mode === 'orders' ? 'orders' : 'payments'),
    })
  } catch (error) {
    response.status(500).json({
      error: 'Nao foi possivel gerar Pix.',
    })
  }
}
