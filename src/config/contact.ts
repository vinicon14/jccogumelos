const rawWhatsAppNumber = import.meta.env.VITE_WHATSAPP_NUMBER?.replace(/\D/g, '') ?? ''
const rawContactEmail = import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? ''

export const contact = {
  instagramUrl:
    import.meta.env.VITE_INSTAGRAM_URL?.trim() || 'https://www.instagram.com/jc_cogumelos/',
  instagramHandle: '@jc_cogumelos',
  contactEmail: rawContactEmail,
  whatsAppUrl: rawWhatsAppNumber
    ? `https://wa.me/${rawWhatsAppNumber}?text=${encodeURIComponent(
        'Olá Jozaninha, quero comprar cogumelos',
      )}`
    : '',
}
