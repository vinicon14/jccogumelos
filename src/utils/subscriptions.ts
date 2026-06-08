import type {
  CustomerSubscription,
  SessionUser,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../types'
import { formatCep, formatCustomerAddress } from './customers'

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
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
    status: 'ativa',
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

export function isActiveSubscription(subscription: CustomerSubscription) {
  return subscription.status === 'ativa' || subscription.status === 'pausada'
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
      isActiveSubscription(subscription),
  )
}
