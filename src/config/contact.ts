import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '../utils/whatsapp'

const rawWhatsAppNumber = normalizeWhatsAppNumber(import.meta.env.VITE_WHATSAPP_NUMBER)
const rawContactEmail = import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? ''

export const contact = {
  instagramUrl:
    import.meta.env.VITE_INSTAGRAM_URL?.trim() || 'https://www.instagram.com/jc_cogumelos/',
  instagramHandle: '@jc_cogumelos',
  contactEmail: rawContactEmail,
  whatsAppNumber: rawWhatsAppNumber,
  whatsAppUrl: buildWhatsAppUrl(rawWhatsAppNumber),
}
