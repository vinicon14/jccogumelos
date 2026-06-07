import { createContext } from 'react'
import type {
  BlogPost,
  Coupon,
  Order,
  Product,
  StoreNotification,
  SubscriptionPlan,
} from '../types'

export interface StoreContextValue {
  products: Product[]
  subscriptionPlans: SubscriptionPlan[]
  coupons: Coupon[]
  orders: Order[]
  blogPosts: BlogPost[]
  notifications: StoreNotification[]
  setProducts: (products: Product[]) => void
  setSubscriptionPlans: (plans: SubscriptionPlan[]) => void
  setCoupons: (coupons: Coupon[]) => void
  setOrders: (orders: Order[]) => void
  setBlogPosts: (posts: BlogPost[]) => void
  setNotifications: (notifications: StoreNotification[]) => void
}

export const StoreContext = createContext<StoreContextValue | undefined>(undefined)
