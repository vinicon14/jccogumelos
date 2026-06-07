export type AccountType = 'varejo' | 'atacado'
export type MediaType = 'image' | 'video'
export type NotificationAudience = 'admin' | 'customer'

export type ProductCategory =
  | 'frescos'
  | 'kits'
  | 'desidratados'
  | 'insumos'
  | 'assinaturas'

export type PaymentMethod = 'pix' | 'credito' | 'debito'

export type OrderStatus =
  | 'aguardando_pagamento'
  | 'pago'
  | 'em_separacao'
  | 'enviado'
  | 'entregue'
  | 'cancelado'

export interface Product {
  id: string
  name: string
  category: ProductCategory
  description: string
  benefits: string[]
  weight: string
  price: number
  wholesalePrice?: number
  stock: number
  rating: number
  reviews: number
  nutrition: string
  image: string
  mediaType?: MediaType
  tags: string[]
  bestSeller?: boolean
  isNew?: boolean
}

export interface CartItem {
  productId: string
  quantity: number
}

export interface CustomerProfile {
  id: string
  fullName: string
  email: string
  phone: string
  city: string
  accountType: AccountType
  loyaltyPoints: number
}

export interface Order {
  id: string
  customerName: string
  status: OrderStatus
  total: number
  createdAt: string
  items: string[]
}

export interface SubscriptionPlan {
  id: string
  name: string
  cadence: 'semanal' | 'quinzenal' | 'mensal'
  price: number
  description: string
}

export interface Coupon {
  code: string
  type: 'percent' | 'fixed' | 'shipping'
  value: number
  minOrder: number
  expiresAt: string
  maxUses: number
}

export interface BlogPost {
  id: string
  title: string
  excerpt: string
  content: string
  image: string
  mediaType?: MediaType
  published: boolean
  createdAt: string
}

export interface StoreNotification {
  id: string
  audience: NotificationAudience
  title: string
  message: string
  createdAt: string
  read: boolean
  link?: string
}

export type UserRole = 'customer' | 'admin'

export interface SessionUser {
  id: string
  name: string
  email: string
  phone: string
  city: string
  accountType: AccountType
  role: UserRole
  adminToken?: string
  adminExpiresAt?: number
}
