import type {
  CustomerSubscription,
  Order,
  SessionUser,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../types'
import { formatCep, formatCustomerAddress } from './customers'
import { createOrderStatusEntry, PAYMENT_TIMEOUT_MS } from './orders'

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  ativa: 'Ativa',
  pausada: 'Pausada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}

export const daysByCadence: Record<SubscriptionPlan['cadence'], number> = {
  semanal: 7,
  quinzenal: 15,
  mensal: 30,
}

export function getCadencePeriodEndDate(
  cadence: SubscriptionPlan['cadence'],
  startsAt: string | Date = new Date(),
) {
  const date = startsAt instanceof Date ? new Date(startsAt) : new Date(startsAt)

  date.setDate(date.getDate() + daysByCadence[cadence])
  return date.toISOString()
}

export function getNextDeliveryDate(cadence: SubscriptionPlan['cadence']) {
  return getCadencePeriodEndDate(cadence)
}

export function createCustomerSubscription({
  plan,
  user,
}: {
  plan: SubscriptionPlan
  user: SessionUser
}): CustomerSubscription {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    planId: plan.id,
    planName: plan.name,
    cadence: plan.cadence,
    price: plan.price,
    status: 'aguardando_pagamento',
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
    createdAt: now,
    nextDeliveryAt: getNextDeliveryDate(plan.cadence),
    expiresAt: '',
    lastUpdatedAt: now,
  }
}

export function createSubscriptionPaymentOrder({
  subscription,
  plan,
  user,
}: {
  subscription: CustomerSubscription
  plan: SubscriptionPlan
  user: SessionUser
}): Order {
  const createdAt = new Date()
  const createdAtIso = createdAt.toISOString()
  const paymentExpiresAt = new Date(createdAt.getTime() + PAYMENT_TIMEOUT_MS).toISOString()

  return {
    id: `JC-AS-${Date.now().toString().slice(-6)}`,
    orderKind: 'subscription',
    subscriptionId: subscription.id,
    customerId: user.id,
    customerName: user.name,
    customerEmail: user.email,
    customerPhone: user.phone,
    deliveryCep: subscription.deliveryCep,
    deliveryAddress: subscription.deliveryAddress,
    status: 'aguardando_pagamento',
    total: plan.price,
    createdAt: createdAtIso,
    updatedAt: createdAtIso,
    paymentMethod: 'pix',
    paymentExpiresAt,
    statusHistory: [createOrderStatusEntry('aguardando_pagamento', createdAtIso)],
    items: [
      `${subscription.expiresAt ? 'Renovação' : 'Assinatura'} ${plan.name}`,
    ],
  }
}

export function isActiveSubscription(subscription: CustomerSubscription) {
  return (
    (subscription.status === 'ativa' || subscription.status === 'pausada') &&
    !isSubscriptionExpired(subscription)
  )
}

export function isOpenSubscription(subscription: CustomerSubscription) {
  return subscription.status !== 'cancelada' && subscription.status !== 'vencida'
}

export function isSubscriptionExpired(
  subscription: CustomerSubscription,
  now = Date.now(),
) {
  return (
    Boolean(subscription.expiresAt) &&
    Date.parse(subscription.expiresAt) <= now
  )
}

export function activateSubscriptionForPaidOrder(
  subscription: CustomerSubscription,
  order: Order,
): CustomerSubscription {
  const activatedAt = order.paidAt || order.updatedAt || new Date().toISOString()
  const expiresAt = getCadencePeriodEndDate(subscription.cadence, activatedAt)

  return {
    ...subscription,
    status: 'ativa',
    expiresAt,
    nextDeliveryAt: expiresAt,
    lastUpdatedAt: activatedAt,
  }
}

export function markSubscriptionAwaitingRenewal(
  subscription: CustomerSubscription,
): CustomerSubscription {
  const now = new Date().toISOString()

  return {
    ...subscription,
    status: 'aguardando_pagamento',
    lastUpdatedAt: now,
  }
}

export function expireSubscriptionIfNeeded(
  subscription: CustomerSubscription,
  now = Date.now(),
): CustomerSubscription {
  if (
    (subscription.status === 'ativa' || subscription.status === 'pausada') &&
    isSubscriptionExpired(subscription, now)
  ) {
    return {
      ...subscription,
      status: 'vencida',
      lastUpdatedAt: new Date(now).toISOString(),
    }
  }

  return subscription
}

export function canSubscribeToPlan({
  subscriptions,
  planId,
  userId,
}: {
  subscriptions: CustomerSubscription[]
  planId: string
  userId: string
}) {
  return !subscriptions.some(
    (subscription) =>
      subscription.customerId === userId &&
      subscription.planId === planId &&
      isOpenSubscription(subscription),
  )
}
