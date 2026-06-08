import type { Order, OrderStatus, SessionUser } from '../types'

export const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000

export const orderStatusLabels: Record<OrderStatus, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_separacao: 'Em separação',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export const orderTrackingSteps: Array<{ status: OrderStatus; label: string }> = [
  { status: 'aguardando_pagamento', label: 'Pagamento' },
  { status: 'pago', label: 'Pago' },
  { status: 'em_separacao', label: 'Preparo' },
  { status: 'enviado', label: 'Enviado' },
  { status: 'entregue', label: 'Entregue' },
]

const adminVisibleStatuses = new Set<OrderStatus>([
  'aguardando_pagamento',
  'pago',
  'em_separacao',
])

export function isOrderVisibleInAdmin(order: Order) {
  return adminVisibleStatuses.has(order.status)
}

export function getOrderPaymentExpiresAt(order: Order) {
  if (order.paymentExpiresAt) {
    return order.paymentExpiresAt
  }

  if (order.status !== 'aguardando_pagamento') {
    return ''
  }

  const createdAt = new Date(order.createdAt).getTime()

  if (Number.isNaN(createdAt)) {
    return ''
  }

  return new Date(createdAt + PAYMENT_TIMEOUT_MS).toISOString()
}

export function getPaymentRemainingMs(order: Order, now = Date.now()) {
  const expiresAt = getOrderPaymentExpiresAt(order)

  if (!expiresAt) {
    return 0
  }

  return new Date(expiresAt).getTime() - now
}

export function formatPaymentRemaining(order: Order, now = Date.now()) {
  const remaining = Math.max(0, getPaymentRemainingMs(order, now))
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.ceil((remaining % 60000) / 1000)

  if (minutes <= 0 && seconds <= 0) {
    return 'expirado'
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function shouldAutoCancelOrder(order: Order, now = Date.now()) {
  return order.status === 'aguardando_pagamento' && getPaymentRemainingMs(order, now) <= 0
}

export function createOrderStatusEntry(status: OrderStatus, createdAt = new Date().toISOString()) {
  return {
    status,
    label: orderStatusLabels[status],
    createdAt,
  }
}

export function withOrderStatus(order: Order, status: OrderStatus, createdAt = new Date().toISOString()) {
  const history = order.statusHistory ?? [createOrderStatusEntry(order.status, order.createdAt)]
  const nextOrder: Order = {
    ...order,
    status,
    updatedAt: createdAt,
    statusHistory:
      order.status === status
        ? history
        : [...history, createOrderStatusEntry(status, createdAt)],
  }

  if (status === 'pago') {
    nextOrder.paidAt = order.paidAt ?? createdAt
  }

  if (status === 'cancelado') {
    nextOrder.cancelledAt = order.cancelledAt ?? createdAt
  }

  return nextOrder
}

export function withOrderAutoCancellation(orders: Order[], now = Date.now()) {
  let changed = false

  const nextOrders = orders.map((order) => {
    if (!shouldAutoCancelOrder(order, now)) {
      return order
    }

    changed = true
    return withOrderStatus(order, 'cancelado', new Date(now).toISOString())
  })

  return changed ? nextOrders : orders
}

export function orderBelongsToUser(order: Order, user?: SessionUser | null) {
  if (!user) {
    return false
  }

  return (
    order.customerId === user.id ||
    order.customerEmail === user.email ||
    (!order.customerId && !order.customerEmail && order.customerName === user.name)
  )
}

export function getOrderTrackingIndex(status: OrderStatus) {
  return orderTrackingSteps.findIndex((step) => step.status === status)
}
