import { CreditCard, QrCode, TimerReset } from 'lucide-react'
import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { MediaPreview } from '../components/MediaPreview'
import { useAuth } from '../context/useAuth'
import { useCart } from '../context/useCart'
import { useStore } from '../context/useStore'
import type { PaymentMethod } from '../types'
import { formatCurrency } from '../utils/format'
import { buildPixPayload, isPixGatewayReady } from '../utils/payment'

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
  const pixReady = isPixGatewayReady(settings.paymentGateway)
  const pixPayload = buildPixPayload({
    config: settings.paymentGateway,
    amount: displayTotal,
    orderId: createdOrderId || 'PREVIEW',
  })

  function createOrder() {
    if (!user || lines.length === 0 || createdOrderId) {
      return
    }

    const orderId = `JC-${Date.now().toString().slice(-6)}`
    const orderTotal = total

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
    clearCart()
  }

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Checkout</p>
        <h1>Finalizar pedido</h1>
        <p>
          Fluxo preparado para PIX, cartão e cancelamento automático se o pagamento
          não for aprovado em 5 minutos.
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
                {pixReady || settings.paymentGateway.fallbackQrEnabled ? (
                  <QRCodeSVG value={pixPayload} size={188} marginSize={2} />
                ) : (
                  <QrCode size={64} />
                )}
              </div>
              <div>
                <strong>
                  {pixReady
                    ? 'QR Code PIX pronto para pagamento.'
                    : 'PIX aguardando configuração do banco.'}
                </strong>
                <p>
                  {createdOrderId
                    ? `Pedido ${createdOrderId} · ${formatCurrency(displayTotal)}`
                    : `${settings.paymentGateway.provider} · ${formatCurrency(displayTotal)}`}
                </p>
                <code>{pixPayload}</code>
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
            <p>Pedidos sem pagamento podem ser cancelados automaticamente.</p>
          </div>
          <div className="summary-total">
            <span>Total estimado</span>
            <strong>{formatCurrency(displayTotal)}</strong>
          </div>
          <button
            className="primary-button justify-center"
            type="button"
            onClick={createOrder}
            disabled={lines.length === 0 || Boolean(createdOrderId)}
          >
            {createdOrderId ? `Pedido ${createdOrderId} criado` : 'Confirmar pedido'}
          </button>
        </aside>
      </div>
    </section>
  )
}
