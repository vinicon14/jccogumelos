import { createHmac, timingSafeEqual } from 'node:crypto'

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

function getHeader(request, name) {
  const value = request.headers[name] || request.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function getWebhookSecret() {
  return (
    process.env.MERCADO_PAGO_WEBHOOK_SECRET ||
    process.env.BANK_PAYMENT_WEBHOOK_SECRET ||
    ''
  ).trim()
}

function getQueryParam(request, name) {
  const host = getHeader(request, 'host') || 'localhost'
  const url = new URL(request.url || '/', `https://${host}`)
  return url.searchParams.get(name) || ''
}

function parseSignature(signatureHeader) {
  return String(signatureHeader || '')
    .split(',')
    .map((part) => part.split('='))
    .reduce(
      (result, [key, value]) => ({
        ...result,
        [String(key || '').trim()]: String(value || '').trim(),
      }),
      {},
    )
}

function safeCompareHex(expected, actual) {
  const expectedBuffer = Buffer.from(String(expected || ''), 'hex')
  const actualBuffer = Buffer.from(String(actual || ''), 'hex')

  return (
    expectedBuffer.length > 0 &&
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  )
}

function verifyMercadoPagoSignature(request) {
  const secret = getWebhookSecret()
  if (!secret) {
    return { configured: false, valid: true }
  }

  const xSignature = getHeader(request, 'x-signature')
  const xRequestId = getHeader(request, 'x-request-id')
  const dataId = getQueryParam(request, 'data.id')
  const { ts, v1 } = parseSignature(xSignature)

  if (!ts || !v1) {
    return { configured: true, valid: false }
  }

  const manifest = [
    dataId ? `id:${dataId};` : '',
    xRequestId ? `request-id:${xRequestId};` : '',
    `ts:${ts};`,
  ].join('')
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  return { configured: true, valid: safeCompareHex(expected, v1) }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Metodo nao permitido' })
    return
  }

  const signature = verifyMercadoPagoSignature(request)
  if (!signature.valid) {
    response.status(401).json({ error: 'Webhook Mercado Pago invalido' })
    return
  }

  try {
    const body = await readBody(request)
    const dataId = getQueryParam(request, 'data.id') || String(body?.data?.id || body?.id || '')

    response.status(200).json({
      received: true,
      verified: signature.configured,
      provider: 'mercado_pago',
      topic: getQueryParam(request, 'type') || body?.type || '',
      action: body?.action || '',
      dataId,
    })
  } catch {
    response.status(400).json({ error: 'Webhook Mercado Pago invalido' })
  }
}
