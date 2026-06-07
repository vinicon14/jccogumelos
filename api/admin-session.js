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

function getAdminSecret(email, passwordHash) {
  return process.env.ADMIN_SESSION_SECRET || `${email}:${passwordHash}`
}

function signTokenPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function verifyAdminToken(token, email, secret) {
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

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))

  if (decoded.role !== 'admin' || decoded.sub !== email || decoded.exp < Date.now()) {
    return null
  }

  return decoded
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Metodo nao permitido' })
    return
  }

  const adminEmail = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase()
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim()

  if (!adminEmail || !adminPasswordHash) {
    response.status(503).json({ error: 'Admin nao configurado' })
    return
  }

  try {
    const body = await readBody(request)
    const session = verifyAdminToken(
      body.token,
      adminEmail,
      getAdminSecret(adminEmail, adminPasswordHash),
    )

    if (!session) {
      response.status(401).json({ error: 'Sessao administrativa invalida' })
      return
    }

    response.status(200).json({
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
    response.status(401).json({ error: 'Sessao administrativa invalida' })
  }
}
