import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  blogPosts as seedBlogPosts,
  coupons as seedCoupons,
  orders as seedOrders,
  products as seedProducts,
  storeSettings as seedStoreSettings,
  subscriptionPlans as seedSubscriptionPlans,
} from '../data/mockData'
import type {
  BlogPost,
  Coupon,
  Order,
  Product,
  StoreSettings,
  StoreNotification,
  SubscriptionPlan,
} from '../types'
import { StoreContext } from './storeContextValue'

const STORE_STORAGE_KEY = 'jc-cogumelos-store-v1'

interface StoredState {
  products: Product[]
  subscriptionPlans: SubscriptionPlan[]
  coupons: Coupon[]
  orders: Order[]
  blogPosts: BlogPost[]
  notifications: StoreNotification[]
  settings: StoreSettings
}

const defaultState: StoredState = {
  products: seedProducts,
  subscriptionPlans: seedSubscriptionPlans,
  coupons: seedCoupons,
  orders: seedOrders,
  blogPosts: seedBlogPosts,
  notifications: [],
  settings: seedStoreSettings,
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

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
