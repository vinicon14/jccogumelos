import { createHmac, pbkdf2Sync, timingSafeEqual } from 'node:crypto'
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

async function generateJosaninhaReply(env: Record<string, string>, body: string) {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return { status: 503, body: { error: 'OPENAI_API_KEY ausente' } }
  }

  const payload = JSON.parse(body || '{}') as { message?: unknown; history?: unknown }
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
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), localApiPlugin(env)],
  }
})
