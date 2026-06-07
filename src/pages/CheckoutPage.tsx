import { CreditCard, QrCode, TimerReset } from 'lucide-react'
import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { MediaPreview } from '../components/MediaPreview'
import { useAuth } from '../context/useAuth'
import { useCart } from '../context/useCart'
import { useStore } from '../context/useStore'
import type { PaymentIntent, PaymentMethod } from '../types'
import { formatCurrency } from '../utils/format'
import { buildPixPayload } from '../utils/payment'

const paymentOptions: Array<{ value: PaymentMethod; label: string; icon: typeof QrCode }> = [
  { value: 'pix', label: 'PIX', icon: QrCode },
  { value: 'credito', label: 'Cartão de crédito', icon: CreditCard },
  { value: 'debito', label: 'Cartão de débito', icon: CreditCard },
]

const statuses = [
  'Pedido criado',
  'Aguardando pagamento',
  'Pagamento aprovado',
  'Pedido em preparação',
  'Pedido enviado',
  'Pedido entregue',
]

export function CheckoutPage() {
  const { user } = useAuth()
  const { lines, subtotal, clearCart } = useCart()
  const { orders, notifications, products, settings, setOrders, setNotifications, setProducts } =
    useStore()
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [createdOrderId, setCreatedOrderId] = useState('')
  const [createdOrderTotal, setCreatedOrderTotal] = useState(0)
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const total = subtotal > 0 ? subtotal + settings.shippingBase : 0
  const displayTotal = createdOrderTotal || total
  const availablePaymentOptions = useMemo(
    () =>
      paymentOptions.filter((option) => {
        if (option.value === 'pix') return settings.pixEnabled
        if (option.value === 'credito') return settings.creditEnabled
        return settings.debitEnabled
      }),
    [settings.creditEnabled, settings.debitEnabled, settings.pixEnabled],
  )
  const selectedMethod = availablePaymentOptions.some((option) => option.value === method)
    ? method
    : availablePaymentOptions[0]?.value ?? 'pix'
  const pixPayload = buildPixPayload({
    config: settings.paymentGateway,
    amount: displayTotal,
    orderId: createdOrderId || 'PREVIEW',
  })

  async function createMercadoPagoPix(orderId: string, orderTotal: number) {
    const response = await fetch('/api/mercado-pago-pix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        amount: orderTotal,
        description: `Pedido ${orderId} - JC Cogumelos`,
        expirationMinutes: settings.paymentGateway.pixExpirationMinutes,
        idempotencyKey: `${orderId}-${Math.round(orderTotal * 100)}`,
        customer: {
          name: user?.name,
          email: user?.email,
        },
        items: lines.map((line) => ({
          id: line.product.id,
          name: line.product.name,
          quantity: line.quantity,
          unitPrice: line.product.price,
        })),
      }),
    })
    const data = (await response.json()) as {
      payment?: PaymentIntent
      error?: string
      code?: string
    }

    if (!response.ok || !data.payment) {
      throw new Error(
        data.error ||
          (data.code === 'missing_mercado_pago_access_token'
            ? 'Configure o token Mercado Pago no servidor para gerar o Pix.'
            : 'Não foi possível gerar o Pix Mercado Pago.'),
      )
    }

    return data.payment
  }

  async function createOrder() {
    if (!user || lines.length === 0 || createdOrderId) {
      return
    }

    setPaymentError('')
    setPaymentLoading(true)

    const orderId = `JC-${Date.now().toString().slice(-6)}`
    const orderTotal = total
    let nextPaymentIntent: PaymentIntent | null = null

    try {
      if (selectedMethod === 'pix') {
        if (settings.paymentGateway.enabled) {
          nextPaymentIntent = await createMercadoPagoPix(orderId, orderTotal)
        } else if (settings.paymentGateway.fallbackQrEnabled) {
          nextPaymentIntent = {
            provider: 'local',
            mode: 'fallback',
            paymentId: orderId,
            orderId,
            status: 'pending',
            statusDetail: '',
            externalReference: orderId,
            qrCode: pixPayload,
            qrCodeBase64: '',
            ticketUrl: '',
            rawStatus: 'pending',
          }
        } else {
          throw new Error('Ative a integração Mercado Pago no painel para gerar Pix.')
        }
      }
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar o pagamento.',
      )
      setPaymentLoading(false)
      return
    }

    setOrders([
      {
        id: orderId,
        customerName: user.name,
        status: 'aguardando_pagamento',
        total: orderTotal,
        createdAt: new Date().toISOString(),
        items: lines.map((line) => line.product.name),
      },
      ...orders,
    ])
    setNotifications([
      {
        id: crypto.randomUUID(),
        audience: 'admin',
        title: 'Novo pedido recebido',
        message: `${user.name} fez o pedido ${orderId}.`,
        createdAt: new Date().toISOString(),
        read: false,
        link: '/admin',
      },
      ...notifications,
    ])
    setProducts(
      products.map((product) => {
        const line = lines.find((item) => item.product.id === product.id)

        if (!line) {
          return product
        }

        return {
          ...product,
          stock: Math.max(0, product.stock - line.quantity),
        }
      }),
    )
    setCreatedOrderTotal(orderTotal)
    setCreatedOrderId(orderId)
    setPaymentIntent(nextPaymentIntent)
    setPaymentLoading(false)
    clearCart()
  }

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Checkout</p>
        <h1>Finalizar pedido</h1>
        <p>
          Pagamento Pix com QR Code Mercado Pago e acompanhamento de status do
          pedido.
        </p>
      </div>

      <div className="checkout-layout">
        <div className="payment-panel">
          <h2>Método de pagamento</h2>
          <div className="grid gap-3">
            {availablePaymentOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  className={`payment-option ${selectedMethod === option.value ? 'active' : ''}`}
                  type="button"
                  onClick={() => setMethod(option.value)}
                >
                  <Icon size={20} />
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
          {selectedMethod === 'pix' ? (
            <div className="pix-checkout-box">
              <div className="pix-qr-frame">
                {paymentIntent?.qrCodeBase64 ? (
                  <img
                    src={`data:image/jpeg;base64,${paymentIntent.qrCodeBase64}`}
                    alt="QR Code Pix Mercado Pago"
                  />
                ) : paymentIntent?.qrCode ? (
                  <QRCodeSVG value={paymentIntent.qrCode} size={188} marginSize={2} />
                ) : (
                  <QrCode size={64} />
                )}
              </div>
              <div>
                <strong>
                  {paymentIntent
                    ? 'Pix Mercado Pago gerado para este pedido.'
                    : 'Confirme o pedido para gerar o Pix Mercado Pago.'}
                </strong>
                <p>
                  {createdOrderId
                    ? `Pedido ${createdOrderId} · ${formatCurrency(displayTotal)}`
                    : `${settings.paymentGateway.provider} · ${formatCurrency(displayTotal)}`}
                </p>
                {paymentIntent?.ticketUrl && (
                  <a
                    className="payment-link"
                    href={paymentIntent.ticketUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir instruções de pagamento
                  </a>
                )}
                <code>
                  {paymentIntent?.qrCode ||
                    'O código Pix copia e cola aparecerá aqui depois da confirmação.'}
                </code>
                {paymentError && <p className="form-error">{paymentError}</p>}
              </div>
            </div>
          ) : (
            <div className="payment-flow-box">
              <strong>Fluxo de cartão preparado.</strong>
              <p>
                A aprovação entra pelo retorno da API bancária quando o provedor
                for ativado no painel.
              </p>
            </div>
          )}
        </div>

        <aside className="summary-panel">
          <h2>Status do pedido</h2>
          {lines.length > 0 && (
            <div className="checkout-items">
              {lines.map((line) => (
                <article className="checkout-item" key={line.product.id}>
                  <MediaPreview
                    src={line.product.image}
                    alt={line.product.name}
                    mediaType={line.product.mediaType}
                  />
                  <div>
                    <strong>{line.product.name}</strong>
                    <span>
                      {line.quantity}x · {formatCurrency(line.subtotal)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="status-list">
            {statuses.map((status, index) => (
              <div className="status-step" key={status}>
                <span>{index + 1}</span>
                <p>{status}</p>
              </div>
            ))}
          </div>
          <div className="timer-card">
            <TimerReset size={22} />
            <p>O Pix respeita o tempo de expiração configurado para a loja.</p>
          </div>
          <div className="summary-total">
            <span>Total estimado</span>
            <strong>{formatCurrency(displayTotal)}</strong>
          </div>
          <button
            className="primary-button justify-center"
            type="button"
            onClick={createOrder}
            disabled={lines.length === 0 || Boolean(createdOrderId) || paymentLoading}
          >
            {paymentLoading
              ? 'Gerando Pix...'
              : createdOrderId
                ? `Pedido ${createdOrderId} criado`
                : 'Confirmar pedido'}
          </button>
        </aside>
      </div>
    </section>
  )
}
