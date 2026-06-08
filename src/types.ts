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
export type PaymentEnvironment = 'sandbox' | 'production'
export type SubscriptionStatus =
  | 'aguardando_pagamento'
  | 'ativa'
  | 'pausada'
  | 'vencida'
  | 'cancelada'
export type WholesaleQueueStatus =
  | 'na_fila'
  | 'em_producao'
  | 'disponivel'
  | 'atendida'
  | 'cancelada'

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
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
  accountType: AccountType
  loyaltyPoints: number
}

export interface RegisteredCustomer {
  id: string
  name: string
  email: string
  phone: string
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
  accountType: AccountType
  createdAt: string
}

export interface Order {
  id: string
  orderKind?: 'product' | 'subscription'
  subscriptionId?: string
  customerId?: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  deliveryCep?: string
  deliveryAddress?: string
  status: OrderStatus
  total: number
  createdAt: string
  updatedAt?: string
  paymentMethod?: PaymentMethod
  paymentExpiresAt?: string
  paidAt?: string
  cancelledAt?: string
  statusHistory?: OrderStatusHistory[]
  items: string[]
}

export interface OrderStatusHistory {
  status: OrderStatus
  label: string
  createdAt: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  cadence: 'semanal' | 'quinzenal' | 'mensal'
  price: number
  description: string
}

export interface CustomerSubscription {
  id: string
  planId: string
  planName: string
  cadence: SubscriptionPlan['cadence']
  price: number
  status: SubscriptionStatus
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  deliveryCep: string
  deliveryAddress: string
  createdAt: string
  nextDeliveryAt: string
  expiresAt: string
  lastUpdatedAt: string
}

export interface WholesalePreorder {
  id: string
  queueNumber: number
  productId: string
  productName: string
  productImage: string
  productWeight: string
  requestedQuantity: number
  unitPrice: number
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  deliveryCep: string
  deliveryAddress: string
  status: WholesaleQueueStatus
  note: string
  createdAt: string
  updatedAt: string
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
  media?: BlogMedia[]
  published: boolean
  createdAt: string
  source?: 'manual' | 'instagram'
  sourceId?: string
  sourceUrl?: string
}

export interface BlogMedia {
  id: string
  url: string
  mediaType: MediaType
  alt?: string
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

export interface PaymentGatewayConfig {
  enabled: boolean
  provider: string
  environment: PaymentEnvironment
  apiEndpoint: string
  apiCode: string
  apiSecret: string
  merchantId: string
  pixKey: string
  pixReceiverName: string
  pixReceiverCity: string
  pixExpirationMinutes: number
  webhookUrl: string
  fallbackQrEnabled: boolean
}

export interface PaymentIntent {
  provider: 'mercado_pago' | 'local'
  mode: string
  paymentId: string
  orderId: string
  status: string
  statusDetail: string
  externalReference: string
  qrCode: string
  qrCodeBase64: string
  ticketUrl: string
  rawStatus?: string | null
}

export type AssistantApiMode =
  | 'responses'
  | 'chat_completions'
  | 'gemini'
  | 'generic_json'

export interface AssistantApiConfig {
  provider: string
  endpoint: string
  model: string
  mode: AssistantApiMode
}

export interface StoreSettings {
  companyName: string
  instagram: string
  facebook: string
  whatsapp: string
  email: string
  shippingBase: number
  pixEnabled: boolean
  creditEnabled: boolean
  debitEnabled: boolean
  josaninhaEnabled: boolean
  whatsappAutoEnabled: boolean
  assistantBehavior: string
  assistantApi: AssistantApiConfig
  businessHours: string
  instagramUserId: string
  paymentGateway: PaymentGatewayConfig
}

export type UserRole = 'customer' | 'admin'

export interface SessionUser {
  id: string
  name: string
  email: string
  phone: string
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
  accountType: AccountType
  role: UserRole
  adminToken?: string
  adminExpiresAt?: number
}
