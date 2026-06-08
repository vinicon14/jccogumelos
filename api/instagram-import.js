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

function getAccessToken() {
  return (
    process.env.INSTAGRAM_ACCESS_TOKEN ||
    process.env.META_INSTAGRAM_ACCESS_TOKEN ||
    ''
  ).trim()
}

function clipText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function mediaTypeFromInstagram(value, hasThumbnail = false) {
  if (value === 'VIDEO' && !hasThumbnail) {
    return 'video'
  }

  return 'image'
}

function mapInstagramMedia(item) {
  const children = item.children?.data || []
  const mediaItems = children.length > 0 ? children : [item]
  const media = mediaItems
    .map((mediaItem, index) => {
      const url = mediaItem.media_url || mediaItem.thumbnail_url || ''

      if (!url) {
        return null
      }

      return {
        id: String(mediaItem.id || `${item.id}-${index}`),
        url,
        mediaType: mediaTypeFromInstagram(
          mediaItem.media_type,
          Boolean(mediaItem.thumbnail_url && !mediaItem.media_url),
        ),
        alt: `Post do Instagram ${index + 1}`,
      }
    })
    .filter(Boolean)
  const caption = String(item.caption || '').trim()
  const title = clipText(caption.split('\n').find(Boolean) || 'Post do Instagram', 70)

  return {
    id: `instagram-${item.id}`,
    title,
    excerpt: clipText(caption || 'Publicado no Instagram da JC Cogumelos.', 150),
    content: caption || 'Post importado do Instagram da JC Cogumelos.',
    image: media[0]?.url || '',
    mediaType: media[0]?.mediaType || 'image',
    media,
    published: true,
    createdAt: item.timestamp || new Date().toISOString(),
    source: 'instagram',
    sourceId: String(item.id || ''),
    sourceUrl: String(item.permalink || ''),
  }
}

async function fetchInstagramMedia({ accessToken, userId, limit }) {
  const fields =
    'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url,id}'
  const endpoint = userId
    ? `https://graph.facebook.com/v20.0/${encodeURIComponent(userId)}/media`
    : 'https://graph.instagram.com/me/media'
  const url = new URL(endpoint)
  url.searchParams.set('fields', fields)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('access_token', accessToken)

  const instagramResponse = await fetch(url)
  const data = await instagramResponse.json()

  if (!instagramResponse.ok) {
    throw new Error(data.error?.message || 'Instagram recusou a importação.')
  }

  return Array.isArray(data.data) ? data.data : []
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

  const accessToken = getAccessToken()

  if (!accessToken) {
    response.status(503).json({
      code: 'missing_instagram_access_token',
      error: 'Configure INSTAGRAM_ACCESS_TOKEN na Vercel para importar o Instagram.',
    })
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

    const limit = Math.min(Math.max(Number(body.limit || 15), 1), 15)
    const userId = String(
      body.userId ||
        process.env.INSTAGRAM_USER_ID ||
        process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ||
        '',
    ).trim()
    const media = await fetchInstagramMedia({ accessToken, userId, limit })

    response.status(200).json({
      posts: media.map(mapInstagramMedia),
    })
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Nao foi possivel importar o Instagram.',
    })
  }
}
