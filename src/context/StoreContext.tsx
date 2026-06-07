import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  blogPosts as seedBlogPosts,
  coupons as seedCoupons,
  orders as seedOrders,
  products as seedProducts,
  subscriptionPlans as seedSubscriptionPlans,
} from '../data/mockData'
import type { BlogPost, Coupon, Order, Product, SubscriptionPlan } from '../types'
import { StoreContext } from './storeContextValue'

const STORE_STORAGE_KEY = 'jc-cogumelos-store-v1'

interface StoredState {
  products: Product[]
  subscriptionPlans: SubscriptionPlan[]
  coupons: Coupon[]
  orders: Order[]
  blogPosts: BlogPost[]
}

const defaultState: StoredState = {
  products: seedProducts,
  subscriptionPlans: seedSubscriptionPlans,
  coupons: seedCoupons,
  orders: seedOrders,
  blogPosts: seedBlogPosts,
}

function readStoredState(): StoredState {
  if (typeof window === 'undefined') {
    return defaultState
  }

  try {
    const raw = window.localStorage.getItem(STORE_STORAGE_KEY)
    return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState
  } catch {
    return defaultState
  }
}

function persistState(state: StoredState) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(state))
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
    }),
    [state, updateState],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
