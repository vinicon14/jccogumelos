import { createHmac, timingSafeEqual } from 'node:crypto'

const validAiModes = new Set(['responses', 'chat_completions', 'generic_json'])

const allowedSecrets = {
  MERCADO_PAGO_ACCESS_TOKEN: {
    label: 'Access Token Mercado Pago',
    validate(value) {
      return String(value || '').trim().length >= 30
    },
  },
  OPENAI_API_KEY: {
    label: 'Chave GPT / OpenAI',
    validate(value) {
      const token = String(value || '').trim()
      return token.startsWith('sk-') && token.length >= 40
    },
  },
  AI_API_KEY: {
    label: 'Chave da API da Josaninha',
    validate(value) {
      return String(value || '').trim().length >= 10
    },
  },
  AI_PROVIDER_NAME: {
    label: 'Provedor da Josaninha',
    validate(value) {
      const name = String(value || '').trim()
      return name.length >= 2 && name.length <= 80
    },
  },
  AI_API_ENDPOINT: {
    label: 'Endpoint da API da Josaninha',
    validate(value) {
      try {
        const url = new URL(String(value || '').trim())
        return url.protocol === 'https:' && url.hostname.length > 3
      } catch {
        return false
      }
    },
  },
  AI_MODEL: {
    label: 'Modelo da Josaninha',
    validate(value) {
      const model = String(value || '').trim()
      return model.length >= 1 && model.length <= 120
    },
  },
  AI_API_MODE: {
    label: 'Modo da API da Josaninha',
    validate(value) {
      return validAiModes.has(String(value || '').trim())
    },
  },
  INSTAGRAM_ACCESS_TOKEN: {
    label: 'Token Instagram',
    validate(value) {
      return String(value || '').trim().length >= 30
    },
  },
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

function getVercelProjectId() {
  return (
    process.env.VERCEL_TARGET_PROJECT_ID ||
    process.env.VERCEL_PROJECT_ID ||
    process.env.VERCEL_PROJECT_NAME ||
    'jccogumelos'
  ).trim()
}

function getVercelTeamId() {
  return (
    process.env.VERCEL_TARGET_TEAM_ID ||
    process.env.VERCEL_TEAM_ID ||
    process.env.VERCEL_ORG_ID ||
    ''
  ).trim()
}

async function triggerVercelRedeploy() {
  const redeployHookUrl = process.env.VERCEL_REDEPLOY_HOOK_URL?.trim()

  if (!redeployHookUrl) {
    return 'not_configured'
  }

  const redeployResponse = await fetch(redeployHookUrl, { method: 'POST' })
  return redeployResponse.ok ? 'triggered' : 'failed'
}

async function upsertVercelSecret(key, value, options = {}) {
  const vercelToken = process.env.VERCEL_API_TOKEN?.trim()
  const projectId = getVercelProjectId()
  const teamId = getVercelTeamId()

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
      comment: `${allowedSecrets[key].label} salvo pelo painel administrativo da JC Cogumelos.`,
    }),
  })
  const data = await vercelResponse.json()

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
      label: allowedSecrets[key].label,
      target: 'production',
      redeploy: options.redeploy === false ? 'not_configured' : await triggerVercelRedeploy(),
    },
  }
}

function normalizeEntries(body) {
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
    const adminToken =
      body.adminToken ||
      String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const session = verifyAdminToken(
      adminToken,
      adminEmail,
      getAdminSecret(adminEmail, adminPasswordHash),
    )

    if (!session) {
      response.status(401).json({ error: 'Sessao administrativa invalida' })
      return
    }

    const entries = normalizeEntries(body)

    if (!entries.length) {
      response.status(400).json({ error: 'Nenhuma configuracao enviada.' })
      return
    }

    for (const entry of entries) {
      const secret = allowedSecrets[entry.key]

      if (!secret) {
        response.status(400).json({ error: 'Secret nao permitido.' })
        return
      }

      if (!secret.validate(entry.value)) {
        response.status(400).json({
          error: `Informe um valor valido para ${secret.label}.`,
        })
        return
      }
    }

    const saved = []

    for (const entry of entries) {
      const result = await upsertVercelSecret(entry.key, entry.value, {
        redeploy: false,
      })

      if (result.status !== 200) {
        response.status(result.status).json(result.body)
        return
      }

      saved.push({
        key: entry.key,
        label: allowedSecrets[entry.key].label,
      })
    }

    response.status(200).json({
      ok: true,
      key: saved[0]?.key,
      label: saved.length === 1 ? saved[0]?.label : `${saved.length} configurações`,
      labels: saved.map((item) => item.label),
      target: 'production',
      redeploy: await triggerVercelRedeploy(),
    })
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Nao foi possivel salvar o secret.',
    })
  }
}
