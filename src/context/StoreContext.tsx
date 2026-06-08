import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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
  BlogMedia,
  BlogPost,
  Coupon,
  CustomerSubscription,
  Order,
  Product,
  StoreSettings,
  StoreNotification,
  SubscriptionPlan,
  WholesalePreorder,
  WholesaleQueueStatus,
} from '../types'
import {
  loadRemotePayload,
  saveRemotePayload,
  subscribeRemotePayload,
} from '../services/remotePersistence'
import { withOrderAutoCancellation } from '../utils/orders'
import { StoreContext, type PersistenceStatus } from './storeContextValue'

const STORE_STORAGE_KEY = 'jc-cogumelos-store-v1'
const STORE_REMOTE_ID = 'store'

interface StoredState {
  products: Product[]
  subscriptionPlans: SubscriptionPlan[]
  customerSubscriptions: CustomerSubscription[]
  coupons: Coupon[]
  orders: Order[]
  wholesalePreorders: WholesalePreorder[]
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
  wholesalePreorders: [],
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
validSubscriptionStatuses.add('aguardando_pagamento')
const validSubscriptionCadences = new Set(['semanal', 'quinzenal', 'mensal'])
const validAssistantApiModes = new Set([
  'responses',
  'chat_completions',
  'gemini',
  'generic_json',
])
const validWholesaleQueueStatuses = new Set([
  'na_fila',
  'em_producao',
  'disponivel',
  'atendida',
  'cancelada',
])

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
    orderKind: order.orderKind === 'subscription' ? 'subscription' : 'product',
    subscriptionId: asText(order.subscriptionId),
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

function syncSubscriptionPaymentState(state: StoredState): StoredState {
  let changed = false
  const orderBySubscriptionId = new Map(
    state.orders
      .filter((order) => order.orderKind === 'subscription' && order.subscriptionId)
      .map((order) => [order.subscriptionId, order]),
  )

  const customerSubscriptions = state.customerSubscriptions.map((subscription) => {
    const order = orderBySubscriptionId.get(subscription.id)

    if (!order || subscription.status !== 'aguardando_pagamento') {
      return subscription
    }

    if (order.status === 'pago') {
      changed = true
      return {
        ...subscription,
        status: 'ativa' as CustomerSubscription['status'],
        lastUpdatedAt: order.updatedAt || new Date().toISOString(),
      }
    }

    if (order.status === 'cancelado') {
      changed = true
      return {
        ...subscription,
        status: 'cancelada' as CustomerSubscription['status'],
        lastUpdatedAt: order.updatedAt || new Date().toISOString(),
      }
    }

    return subscription
  })

  return changed ? { ...state, customerSubscriptions } : state
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

function normalizeWholesalePreorder(
  preorder: Partial<WholesalePreorder>,
): WholesalePreorder {
  const createdAt = asText(preorder.createdAt) || new Date().toISOString()
  const status = (validWholesaleQueueStatuses.has(asText(preorder.status))
    ? preorder.status
    : 'na_fila') as WholesaleQueueStatus

  return {
    id: asText(preorder.id) || crypto.randomUUID(),
    queueNumber: Math.max(1, Number(preorder.queueNumber) || 1),
    productId: asText(preorder.productId),
    productName: asText(preorder.productName) || 'Produto sob encomenda',
    productImage: asText(preorder.productImage),
    productWeight: asText(preorder.productWeight),
    requestedQuantity: Math.max(1, Number(preorder.requestedQuantity) || 1),
    unitPrice: Number(preorder.unitPrice) || 0,
    customerId: asText(preorder.customerId),
    customerName: asText(preorder.customerName) || 'Cliente atacado',
    customerEmail: asText(preorder.customerEmail),
    customerPhone: asText(preorder.customerPhone),
    deliveryCep: asText(preorder.deliveryCep),
    deliveryAddress: asText(preorder.deliveryAddress) || 'Endereço não cadastrado',
    status,
    note: asText(preorder.note),
    createdAt,
    updatedAt: asText(preorder.updatedAt) || createdAt,
  }
}

function normalizeBlogMedia(media: Partial<BlogMedia>, index = 0): BlogMedia | null {
  const url = asText(media.url)

  if (!url) {
    return null
  }

  return {
    id: asText(media.id) || crypto.randomUUID(),
    url,
    mediaType: media.mediaType === 'video' ? 'video' : 'image',
    alt: asText(media.alt) || `Mídia ${index + 1}`,
  }
}

function normalizeBlogPost(post: Partial<BlogPost>): BlogPost {
  const legacyMedia =
    asText(post.image) && !post.media?.length
      ? [
          {
            id: crypto.randomUUID(),
            url: asText(post.image),
            mediaType: (post.mediaType === 'video' ? 'video' : 'image') as BlogMedia['mediaType'],
            alt: asText(post.title),
          },
        ]
      : []
  const media = (post.media ?? legacyMedia)
    .map((item, index) => normalizeBlogMedia(item, index))
    .filter(Boolean) as BlogMedia[]
  const cover = media[0]

  return {
    id: asText(post.id) || crypto.randomUUID(),
    title: asText(post.title) || 'Post',
    excerpt: asText(post.excerpt),
    content: asText(post.content),
    image: cover?.url || asText(post.image),
    mediaType: cover?.mediaType || post.mediaType || 'image',
    media,
    published: Boolean(post.published),
    createdAt: asText(post.createdAt) || new Date().toISOString(),
    source: post.source === 'instagram' ? 'instagram' : 'manual',
    sourceId: asText(post.sourceId),
    sourceUrl: asText(post.sourceUrl),
  }
}

function normalizeState(state: Partial<StoredState>): StoredState {
  const incomingSettings = state.settings
  const incomingGateway = incomingSettings?.paymentGateway
  const incomingAssistantApi = incomingSettings?.assistantApi
  const mergedPaymentGateway = {
    ...seedStoreSettings.paymentGateway,
    ...incomingGateway,
  }
  const assistantApiMode = asText(incomingAssistantApi?.mode)
  const mergedAssistantApi = {
    ...seedStoreSettings.assistantApi,
    ...incomingAssistantApi,
    mode: (validAssistantApiModes.has(assistantApiMode)
      ? assistantApiMode
      : seedStoreSettings.assistantApi.mode) as StoreSettings['assistantApi']['mode'],
  }
  const legacyEmptyGateway =
    incomingGateway &&
    incomingGateway.provider === 'Banco' &&
    !incomingGateway.apiEndpoint &&
    String(incomingGateway.webhookUrl || '').includes('/api/payment-webhook')

  return syncSubscriptionPaymentState({
    ...defaultState,
    ...state,
    customerSubscriptions: (
      state.customerSubscriptions ?? defaultState.customerSubscriptions
    ).map(normalizeSubscription),
    orders: withOrderAutoCancellation(
      (state.orders ?? defaultState.orders).map(normalizeOrder),
    ),
    wholesalePreorders: (
      state.wholesalePreorders ?? defaultState.wholesalePreorders
    ).map(normalizeWholesalePreorder),
    blogPosts: (state.blogPosts ?? defaultState.blogPosts).map(normalizeBlogPost),
    settings: {
      ...seedStoreSettings,
      ...incomingSettings,
      assistantApi: mergedAssistantApi,
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
  })
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
      return true
    } catch (error) {
      console.warn('Não foi possível salvar todos os dados locais.', error)
      return false
    }
  }

  return false
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(readStoredState)
  const [persistenceStatus, setPersistenceStatus] =
    useState<PersistenceStatus>('idle')
  const [lastPersistedAt, setLastPersistedAt] = useState('')
  const [persistenceMessage, setPersistenceMessage] = useState(
    'Alterações ainda não salvas nesta sessão.',
  )
  const stateRef = useRef(state)
  const remoteSaveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const persistRemoteNow = useCallback(
    async (nextState: StoredState, manual = false) => {
      const localSaved = persistState(nextState)

      setPersistenceStatus('saving')
      setPersistenceMessage(
        manual ? 'Salvando alterações no banco...' : 'Salvando automaticamente...',
      )

      const remoteSaved = await saveRemotePayload(STORE_REMOTE_ID, nextState)
      const now = new Date().toISOString()

      if (remoteSaved) {
        setPersistenceStatus('saved')
        setLastPersistedAt(now)
        setPersistenceMessage('Alterações salvas no banco de dados.')
        return true
      }

      if (localSaved) {
        setPersistenceStatus('local_only')
        setLastPersistedAt(now)
        setPersistenceMessage(
          'Salvo neste aparelho. A tabela app_state do Supabase precisa estar ativa para sincronizar.',
        )
        return false
      }

      setPersistenceStatus('error')
      setPersistenceMessage('Não foi possível salvar. Verifique o armazenamento do navegador.')
      return false
    },
    [],
  )

  const queueRemoteSave = useCallback(
    (nextState: StoredState) => {
      window.clearTimeout(remoteSaveTimer.current)
      remoteSaveTimer.current = window.setTimeout(() => {
        void persistRemoteNow(nextState)
      }, 700)
    },
    [persistRemoteNow],
  )

  const persistEverywhere = useCallback(
    (nextState: StoredState) => {
      persistState(nextState)
      queueRemoteSave(nextState)
    },
    [queueRemoteSave],
  )

  const updateState = useCallback((patch: Partial<StoredState>) => {
    setState((current) => {
      const nextState = syncSubscriptionPaymentState({ ...current, ...patch })
      persistEverywhere(nextState)
      return nextState
    })
  }, [persistEverywhere])

  const saveStoreNow = useCallback(async () => {
    window.clearTimeout(remoteSaveTimer.current)
    return persistRemoteNow(stateRef.current, true)
  }, [persistRemoteNow])

  const value = useMemo(
    () => ({
      ...state,
      persistenceStatus,
      lastPersistedAt,
      persistenceMessage,
      saveStoreNow,
      setProducts: (products: Product[]) => updateState({ products }),
      setSubscriptionPlans: (subscriptionPlans: SubscriptionPlan[]) =>
        updateState({ subscriptionPlans }),
      setCustomerSubscriptions: (customerSubscriptions: CustomerSubscription[]) =>
        updateState({ customerSubscriptions }),
      setCoupons: (coupons: Coupon[]) => updateState({ coupons }),
      setOrders: (orders: Order[]) => updateState({ orders }),
      setWholesalePreorders: (wholesalePreorders: WholesalePreorder[]) =>
        updateState({ wholesalePreorders }),
      setBlogPosts: (blogPosts: BlogPost[]) => updateState({ blogPosts }),
      setNotifications: (notifications: StoreNotification[]) =>
        updateState({ notifications }),
      setSettings: (settings: StoreSettings | ((current: StoreSettings) => StoreSettings)) =>
        updateState({
          settings:
            typeof settings === 'function' ? settings(state.settings) : settings,
        }),
    }),
    [
      lastPersistedAt,
      persistenceMessage,
      persistenceStatus,
      saveStoreNow,
      state,
      updateState,
    ],
  )

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((current) => {
        const orders = withOrderAutoCancellation(current.orders)

        if (orders === current.orders) {
          return current
        }

        const nextState = syncSubscriptionPaymentState({ ...current, orders })
        persistEverywhere(nextState)
        return nextState
      })
    }, 10000)

    return () => window.clearInterval(interval)
  }, [persistEverywhere])

  useEffect(() => {
    let active = true

    async function refreshFromRemote(seedIfEmpty = false) {
      const remoteState = await loadRemotePayload<Partial<StoredState>>(STORE_REMOTE_ID)

      if (!active) {
        return
      }

      if (remoteState) {
        const nextState = normalizeState(remoteState)
        persistState(nextState)
        setState(nextState)
        setPersistenceStatus('saved')
        setLastPersistedAt(new Date().toISOString())
        setPersistenceMessage('Dados carregados do banco.')
        return
      }

      if (seedIfEmpty) {
        void persistRemoteNow(stateRef.current)
      }
    }

    void refreshFromRemote(true)

    const unsubscribe = subscribeRemotePayload<Partial<StoredState>>(
      STORE_REMOTE_ID,
      (remoteState) => {
        const nextState = normalizeState(remoteState)
        persistState(nextState)
        setState(nextState)
        setPersistenceStatus('saved')
        setLastPersistedAt(new Date().toISOString())
        setPersistenceMessage('Dados sincronizados do banco.')
      },
    )

    function handleFocus() {
      void refreshFromRemote()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      active = false
      window.clearTimeout(remoteSaveTimer.current)
      window.removeEventListener('focus', handleFocus)
      unsubscribe()
    }
  }, [persistRemoteNow])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
