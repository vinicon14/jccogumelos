import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  blogPosts as seedBlogPosts,
  customerSubscriptions as seedCustomerSubscriptions,
  coupons as seedCoupons,
  orders as seedOrders,
  products as seedProducts,
  storeSettings as seedStoreSettings,
  subscriptionPlans as seedSubscriptionPlans,
} from '../data/mockData'
import type {
  BlogPost,
  Coupon,
  CustomerSubscription,
  Order,
  Product,
  StoreSettings,
  StoreNotification,
  SubscriptionPlan,
} from '../types'
import { withOrderAutoCancellation } from '../utils/orders'
import { StoreContext } from './storeContextValue'

const STORE_STORAGE_KEY = 'jc-cogumelos-store-v1'

interface StoredState {
  products: Product[]
  subscriptionPlans: SubscriptionPlan[]
  customerSubscriptions: CustomerSubscription[]
  coupons: Coupon[]
  orders: Order[]
  blogPosts: BlogPost[]
  notifications: StoreNotification[]
  settings: StoreSettings
}

const defaultState: StoredState = {
  products: seedProducts,
  subscriptionPlans: seedSubscriptionPlans,
  customerSubscriptions: seedCustomerSubscriptions,
  coupons: seedCoupons,
  orders: seedOrders,
  blogPosts: seedBlogPosts,
  notifications: [],
  settings: seedStoreSettings,
}

const validOrderStatuses = new Set([
  'aguardando_pagamento',
  'pago',
  'em_separacao',
  'enviado',
  'entregue',
  'cancelado',
])

const validSubscriptionStatuses = new Set(['ativa', 'pausada', 'cancelada'])
const validSubscriptionCadences = new Set(['semanal', 'quinzenal', 'mensal'])

function asText(value: unknown) {
  return String(value || '').trim()
}

function normalizeOrder(order: Partial<Order>): Order {
  const createdAt = asText(order.createdAt) || new Date().toISOString()
  const status = (validOrderStatuses.has(asText(order.status))
    ? order.status
    : 'aguardando_pagamento') as Order['status']

  return {
    id: asText(order.id) || `JC-${Date.now().toString().slice(-6)}`,
    customerId: asText(order.customerId),
    customerName: asText(order.customerName) || 'Cliente',
    customerEmail: asText(order.customerEmail),
    customerPhone: asText(order.customerPhone),
    deliveryCep: asText(order.deliveryCep),
    deliveryAddress: asText(order.deliveryAddress),
    status,
    total: Number(order.total) || 0,
    createdAt,
    updatedAt: asText(order.updatedAt) || createdAt,
    paymentMethod: order.paymentMethod,
    paymentExpiresAt: asText(order.paymentExpiresAt),
    paidAt: asText(order.paidAt),
    cancelledAt: asText(order.cancelledAt),
    statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
    items: Array.isArray(order.items) ? order.items.map(String) : [],
  }
}

function normalizeSubscription(subscription: Partial<CustomerSubscription>): CustomerSubscription {
  const createdAt = asText(subscription.createdAt) || new Date().toISOString()
  const status = (validSubscriptionStatuses.has(asText(subscription.status))
    ? subscription.status
    : 'ativa') as CustomerSubscription['status']
  const cadence = (validSubscriptionCadences.has(asText(subscription.cadence))
    ? subscription.cadence
    : 'mensal') as CustomerSubscription['cadence']

  return {
    id: asText(subscription.id) || crypto.randomUUID(),
    planId: asText(subscription.planId),
    planName: asText(subscription.planName) || 'Assinatura',
    cadence,
    price: Number(subscription.price) || 0,
    status,
    customerId: asText(subscription.customerId),
    customerName: asText(subscription.customerName) || 'Cliente',
    customerEmail: asText(subscription.customerEmail),
    customerPhone: asText(subscription.customerPhone),
    deliveryCep: asText(subscription.deliveryCep),
    deliveryAddress: asText(subscription.deliveryAddress) || 'Endereço não cadastrado',
    createdAt,
    nextDeliveryAt: asText(subscription.nextDeliveryAt) || createdAt,
    lastUpdatedAt: asText(subscription.lastUpdatedAt) || createdAt,
  }
}

function normalizeState(state: Partial<StoredState>): StoredState {
  const incomingSettings = state.settings
  const incomingGateway = incomingSettings?.paymentGateway
  const mergedPaymentGateway = {
    ...seedStoreSettings.paymentGateway,
    ...incomingGateway,
  }
  const legacyEmptyGateway =
    incomingGateway &&
    incomingGateway.provider === 'Banco' &&
    !incomingGateway.apiEndpoint &&
    String(incomingGateway.webhookUrl || '').includes('/api/payment-webhook')

  return {
    ...defaultState,
    ...state,
    customerSubscriptions: (
      state.customerSubscriptions ?? defaultState.customerSubscriptions
    ).map(normalizeSubscription),
    orders: withOrderAutoCancellation(
      (state.orders ?? defaultState.orders).map(normalizeOrder),
    ),
    settings: {
      ...seedStoreSettings,
      ...incomingSettings,
      paymentGateway: legacyEmptyGateway
        ? {
            ...mergedPaymentGateway,
            enabled: true,
            provider: 'Mercado Pago',
            apiEndpoint: seedStoreSettings.paymentGateway.apiEndpoint,
            apiCode: seedStoreSettings.paymentGateway.apiCode,
            pixExpirationMinutes: seedStoreSettings.paymentGateway.pixExpirationMinutes,
            webhookUrl: seedStoreSettings.paymentGateway.webhookUrl,
            fallbackQrEnabled: false,
          }
        : mergedPaymentGateway,
    },
  }
}

function readStoredState(): StoredState {
  if (typeof window === 'undefined') {
    return defaultState
  }

  try {
    const raw = window.localStorage.getItem(STORE_STORAGE_KEY)
    return raw ? normalizeState(JSON.parse(raw) as Partial<StoredState>) : defaultState
  } catch {
    return defaultState
  }
}

function persistState(state: StoredState) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.warn('Não foi possível salvar todos os dados locais.', error)
    }
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(readStoredState)

  const updateState = useCallback((patch: Partial<StoredState>) => {
    setState((current) => {
      const nextState = { ...current, ...patch }
      persistState(nextState)
      return nextState
    })
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      setProducts: (products: Product[]) => updateState({ products }),
      setSubscriptionPlans: (subscriptionPlans: SubscriptionPlan[]) =>
        updateState({ subscriptionPlans }),
      setCustomerSubscriptions: (customerSubscriptions: CustomerSubscription[]) =>
        updateState({ customerSubscriptions }),
      setCoupons: (coupons: Coupon[]) => updateState({ coupons }),
      setOrders: (orders: Order[]) => updateState({ orders }),
      setBlogPosts: (blogPosts: BlogPost[]) => updateState({ blogPosts }),
      setNotifications: (notifications: StoreNotification[]) =>
        updateState({ notifications }),
      setSettings: (settings: StoreSettings | ((current: StoreSettings) => StoreSettings)) =>
        updateState({
          settings:
            typeof settings === 'function' ? settings(state.settings) : settings,
        }),
    }),
    [state, updateState],
  )

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((current) => {
        const orders = withOrderAutoCancellation(current.orders)

        if (orders === current.orders) {
          return current
        }

        const nextState = { ...current, orders }
        persistState(nextState)
        return nextState
      })
    }, 10000)

    return () => window.clearInterval(interval)
  }, [])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
