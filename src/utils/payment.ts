import type { PaymentGatewayConfig } from '../types'

interface PixPayloadInput {
  config: PaymentGatewayConfig
  amount: number
  orderId: string
}

function normalizePixText(value: string, fallback: string) {
  return (value.trim() || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s@.+-]/g, '')
    .slice(0, 64)
}

export function isPixGatewayReady(config: PaymentGatewayConfig) {
  return Boolean(config.enabled && config.pixKey.trim())
}

export function buildPixPayload({ config, amount, orderId }: PixPayloadInput) {
  const receiver = normalizePixText(config.pixReceiverName, 'JC Cogumelos')
  const city = normalizePixText(config.pixReceiverCity, 'SAO PAULO')
  const key = normalizePixText(config.pixKey, 'PIX_NAO_CONFIGURADO')
  const provider = normalizePixText(config.provider, 'Banco')
  const merchant = normalizePixText(config.merchantId, 'sem_merchant')
  const value = Math.max(amount, 0).toFixed(2)

  return [
    'JC_COGUMELOS_PIX',
    `PROVEDOR=${provider}`,
    `AMBIENTE=${config.environment}`,
    `MERCHANT=${merchant}`,
    `CHAVE=${key}`,
    `RECEBEDOR=${receiver}`,
    `CIDADE=${city}`,
    `VALOR=${value}`,
    `PEDIDO=${normalizePixText(orderId, 'prepedido')}`,
    `EXPIRA=${Math.max(config.pixExpirationMinutes || 5, 1)}MIN`,
  ].join('|')
}
