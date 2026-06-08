import { createContext, type SetStateAction } from 'react'
import type {
  BlogPost,
  Coupon,
  CustomerSubscription,
  Order,
  Product,
  StoreSettings,
  StoreNotification,
  SubscriptionPlan,
  WholesalePreorder,
} from '../types'

export interface StoreContextValue {
  products: Product[]
  subscriptionPlans: SubscriptionPlan[]
  customerSubscriptions: CustomerSubscription[]
  coupons: Coupon[]
  orders: Order[]
  wholesalePreorders: WholesalePreorder[]
  blogPosts: BlogPost[]
  notifications: StoreNotification[]
  settings: StoreSettings
  setProducts: (products: Product[]) => void
  setSubscriptionPlans: (plans: SubscriptionPlan[]) => void
  setCustomerSubscriptions: (subscriptions: CustomerSubscription[]) => void
  setCoupons: (coupons: Coupon[]) => void
  setOrders: (orders: Order[]) => void
  setWholesalePreorders: (preorders: WholesalePreorder[]) => void
  setBlogPosts: (posts: BlogPost[]) => void
  setNotifications: (notifications: StoreNotification[]) => void
  setSettings: (settings: SetStateAction<StoreSettings>) => void
}

export const StoreContext = createContext<StoreContextValue | undefined>(undefined)
