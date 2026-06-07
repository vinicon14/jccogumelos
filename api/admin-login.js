import { createHmac, pbkdf2Sync, timingSafeEqual } from 'node:crypto'

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

function verifyPassword(password, encodedHash) {
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

function getAdminSecret(email, passwordHash) {
  return process.env.ADMIN_SESSION_SECRET || `${email}:${passwordHash}`
}

function signTokenPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function createAdminToken(email, secret) {
  const adminExpiresAt = Date.now() + 8 * 60 * 60 * 1000
  const payload = Buffer.from(
    JSON.stringify({ sub: email, role: 'admin', exp: adminExpiresAt }),
  ).toString('base64url')
  const signature = signTokenPayload(payload, secret)

  return {
    adminToken: `${payload}.${signature}`,
    adminExpiresAt,
  }
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
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (email !== adminEmail || !verifyPassword(password, adminPasswordHash)) {
      response.status(401).json({ error: 'Credenciais invalidas' })
      return
    }

    const session = createAdminToken(email, getAdminSecret(adminEmail, adminPasswordHash))

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
      ...session,
    })
  } catch {
    response.status(400).json({ error: 'Requisicao invalida' })
  }
}
