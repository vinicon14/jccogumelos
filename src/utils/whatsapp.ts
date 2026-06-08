const siteWhatsAppMessage =
  'Ola, vim pelo botao do site JC Cogumelos. Codigo: SITE-JC. Quero atendimento.'

export const WHATSAPP_SITE_ENTRY_KEY = 'jc-cogumelos-whatsapp-site-entry-v1'

export function normalizeWhatsAppNumber(value?: string) {
  return String(value || '').replace(/\D/g, '')
}

export function buildWhatsAppUrl(value?: string) {
  const normalized = String(value || '').trim()

  if (!normalized) {
    return ''
  }

  const number = normalizeWhatsAppNumber(normalized)

  if (!number) {
    return ''
  }

  return `https://wa.me/${number}?text=${encodeURIComponent(siteWhatsAppMessage)}`
}

export function markWhatsAppSiteEntry() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    WHATSAPP_SITE_ENTRY_KEY,
    JSON.stringify({
      source: 'site-button',
      code: 'SITE-JC',
      clickedAt: new Date().toISOString(),
    }),
  )
}
