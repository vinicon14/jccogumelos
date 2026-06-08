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
  cancelada: 'Cancelada',
}

export function getNextDeliveryDate(cadence: SubscriptionPlan['cadence']) {
  const date = new Date()
  const daysByCadence: Record<SubscriptionPlan['cadence'], number> = {
    semanal: 7,
    quinzenal: 15,
    mensal: 30,
  }

  date.setDate(date.getDate() + daysByCadence[cadence])
  return date.toISOString()
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
    items: [`Assinatura ${plan.name}`],
  }
}

export function isActiveSubscription(subscription: CustomerSubscription) {
  return subscription.status === 'ativa' || subscription.status === 'pausada'
}

export function isOpenSubscription(subscription: CustomerSubscription) {
  return subscription.status !== 'cancelada'
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
