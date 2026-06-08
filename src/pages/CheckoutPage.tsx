import { CreditCard, QrCode, TimerReset } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { MediaPreview } from '../components/MediaPreview'
import { useAuth } from '../context/useAuth'
import { useCart } from '../context/useCart'
import { useStore } from '../context/useStore'
import type { PaymentIntent, PaymentMethod, Product } from '../types'
import { formatCep, formatCustomerAddress } from '../utils/customers'
import { formatCurrency } from '../utils/format'
import {
  createOrderStatusEntry,
  orderBelongsToUser,
  PAYMENT_TIMEOUT_MS,
} from '../utils/orders'
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

type CheckoutSummaryItem = {
  id: string
  name: string
  quantity: number
  subtotal: number
  product?: Product
}

export function CheckoutPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const { lines, subtotal, clearCart } = useCart()
  const { orders, notifications, products, settings, setOrders, setNotifications, setProducts } =
    useStore()
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [createdOrderId, setCreatedOrderId] = useState('')
  const [createdOrderTotal, setCreatedOrderTotal] = useState(0)
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const paymentOrderId = searchParams.get('order') || ''
  const subscriptionCheckoutOrder = useMemo(
    () =>
      orders.find(
        (order) =>
          order.id === paymentOrderId &&
          order.orderKind === 'subscription' &&
          orderBelongsToUser(order, user),
      ),
    [orders, paymentOrderId, user],
  )
  const isSubscriptionCheckout = Boolean(subscriptionCheckoutOrder)
  const hasUnknownSubscriptionCheckout = Boolean(paymentOrderId) && !subscriptionCheckoutOrder
  const total = subtotal > 0 ? subtotal + settings.shippingBase : 0
  const displayTotal = createdOrderTotal || subscriptionCheckoutOrder?.total || total
  const effectiveOrderId = createdOrderId || subscriptionCheckoutOrder?.id || ''
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
    orderId: effectiveOrderId || 'PREVIEW',
  })
  const checkoutItems: CheckoutSummaryItem[] = isSubscriptionCheckout
    ? (subscriptionCheckoutOrder?.items ?? []).map((itemName) => ({
        id: itemName,
        name: itemName,
        quantity: 1,
        subtotal: subscriptionCheckoutOrder?.total ?? 0,
      }))
    : lines.map((line) => ({
        id: line.product.id,
        name: line.product.name,
        quantity: line.quantity,
        subtotal: line.subtotal,
        product: line.product,
      }))
  const canConfirmPayment =
    Boolean(subscriptionCheckoutOrder) || lines.length > 0
  const isExistingOrderPayable =
    !subscriptionCheckoutOrder ||
    subscriptionCheckoutOrder.status === 'aguardando_pagamento'

  async function createMercadoPagoPix(
    orderId: string,
    orderTotal: number,
    items: Array<{ id: string; name: string; quantity: number; unitPrice: number }>,
    description = `Pedido ${orderId} - JC Cogumelos`,
  ) {
    const response = await fetch('/api/mercado-pago-pix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        amount: orderTotal,
        description,
        expirationMinutes: settings.paymentGateway.pixExpirationMinutes,
        idempotencyKey: `${orderId}-${Math.round(orderTotal * 100)}`,
        customer: {
          name: user?.name,
          email: user?.email,
        },
        items,
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
            ? 'Configure a integração de pagamento no servidor para gerar o Pix.'
            : 'Não foi possível gerar o Pix.'),
      )
    }

    return data.payment
  }

  async function createOrder() {
    if (!user || !canConfirmPayment || createdOrderId || !isExistingOrderPayable) {
      return
    }

    setPaymentError('')
    setPaymentLoading(true)

    const createdAt = new Date()
    const createdAtIso = createdAt.toISOString()
    const orderId =
      subscriptionCheckoutOrder?.id || `JC-${createdAt.getTime().toString().slice(-6)}`
    const orderTotal = subscriptionCheckoutOrder?.total || total
    const paymentExpiresAt = new Date(
      createdAt.getTime() + PAYMENT_TIMEOUT_MS,
    ).toISOString()
    let nextPaymentIntent: PaymentIntent | null = null

    try {
      if (selectedMethod === 'pix') {
        if (settings.paymentGateway.enabled) {
          nextPaymentIntent = await createMercadoPagoPix(
            orderId,
            orderTotal,
            isSubscriptionCheckout
              ? checkoutItems.map((item) => ({
                  id: item.id,
                  name: item.name,
                  quantity: item.quantity,
                  unitPrice: orderTotal,
                }))
              : lines.map((line) => ({
                  id: line.product.id,
                  name: line.product.name,
                  quantity: line.quantity,
                  unitPrice: line.product.price,
                })),
            isSubscriptionCheckout
              ? `Assinatura ${subscriptionCheckoutOrder?.id} - JC Cogumelos`
              : `Pedido ${orderId} - JC Cogumelos`,
          )
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
          throw new Error('Ative a integração de pagamento no painel para gerar Pix.')
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

    if (subscriptionCheckoutOrder) {
      setOrders(
        orders.map((order) =>
          order.id === subscriptionCheckoutOrder.id
            ? {
                ...order,
                paymentMethod: selectedMethod,
                paymentExpiresAt: order.paymentExpiresAt || paymentExpiresAt,
                updatedAt: createdAtIso,
              }
            : order,
        ),
      )
      setCreatedOrderTotal(orderTotal)
      setCreatedOrderId(orderId)
      setPaymentIntent(nextPaymentIntent)
      setPaymentLoading(false)
      return
    }

    setOrders([
      {
        id: orderId,
        customerId: user.id,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        deliveryCep: formatCep(user.cep),
        deliveryAddress: formatCustomerAddress({
          cep: user.cep,
          street: user.street,
          neighborhood: user.neighborhood,
          city: user.city,
          state: user.state,
        }),
        status: 'aguardando_pagamento',
        total: orderTotal,
        createdAt: createdAtIso,
        updatedAt: createdAtIso,
        paymentMethod: selectedMethod,
        paymentExpiresAt,
        statusHistory: [
          createOrderStatusEntry('aguardando_pagamento', createdAtIso),
        ],
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
        <h1>{isSubscriptionCheckout ? 'Pagar assinatura' : 'Finalizar pedido'}</h1>
        <p>
          {isSubscriptionCheckout
            ? 'Finalize o pagamento para ativar ou renovar o período da assinatura.'
            : 'Pagamento Pix com QR Code e acompanhamento do pedido na área do cliente.'}
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
                    alt="QR Code Pix"
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
                    ? 'Pix gerado para este pedido.'
                    : isSubscriptionCheckout
                      ? 'Gere o Pix para ativar a assinatura.'
                      : 'Confirme o pedido para gerar o Pix.'}
                </strong>
                <p>
                  {effectiveOrderId
                    ? `Pedido ${effectiveOrderId} · ${formatCurrency(displayTotal)}`
                    : `Pagamento seguro · ${formatCurrency(displayTotal)}`}
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
          {checkoutItems.length > 0 && (
            <div className="checkout-items">
              {checkoutItems.map((item) => (
                <article className="checkout-item" key={item.id}>
                  {item.product && (
                    <MediaPreview
                      src={item.product.image}
                      alt={item.product.name}
                      mediaType={item.product.mediaType}
                    />
                  )}
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity}x · {formatCurrency(item.subtotal)}
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
            <p>
              {isSubscriptionCheckout
                ? 'A assinatura só fica ativa depois do pagamento e vence ao fim da cadência escolhida.'
                : 'O pedido fica aguardando pagamento por 5 minutos. Depois disso, é cancelado automaticamente.'}
            </p>
          </div>
          <div className="summary-total">
            <span>Total estimado</span>
            <strong>{formatCurrency(displayTotal)}</strong>
          </div>
          <button
            className="primary-button justify-center"
            type="button"
            onClick={createOrder}
            disabled={
              !canConfirmPayment ||
              !isExistingOrderPayable ||
              Boolean(createdOrderId) ||
              paymentLoading
            }
          >
            {paymentLoading
              ? 'Gerando Pix...'
              : createdOrderId
                ? `Pedido ${createdOrderId} criado`
                : isSubscriptionCheckout
                  ? 'Gerar Pix da assinatura'
                  : 'Confirmar pedido'}
          </button>
          {subscriptionCheckoutOrder && !isExistingOrderPayable && (
            <p className="form-error">
              Este pedido de assinatura não está mais aguardando pagamento.
            </p>
          )}
          {hasUnknownSubscriptionCheckout && lines.length === 0 && (
            <p className="form-error">
              Pedido de assinatura não encontrado para esta conta.
            </p>
          )}
        </aside>
      </div>
    </section>
  )
}
