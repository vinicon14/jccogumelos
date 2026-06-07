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

function getQueryPaymentId(request) {
  const host = request.headers.host || 'localhost'
  const url = new URL(request.url || '/', `https://${host}`)
  return url.searchParams.get('paymentId') || url.searchParams.get('id') || ''
}

function parseStatus(data) {
  return {
    provider: 'mercado_pago',
    paymentId: String(data?.id || ''),
    status: String(data?.status || 'pending'),
    statusDetail: String(data?.status_detail || ''),
    externalReference: String(data?.external_reference || ''),
    amount: Number(data?.transaction_amount || data?.total_paid_amount || 0),
    paidAt: data?.date_approved || null,
  }
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method || '')) {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'Metodo nao permitido' })
    return
  }

  const accessToken = getAccessToken()
  if (!accessToken) {
    response.status(503).json({
      code: 'missing_mercado_pago_access_token',
      error: 'Configure MERCADO_PAGO_ACCESS_TOKEN na Vercel para consultar pagamentos.',
    })
    return
  }

  try {
    const body = request.method === 'POST' ? await readBody(request) : {}
    const paymentId = String(body.paymentId || getQueryPaymentId(request)).trim()

    if (!paymentId) {
      response.status(400).json({ error: 'Informe o paymentId do Mercado Pago.' })
      return
    }

    const baseUrl = process.env.MERCADO_PAGO_API_BASE || defaultBaseUrl
    const mercadoPagoResponse = await fetch(`${baseUrl}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const data = await mercadoPagoResponse.json()

    if (!mercadoPagoResponse.ok) {
      response.status(mercadoPagoResponse.status).json({
        error: data.message || data.error || 'Nao foi possivel consultar o pagamento.',
        details: data.cause || data,
      })
      return
    }

    response.status(200).json({ payment: parseStatus(data) })
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Nao foi possivel consultar o pagamento.',
    })
  }
}
