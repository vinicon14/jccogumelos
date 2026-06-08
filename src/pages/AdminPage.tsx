import {
  BadgeCheck,
  Boxes,
  CalendarClock,
  FilePlus2,
  DownloadCloud,
  Hash,
  Image as ImageIcon,
  KeyRound,
  Mail,
  MapPin,
  MessageCircle,
  PauseCircle,
  Percent,
  Phone,
  PlayCircle,
  Plus,
  QrCode,
  Save,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  UsersRound,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadBlogPostsFromDb, saveBlogPostToDb, deleteBlogPostFromDb } from '../services/blogPostSync'
import { MediaPreview } from '../components/MediaPreview'
import { useAuth } from '../context/useAuth'
import { useStore } from '../context/useStore'
import type {
  BlogPost,
  BlogMedia,
  AssistantApiConfig,
  Coupon,
  CustomerSubscription,
  Order,
  OrderStatus,
  PaymentGatewayConfig,
  Product,
  ProductCategory,
  SubscriptionStatus,
  SubscriptionPlan,
  WholesalePreorder,
  WholesaleQueueStatus,
} from '../types'
import {
  formatCep,
  formatCustomerAddress,
  normalizeAccountType,
  readStoredCustomers,
  readSyncedCustomers,
} from '../utils/customers'
import { formatCurrency, formatDate } from '../utils/format'
import { inferMediaType, readMediaFile } from '../utils/media'
import { isOrderVisibleInAdmin, withOrderStatus } from '../utils/orders'
import { subscriptionStatusLabels } from '../utils/subscriptions'
import {
  formatWholesaleQueueNumber,
  getWholesaleQueuePosition,
  isWholesaleQueueActive,
  wholesaleQueueStatusLabels,
} from '../utils/wholesalePreorders'

const statusLabels: Record<OrderStatus, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_separacao: 'Em separação',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const categoryLabels: Record<ProductCategory, string> = {
  frescos: 'Frescos',
  kits: 'Kits',
  desidratados: 'Desidratados',
  insumos: 'Insumos',
  assinaturas: 'Assinaturas',
}

const productCategories = Object.keys(categoryLabels) as ProductCategory[]
const orderStatuses = Object.keys(statusLabels) as OrderStatus[]
const subscriptionStatuses = Object.keys(subscriptionStatusLabels) as SubscriptionStatus[]
const wholesaleQueueStatuses = Object.keys(
  wholesaleQueueStatusLabels,
) as WholesaleQueueStatus[]

function createProduct(): Product {
  return {
    id: crypto.randomUUID(),
    name: 'Novo produto',
    category: 'frescos',
    description: '',
    benefits: [],
    weight: '',
    price: 0,
    wholesalePrice: 0,
    stock: 0,
    rating: 5,
    reviews: 0,
    nutrition: '',
    image: '',
    mediaType: 'image',
    tags: [],
  }
}

function createPlan(): SubscriptionPlan {
  return {
    id: crypto.randomUUID(),
    name: 'Novo plano',
    cadence: 'mensal',
    price: 0,
    description: '',
  }
}

function createCoupon(): Coupon {
  return {
    code: `CUPOM${Date.now().toString().slice(-4)}`,
    type: 'percent',
    value: 0,
    minOrder: 0,
    expiresAt: new Date().toISOString().slice(0, 10),
    maxUses: 1,
  }
}

function createBlogPost(): BlogPost {
  return {
    id: crypto.randomUUID(),
    title: 'Novo post',
    excerpt: '',
    content: '',
    image: '',
    mediaType: 'image',
    media: [],
    published: false,
    createdAt: new Date().toISOString(),
    source: 'manual',
  }
}

function createPostMedia(url = '', mediaType: BlogMedia['mediaType'] = 'image'): BlogMedia {
  return {
    id: crypto.randomUUID(),
    url,
    mediaType,
    alt: '',
  }
}

const assistantApiPresets: Array<{
  label: string
  description: string
  config: AssistantApiConfig
}> = [
  {
    label: 'OpenAI',
    description: 'Responses API',
    config: {
      provider: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/responses',
      model: 'gpt-4o',
      mode: 'responses',
    },
  },
  {
    label: 'Gemini',
    description: 'Google AI Studio',
    config: {
      provider: 'Gemini',
      endpoint:
        'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
      model: 'gemini-2.5-flash',
      mode: 'gemini',
    },
  },
]

export function AdminPage() {
  const { user } = useAuth()
  const {
    products,
    subscriptionPlans,
    customerSubscriptions,
    coupons,
    orders,
    wholesalePreorders,
    blogPosts,
    notifications,
    settings,
    persistenceStatus,
    lastPersistedAt,
    persistenceMessage,
    saveStoreNow,
    setProducts,
    setSubscriptionPlans,
    setCustomerSubscriptions,
    setCoupons,
    setOrders,
    setWholesalePreorders,
    setBlogPosts,
    setNotifications,
    setSettings,
  } = useStore()
  const [mediaError, setMediaError] = useState('')
  const [mercadoPagoTokenDraft, setMercadoPagoTokenDraft] = useState('')
  const [assistantApiKeyDraft, setAssistantApiKeyDraft] = useState('')
  const [instagramTokenDraft, setInstagramTokenDraft] = useState('')
  const [savingSecretKey, setSavingSecretKey] = useState('')
  const [secretFeedbackKey, setSecretFeedbackKey] = useState('')
  const [secretMessage, setSecretMessage] = useState('')
  const [secretError, setSecretError] = useState('')
  const [importingInstagram, setImportingInstagram] = useState(false)
  const [instagramImportMessage, setInstagramImportMessage] = useState('')
  const [instagramImportError, setInstagramImportError] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [registeredCustomers, setRegisteredCustomers] = useState(() => readStoredCustomers())
  const [activeAdminPage, setActiveAdminPage] = useState('admin-overview')
  const adminPageFrameRef = useRef<HTMLDivElement | null>(null)
  const adminPageScrollPositions = useRef<Record<string, number>>({})

  const monthSales = orders
    .filter((order) => order.status !== 'cancelado')
    .reduce((total, order) => total + order.total, 0)
  const activeOrders = useMemo(() => orders.filter(isOrderVisibleInAdmin), [orders])
  const activeSubscriptions = customerSubscriptions.filter(
    (subscription) => subscription.status !== 'cancelada',
  )
  const managedSubscriptions = activeSubscriptions
  const activeWholesalePreorders = wholesalePreorders
    .filter(isWholesaleQueueActive)
    .sort((a, b) => a.queueNumber - b.queueNumber)
  const productByName = useMemo(() => {
    return new Map(products.map((product) => [product.name, product]))
  }, [products])
  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase()

    if (!query) {
      return registeredCustomers
    }

    return registeredCustomers.filter((customer) => {
      const content = [
        customer.name,
        customer.email,
        customer.phone,
        customer.cep,
        customer.street,
        customer.neighborhood,
        customer.city,
        customer.state,
        customer.accountType,
      ]
        .join(' ')
        .toLowerCase()

      return content.includes(query)
    })
  }, [customerSearch, registeredCustomers])

  useEffect(() => {
    function syncCustomers() {
      setRegisteredCustomers(readStoredCustomers())
      void readSyncedCustomers().then(setRegisteredCustomers)
    }

    syncCustomers()
    window.addEventListener('storage', syncCustomers)
    window.addEventListener('focus', syncCustomers)

    return () => {
      window.removeEventListener('storage', syncCustomers)
      window.removeEventListener('focus', syncCustomers)
    }
  }, [])

  useEffect(() => {
    loadBlogPostsFromDb().then((dbPosts) => {
      if (!dbPosts || dbPosts.length === 0) return
      setBlogPosts(dbPosts)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const frame = adminPageFrameRef.current

    if (!frame) {
      return
    }

    window.requestAnimationFrame(() => {
      frame.scrollTo({
        top: adminPageScrollPositions.current[activeAdminPage] ?? 0,
        left: 0,
      })
    })
  }, [activeAdminPage])

  function selectAdminPage(pageId: string) {
    const frame = adminPageFrameRef.current

    if (frame) {
      adminPageScrollPositions.current[activeAdminPage] = frame.scrollTop
    }

    setActiveAdminPage(pageId)
  }

  function updateProduct(id: string, patch: Partial<Product>) {
    setProducts(
      products.map((product) =>
        product.id === id ? { ...product, ...patch } : product,
      ),
    )
  }

  function deleteProduct(id: string) {
    setProducts(products.filter((product) => product.id !== id))
  }

  function updateOrder(id: string, patch: Partial<Order>) {
    const currentOrder = orders.find((order) => order.id === id)
    const statusChanged =
      patch.status && currentOrder && patch.status !== currentOrder.status
    const now = new Date().toISOString()

    setOrders(
      orders.map((order) => {
        if (order.id !== id) {
          return order
        }

        const { status, ...rest } = patch
        const statusOrder = status ? withOrderStatus(order, status, now) : order
        return { ...statusOrder, ...rest, updatedAt: now }
      }),
    )

    if (statusChanged && currentOrder) {
      setNotifications([
        {
          id: crypto.randomUUID(),
          audience: 'customer',
          title: 'Pedido atualizado',
          message: `${currentOrder.id} agora está como ${statusLabels[patch.status!]}.`,
          createdAt: now,
          read: false,
          link: '/conta',
        },
        ...notifications,
      ])
    }
  }

  function updateCoupon(code: string, patch: Partial<Coupon>) {
    setCoupons(
      coupons.map((coupon) =>
        coupon.code === code ? { ...coupon, ...patch } : coupon,
      ),
    )
  }

  function updatePlan(id: string, patch: Partial<SubscriptionPlan>) {
    setSubscriptionPlans(
      subscriptionPlans.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)),
    )
  }

  function updateCustomerSubscription(id: string, patch: Partial<CustomerSubscription>) {
    setCustomerSubscriptions(
      customerSubscriptions.map((subscription) =>
        subscription.id === id
          ? {
              ...subscription,
              ...patch,
              lastUpdatedAt: new Date().toISOString(),
            }
          : subscription,
      ),
    )
  }

  function updateWholesalePreorder(id: string, patch: Partial<WholesalePreorder>) {
    const currentPreorder = wholesalePreorders.find((preorder) => preorder.id === id)
    const statusChanged =
      patch.status && currentPreorder && patch.status !== currentPreorder.status
    const now = new Date().toISOString()

    setWholesalePreorders(
      wholesalePreorders.map((preorder) =>
        preorder.id === id ? { ...preorder, ...patch, updatedAt: now } : preorder,
      ),
    )

    if (statusChanged && currentPreorder) {
      setNotifications([
        {
          id: crypto.randomUUID(),
          audience: 'customer',
          title: 'Encomenda atacado atualizada',
          message: `${formatWholesaleQueueNumber(
            currentPreorder.queueNumber,
          )} está como ${wholesaleQueueStatusLabels[patch.status!]}.`,
          createdAt: now,
          read: false,
          link: '/conta',
        },
        ...notifications,
      ])
    }
  }

  function deleteWholesalePreorder(id: string) {
    setWholesalePreorders(wholesalePreorders.filter((preorder) => preorder.id !== id))
  }

  function updatePost(id: string, patch: Partial<BlogPost>) {
    const currentPost = blogPosts.find((post) => post.id === id)
    const media = patch.media ?? currentPost?.media
    const cover = media?.find((item) => item.url)
    const normalizedPatch = cover
      ? {
          ...patch,
          image: patch.image ?? cover.url,
          mediaType: patch.mediaType ?? cover.mediaType,
        }
      : patch

    const updated = blogPosts.map((post) =>
      post.id === id ? { ...post, ...normalizedPatch } : post,
    )

    setBlogPosts(updated)

    const saved = updated.find((p) => p.id === id)
    if (saved) {
      void saveBlogPostToDb(saved)
    }

    if (patch.published && currentPost && !currentPost.published) {
      setNotifications([
        {
          id: crypto.randomUUID(),
          audience: 'customer',
          title: 'Novo post no Blog Josaninha',
          message: currentPost.title,
          createdAt: new Date().toISOString(),
          read: false,
          link: '/blog-josaninha',
        },
        ...notifications,
      ])
    }
  }

  function deletePost(id: string) {
    setBlogPosts(blogPosts.filter((post) => post.id !== id))
    void deleteBlogPostFromDb(id)
  }

  function updatePostMedia(postId: string, mediaId: string, patch: Partial<BlogMedia>) {
    const post = blogPosts.find((item) => item.id === postId)

    if (!post) {
      return
    }

    const media = (post.media ?? []).map((item) =>
      item.id === mediaId ? { ...item, ...patch } : item,
    )

    updatePost(postId, { media })
  }

  function addPostMedia(postId: string) {
    const post = blogPosts.find((item) => item.id === postId)

    if (!post) {
      return
    }

    updatePost(postId, { media: [...(post.media ?? []), createPostMedia()] })
  }

  function deletePostMedia(postId: string, mediaId: string) {
    const post = blogPosts.find((item) => item.id === postId)

    if (!post) {
      return
    }

    const media = (post.media ?? []).filter((item) => item.id !== mediaId)
    updatePost(postId, {
      media,
      image: media[0]?.url || '',
      mediaType: media[0]?.mediaType || 'image',
    })
  }

  function updatePaymentGateway(patch: Partial<PaymentGatewayConfig>) {
    setSettings((current) => ({
      ...current,
      paymentGateway: {
        ...current.paymentGateway,
        ...patch,
      },
    }))
  }

  function updateAssistantApi(patch: Partial<AssistantApiConfig>) {
    setSettings((current) => ({
      ...current,
      assistantApi: {
        ...current.assistantApi,
        ...patch,
      },
    }))
  }

  async function handleProductUpload(id: string, file?: File) {
    if (!file) {
      return
    }

    try {
      setMediaError('')
      const media = await readMediaFile(file)
      updateProduct(id, { image: media.url, mediaType: media.mediaType })
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Upload não concluído.')
    }
  }

  async function handlePostUpload(id: string, files?: File[]) {
    if (!files?.length) {
      return
    }

    try {
      setMediaError('')
      const currentPost = blogPosts.find((post) => post.id === id)
      const uploadedMedia = await Promise.all(files.map((file) => readMediaFile(file)))
      const media = [
        ...(currentPost?.media ?? []),
        ...uploadedMedia.map((item) => createPostMedia(item.url, item.mediaType)),
      ]
      updatePost(id, {
        image: media[0]?.url || '',
        mediaType: media[0]?.mediaType || 'image',
        media,
      })
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Upload não concluído.')
    }
  }

  async function importInstagramPosts() {
    if (!user?.adminToken) {
      setInstagramImportError('Sessão administrativa expirada. Entre novamente.')
      setInstagramImportMessage('')
      return
    }

    setImportingInstagram(true)
    setInstagramImportError('')
    setInstagramImportMessage('')

    try {
      const response = await fetch('/api/instagram-import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: settings.instagramUserId,
          limit: 15,
        }),
      })
      const data = (await response.json()) as {
        posts?: BlogPost[]
        error?: string
        code?: string
      }

      if (!response.ok || !data.posts) {
        throw new Error(
          data.error ||
            (data.code === 'missing_instagram_access_token'
              ? 'Configure o token Instagram na Vercel antes de importar.'
              : 'Não foi possível importar o Instagram.'),
        )
      }

      const importedKeys = new Set(
        blogPosts.map((post) => post.sourceId || post.sourceUrl || post.id),
      )
      const newPosts = data.posts.filter(
        (post) => !importedKeys.has(post.sourceId || post.sourceUrl || post.id),
      )

      const allPosts = [...newPosts, ...blogPosts]
      setBlogPosts(allPosts)
      for (const post of newPosts) {
        void saveBlogPostToDb(post)
      }
      setInstagramImportMessage(
        newPosts.length
          ? `${newPosts.length} post(s) importado(s) do Instagram.`
          : 'Os últimos posts do Instagram já estavam no blog.',
      )
    } catch (error) {
      setInstagramImportError(
        error instanceof Error ? error.message : 'Não foi possível importar o Instagram.',
      )
    } finally {
      setImportingInstagram(false)
    }
  }

  async function saveAdminSecretEntries(
    entries: { key: string; value: string; label: string }[],
    savingKey: string,
    successLabel: string,
  ) {
    if (!user?.adminToken) {
      setSecretError('Sessão administrativa expirada. Entre novamente.')
      setSecretMessage('')
      return
    }

    const cleanEntries = entries.map((entry) => ({
      ...entry,
      value: entry.value.trim(),
    }))
    const emptyEntry = cleanEntries.find((entry) => !entry.value)

    if (emptyEntry) {
      setSecretError(`Informe ${emptyEntry.label}.`)
      setSecretMessage('')
      return
    }

    setSavingSecretKey(savingKey)
    setSecretFeedbackKey(savingKey)
    setSecretError('')
    setSecretMessage('')

    try {
      const response = await fetch('/api/admin-secret', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entries: cleanEntries.map(({ key, value }) => ({ key, value })),
        }),
      })
      const data = (await response.json()) as {
        error?: string
        label?: string
        labels?: string[]
        redeploy?: 'triggered' | 'failed' | 'not_configured'
      }

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível salvar na Vercel.')
      }

      if (cleanEntries.some((entry) => entry.key === 'MERCADO_PAGO_ACCESS_TOKEN')) {
        setMercadoPagoTokenDraft('')
      }

      if (
        cleanEntries.some(
          (entry) => entry.key === 'AI_API_KEY' || entry.key === 'OPENAI_API_KEY',
        )
      ) {
        setAssistantApiKeyDraft('')
      }

      if (cleanEntries.some((entry) => entry.key === 'INSTAGRAM_ACCESS_TOKEN')) {
        setInstagramTokenDraft('')
      }

      setSecretMessage(
        `${data.label || data.labels?.join(', ') || successLabel} salvo na Vercel.${
          data.redeploy === 'triggered'
            ? ' Deploy automático iniciado.'
            : ' A próxima publicação usará o novo valor.'
        }`,
      )
    } catch (error) {
      setSecretError(
        error instanceof Error ? error.message : 'Não foi possível salvar na Vercel.',
      )
    } finally {
      setSavingSecretKey('')
    }
  }

  async function saveAdminSecret(key: string, value: string, label: string) {
    await saveAdminSecretEntries([{ key, value, label }], key, label)
  }

  async function saveAssistantApiConfig() {
    const entries = [
      {
        key: 'AI_PROVIDER_NAME',
        value: settings.assistantApi.provider,
        label: 'nome do provedor',
      },
      {
        key: 'AI_API_ENDPOINT',
        value: settings.assistantApi.endpoint,
        label: 'endpoint da API',
      },
      {
        key: 'AI_MODEL',
        value: settings.assistantApi.model,
        label: 'modelo da IA',
      },
      {
        key: 'AI_API_MODE',
        value: settings.assistantApi.mode,
        label: 'modo da API',
      },
      ...(assistantApiKeyDraft.trim()
        ? [
            {
              key: 'AI_API_KEY',
              value: assistantApiKeyDraft,
              label: 'chave da API da IA',
            },
          ]
        : []),
    ]

    await saveAdminSecretEntries(entries, 'AI_ASSISTANT_CONFIG', 'Configuração da API')
  }

  const mercadoPagoReady =
    settings.paymentGateway.enabled &&
    settings.paymentGateway.provider.toLowerCase().includes('mercado')
  const isStoreSaving = persistenceStatus === 'saving'
  const saveStatusLabel =
    persistenceStatus === 'saved'
      ? 'Salvo'
      : persistenceStatus === 'local_only'
        ? 'Salvo localmente'
        : persistenceStatus === 'error'
          ? 'Erro ao salvar'
          : persistenceStatus === 'saving'
            ? 'Salvando'
            : 'Aguardando'
  const lastSavedLabel = lastPersistedAt
    ? new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(lastPersistedAt))
    : ''
  const adminNavItems = [
    {
      id: 'admin-overview',
      label: 'Visão geral',
      icon: ShoppingCart,
    },
    {
      id: 'admin-customers',
      label: 'Clientes',
      count: registeredCustomers.length,
      icon: UsersRound,
    },
    {
      id: 'admin-wholesale',
      label: 'Fila atacado',
      count: activeWholesalePreorders.length,
      icon: Hash,
    },
    {
      id: 'admin-products',
      label: 'Produtos',
      count: products.length,
      icon: Boxes,
    },
    {
      id: 'admin-plans',
      label: 'Planos',
      count: subscriptionPlans.length,
      icon: Percent,
    },
    {
      id: 'admin-subscriptions',
      label: 'Assinaturas',
      count: managedSubscriptions.length,
      icon: BadgeCheck,
    },
    {
      id: 'admin-blog',
      label: 'Blog',
      count: blogPosts.length,
      icon: FilePlus2,
    },
    {
      id: 'admin-orders',
      label: 'Pedidos',
      count: activeOrders.length,
      icon: ShoppingCart,
    },
    {
      id: 'admin-settings',
      label: 'Configurações',
      icon: Settings,
    },
    {
      id: 'admin-coupons',
      label: 'Cupons',
      count: coupons.length,
      icon: Percent,
    },
  ]

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Painel administrativo editável</h1>
        <p>
          Área protegida para editar produtos, fotos, valores, planos,
          configurações e publicações.
        </p>
      </div>

      <div className={`admin-save-bar ${persistenceStatus}`}>
        <div>
          <strong>{saveStatusLabel}</strong>
          <span>
            {persistenceMessage}
            {lastSavedLabel ? ` Último salvamento: ${lastSavedLabel}.` : ''}
          </span>
        </div>
        <button
          className="primary-button admin-save-button"
          type="button"
          disabled={isStoreSaving}
          onClick={() => void saveStoreNow()}
        >
          <Save size={17} />
          {isStoreSaving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      <nav className="admin-page-nav" aria-label="Navegação do painel administrativo">
        {adminNavItems.map((item) => {
          const Icon = item.icon

          return (
            <button
              className={activeAdminPage === item.id ? 'active' : ''}
              type="button"
              key={item.id}
              onClick={() => selectAdminPage(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <small>{item.count}</small>
              )}
            </button>
          )
        })}
      </nav>

      <div className="admin-page-frame" ref={adminPageFrameRef}>
      <div
        className="dashboard-cards admin-page-panel"
        id="admin-overview"
        hidden={activeAdminPage !== 'admin-overview'}
      >
        <article className="metric-card warm">
          <ShoppingCart size={24} />
          <span>Vendas do mês</span>
          <strong>{formatCurrency(monthSales)}</strong>
          <p>Sem pedidos cadastrados até a primeira venda real.</p>
        </article>
        <article className="metric-card">
          <Boxes size={24} />
          <span>Produtos</span>
          <strong>{products.length}</strong>
          <p>Fotos, preços e estoque editáveis.</p>
        </article>
        <article className="metric-card">
          <UsersRound size={24} />
          <span>Clientes</span>
          <strong>{registeredCustomers.length}</strong>
          <p>Cadastro, contato e endereço por CEP.</p>
        </article>
        <article className="metric-card green">
          <FilePlus2 size={24} />
          <span>Blog</span>
          <strong>{blogPosts.filter((post) => post.published).length}</strong>
          <p>Posts publicados no Blog Josaninha.</p>
        </article>
        <article className="metric-card">
          <Percent size={24} />
          <span>Planos</span>
          <strong>{activeSubscriptions.length}</strong>
          <p>Assinaturas ativas ou pausadas.</p>
        </article>
        <article className="metric-card green">
          <Hash size={24} />
          <span>Fila atacado</span>
          <strong>{activeWholesalePreorders.length}</strong>
          <p>Encomendas aguardando produção ou separação.</p>
        </article>
      </div>

      <section
        className="table-panel admin-edit-section admin-page-panel"
        id="admin-customers"
        hidden={activeAdminPage !== 'admin-customers'}
      >
        <div className="admin-section-title">
          <UsersRound size={22} />
          <div>
            <h2>Clientes cadastrados</h2>
            <p>Busque por nome e visualize telefone, e-mail, CEP e endereço.</p>
          </div>
          <span className="admin-count-pill">{registeredCustomers.length}</span>
        </div>
        <label className="search-field admin-customer-search">
          <Search size={17} />
          <input
            placeholder="Buscar cliente por nome, e-mail, telefone ou CEP"
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
          />
        </label>
        {registeredCustomers.length === 0 ? (
          <div className="empty-state compact">
            <h2>Nenhum cliente cadastrado ainda.</h2>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state compact">
            <h2>Nenhum cliente encontrado.</h2>
          </div>
        ) : (
          <div className="admin-customer-grid">
            {filteredCustomers.map((customer) => (
              <article className="admin-customer-card" key={customer.id}>
                <div className="admin-customer-topline">
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{normalizeAccountType(customer.accountType)}</span>
                  </div>
                  {customer.cep && <small>{formatCep(customer.cep)}</small>}
                </div>
                <div className="admin-customer-lines">
                  <span>
                    <Mail size={15} />
                    {customer.email || 'E-mail não cadastrado'}
                  </span>
                  <span>
                    <Phone size={15} />
                    {customer.phone || 'Telefone não cadastrado'}
                  </span>
                  <span>
                    <MapPin size={15} />
                    {formatCustomerAddress(customer)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        className="table-panel admin-edit-section admin-page-panel"
        id="admin-wholesale"
        hidden={activeAdminPage !== 'admin-wholesale'}
      >
        <div className="admin-section-title">
          <Hash size={22} />
          <div>
            <h2>Fila de encomendas atacado</h2>
            <p>Controle a posição, status, quantidade e observação de cada encomenda.</p>
          </div>
          <span className="admin-count-pill">{activeWholesalePreorders.length}</span>
        </div>
        {activeWholesalePreorders.length === 0 ? (
          <div className="empty-state compact">
            <h2>Nenhuma encomenda atacado em fila.</h2>
          </div>
        ) : (
          <div className="admin-subscription-grid wholesale-admin-grid">
            {activeWholesalePreorders.map((preorder) => {
              const position = getWholesaleQueuePosition(preorder, wholesalePreorders)

              return (
                <article className="admin-subscription-card wholesale-admin-card" key={preorder.id}>
                  <button
                    className="icon-small admin-delete-button"
                    type="button"
                    onClick={() => deleteWholesalePreorder(preorder.id)}
                    aria-label="Excluir encomenda"
                    title="Excluir encomenda"
                  >
                    <Trash2 size={15} />
                  </button>
                  <div className="admin-customer-topline">
                    <div>
                      <strong>
                        {formatWholesaleQueueNumber(preorder.queueNumber)} ·{' '}
                        {preorder.productName}
                      </strong>
                      <span>
                        Posição {position} · {preorder.customerName}
                      </span>
                    </div>
                    <small>{wholesaleQueueStatusLabels[preorder.status]}</small>
                  </div>
                  <div className="admin-order-products">
                    <span className="order-product-chip">
                      {preorder.productImage && (
                        <MediaPreview src={preorder.productImage} alt={preorder.productName} />
                      )}
                      {preorder.requestedQuantity} un. · {preorder.productWeight}
                    </span>
                  </div>
                  <div className="admin-customer-lines">
                    <span>
                      <Mail size={15} />
                      {preorder.customerEmail || 'E-mail não informado'}
                    </span>
                    <span>
                      <Phone size={15} />
                      {preorder.customerPhone || 'Telefone não cadastrado'}
                    </span>
                    <span>
                      <MapPin size={15} />
                      {preorder.deliveryAddress}
                    </span>
                  </div>
                  <div className="admin-field-row compact">
                    <label className="field-label">
                      Status
                      <select
                        value={preorder.status}
                        onChange={(event) =>
                          updateWholesalePreorder(preorder.id, {
                            status: event.target.value as WholesaleQueueStatus,
                          })
                        }
                      >
                        {wholesaleQueueStatuses.map((status) => (
                          <option key={status} value={status}>
                            {wholesaleQueueStatusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-label">
                      Quantidade
                      <input
                        min={1}
                        type="number"
                        value={preorder.requestedQuantity}
                        onChange={(event) =>
                          updateWholesalePreorder(preorder.id, {
                            requestedQuantity: Math.max(
                              1,
                              Number(event.target.value) || 1,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="field-label">
                      Valor atacado
                      <input
                        min={0}
                        type="number"
                        value={preorder.unitPrice}
                        onChange={(event) =>
                          updateWholesalePreorder(preorder.id, {
                            unitPrice: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="field-label">
                    Observação interna
                    <textarea
                      value={preorder.note}
                      onChange={(event) =>
                        updateWholesalePreorder(preorder.id, { note: event.target.value })
                      }
                    />
                  </label>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section
        className="table-panel admin-edit-section admin-page-panel"
        id="admin-products"
        hidden={activeAdminPage !== 'admin-products'}
      >
        <div className="admin-section-title">
          <Boxes size={22} />
          <div>
            <h2>Gestão de produtos</h2>
            <p>Edite foto, valor, categoria, descrição e estoque.</p>
          </div>
          <button
            className="icon-small ml-auto"
            type="button"
            onClick={() => setProducts([...products, createProduct()])}
            aria-label="Adicionar produto"
            title="Adicionar produto"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="admin-product-grid">
          {mediaError && <p className="form-error">{mediaError}</p>}
          {products.map((product) => (
            <article className="admin-product-card" key={product.id}>
              <button
                className="icon-small admin-delete-button"
                type="button"
                onClick={() => deleteProduct(product.id)}
                aria-label={`Excluir ${product.name}`}
                title="Excluir produto"
              >
                <Trash2 size={17} />
              </button>
              <div className="admin-product-photo">
                {product.image ? (
                  <MediaPreview
                    src={product.image}
                    alt={product.name}
                    mediaType={product.mediaType}
                    controls={product.mediaType === 'video'}
                  />
                ) : (
                  <ImageIcon size={28} />
                )}
              </div>
              <div className="admin-product-fields">
                <label className="field-label">
                  Upload de foto ou vídeo
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(event) => {
                      handleProductUpload(product.id, event.currentTarget.files?.[0])
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
                <div className="admin-field-row compact">
                  <label className="field-label">
                    URL da mídia
                    <input
                      value={product.image}
                      onChange={(event) =>
                        updateProduct(product.id, {
                          image: event.target.value,
                          mediaType: inferMediaType(
                            event.target.value,
                            product.mediaType ?? 'image',
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Tipo
                    <select
                      value={product.mediaType ?? 'image'}
                      onChange={(event) =>
                        updateProduct(product.id, {
                          mediaType: event.target.value as Product['mediaType'],
                        })
                      }
                    >
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo</option>
                    </select>
                  </label>
                </div>
                <label className="field-label">
                  Nome
                  <input
                    value={product.name}
                    onChange={(event) =>
                      updateProduct(product.id, { name: event.target.value })
                    }
                  />
                </label>
                <label className="field-label">
                  Categoria
                  <select
                    value={product.category}
                    onChange={(event) =>
                      updateProduct(product.id, {
                        category: event.target.value as ProductCategory,
                      })
                    }
                  >
                    {productCategories.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabels[category]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-field-row">
                  <label className="field-label">
                    Preço varejo
                    <input
                      type="number"
                      value={product.price}
                      onChange={(event) =>
                        updateProduct(product.id, { price: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Preço atacado
                    <input
                      type="number"
                      value={product.wholesalePrice ?? 0}
                      onChange={(event) =>
                        updateProduct(product.id, {
                          wholesalePrice: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Estoque
                    <input
                      type="number"
                      value={product.stock}
                      onChange={(event) =>
                        updateProduct(product.id, { stock: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
                <label className="field-label">
                  Descrição
                  <textarea
                    value={product.description}
                    onChange={(event) =>
                      updateProduct(product.id, { description: event.target.value })
                    }
                  />
                </label>
                <label className="field-label">
                  Peso
                  <input
                    value={product.weight}
                    onChange={(event) =>
                      updateProduct(product.id, { weight: event.target.value })
                    }
                  />
                </label>
                <label className="field-label">
                  Benefícios
                  <input
                    value={product.benefits.join(', ')}
                    onChange={(event) =>
                      updateProduct(product.id, {
                        benefits: event.target.value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="field-label">
                  Nutrição
                  <textarea
                    value={product.nutrition}
                    onChange={(event) =>
                      updateProduct(product.id, { nutrition: event.target.value })
                    }
                  />
                </label>
                <div className="admin-field-row compact">
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={Boolean(product.bestSeller)}
                      onChange={(event) =>
                        updateProduct(product.id, { bestSeller: event.target.checked })
                      }
                    />
                    Mais vendido
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={Boolean(product.isNew)}
                      onChange={(event) =>
                        updateProduct(product.id, { isNew: event.target.checked })
                      }
                    />
                    Lançamento
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="table-panel admin-edit-section admin-page-panel"
        id="admin-plans"
        hidden={activeAdminPage !== 'admin-plans'}
      >
        <div className="admin-section-title">
          <Percent size={22} />
          <div>
            <h2>Planos de assinatura</h2>
            <p>Nome, cadência, valor e descrição dos planos.</p>
          </div>
          <button
            className="icon-small ml-auto"
            type="button"
            onClick={() => setSubscriptionPlans([...subscriptionPlans, createPlan()])}
            aria-label="Adicionar plano"
            title="Adicionar plano"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="plan-edit-grid">
          {subscriptionPlans.map((plan) => (
            <article className="mini-plan" key={plan.id}>
              <label className="field-label">
                Plano
                <input
                  value={plan.name}
                  onChange={(event) => updatePlan(plan.id, { name: event.target.value })}
                />
              </label>
              <label className="field-label">
                Cadência
                <select
                  value={plan.cadence}
                  onChange={(event) =>
                    updatePlan(plan.id, {
                      cadence: event.target.value as SubscriptionPlan['cadence'],
                    })
                  }
                >
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="mensal">Mensal</option>
                </select>
              </label>
              <label className="field-label">
                Preço
                <input
                  type="number"
                  value={plan.price}
                  onChange={(event) => updatePlan(plan.id, { price: Number(event.target.value) })}
                />
              </label>
              <label className="field-label">
                Descrição
                <textarea
                  value={plan.description}
                  onChange={(event) =>
                    updatePlan(plan.id, { description: event.target.value })
                  }
                />
              </label>
            </article>
          ))}
        </div>
      </section>

      <section
        className="table-panel admin-edit-section admin-page-panel"
        id="admin-subscriptions"
        hidden={activeAdminPage !== 'admin-subscriptions'}
      >
        <div className="admin-section-title">
          <BadgeCheck size={22} />
          <div>
            <h2>Gestão de assinaturas</h2>
            <p>Status, entrega, valor e dados do cliente assinante.</p>
          </div>
          <span className="admin-count-pill">{managedSubscriptions.length}</span>
        </div>
        {managedSubscriptions.length === 0 ? (
          <div className="empty-state compact">
            <h2>Nenhuma assinatura ativa ou pendente para gerenciar.</h2>
          </div>
        ) : (
          <div className="admin-subscription-grid">
            {managedSubscriptions.map((subscription) => (
              <article className="admin-subscription-card" key={subscription.id}>
                <div className="admin-customer-topline">
                  <div>
                    <strong>{subscription.customerName}</strong>
                    <span>{subscription.customerEmail || 'E-mail não informado'}</span>
                  </div>
                  <small>{subscriptionStatusLabels[subscription.status]}</small>
                </div>
                <div className="admin-customer-lines">
                  <span>
                    <Phone size={15} />
                    {subscription.customerPhone || 'Telefone não cadastrado'}
                  </span>
                  <span>
                    <MapPin size={15} />
                    {subscription.deliveryAddress}
                  </span>
                  <span>
                    <CalendarClock size={15} />
                    Próxima entrega: {subscription.nextDeliveryAt.slice(0, 10)}
                  </span>
                  <span>
                    <CalendarClock size={15} />
                    Validade:{' '}
                    {subscription.expiresAt
                      ? formatDate(subscription.expiresAt)
                      : 'Aguardando pagamento'}
                  </span>
                </div>
                <div className="admin-field-row compact">
                  <label className="field-label">
                    Plano
                    <input
                      value={subscription.planName}
                      onChange={(event) =>
                        updateCustomerSubscription(subscription.id, {
                          planName: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Status
                    <select
                      value={subscription.status}
                      onChange={(event) =>
                        updateCustomerSubscription(subscription.id, {
                          status: event.target.value as SubscriptionStatus,
                        })
                      }
                    >
                      {subscriptionStatuses.map((status) => (
                        <option key={status} value={status}>
                          {subscriptionStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="admin-field-row compact">
                  <label className="field-label">
                    Cadência
                    <select
                      value={subscription.cadence}
                      onChange={(event) =>
                        updateCustomerSubscription(subscription.id, {
                          cadence: event.target.value as SubscriptionPlan['cadence'],
                        })
                      }
                    >
                      <option value="semanal">Semanal</option>
                      <option value="quinzenal">Quinzenal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </label>
                  <label className="field-label">
                    Próxima entrega
                    <input
                      type="date"
                      value={subscription.nextDeliveryAt.slice(0, 10)}
                      onChange={(event) =>
                        updateCustomerSubscription(subscription.id, {
                          nextDeliveryAt: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Validade
                    <input
                      type="date"
                      value={subscription.expiresAt.slice(0, 10)}
                      onChange={(event) =>
                        updateCustomerSubscription(subscription.id, {
                          expiresAt: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Valor
                    <input
                      type="number"
                      value={subscription.price}
                      onChange={(event) =>
                        updateCustomerSubscription(subscription.id, {
                          price: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="subscription-actions compact">
                  {subscription.status === 'ativa' && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        updateCustomerSubscription(subscription.id, { status: 'pausada' })
                      }
                    >
                      <PauseCircle size={15} />
                      Pausar
                    </button>
                  )}
                  {subscription.status === 'pausada' && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        updateCustomerSubscription(subscription.id, { status: 'ativa' })
                      }
                    >
                      <PlayCircle size={15} />
                      Reativar
                    </button>
                  )}
                  {subscription.status !== 'cancelada' && (
                    <button
                      className="secondary-button danger"
                      type="button"
                      onClick={() =>
                        updateCustomerSubscription(subscription.id, {
                          status: 'cancelada',
                        })
                      }
                    >
                      <XCircle size={15} />
                      Cancelar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        className="table-panel admin-edit-section admin-page-panel"
        id="admin-blog"
        hidden={activeAdminPage !== 'admin-blog'}
      >
        <div className="admin-section-title">
          <FilePlus2 size={22} />
          <div>
            <h2>Blog Josaninha</h2>
            <p>Crie posts, use carrossel de mídias ou importe o Instagram.</p>
          </div>
          <button
            className="secondary-button admin-inline-action"
            type="button"
            onClick={importInstagramPosts}
            disabled={importingInstagram}
          >
            <DownloadCloud size={16} />
            {importingInstagram ? 'Importando...' : 'Importar 15 do Instagram'}
          </button>
          <button
            className="icon-small ml-auto"
            type="button"
            onClick={() => setBlogPosts([createBlogPost(), ...blogPosts])}
            aria-label="Adicionar post"
            title="Adicionar post"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="instagram-import-panel">
          <label className="field-label">
            ID da conta Instagram
            <input
              value={settings.instagramUserId}
              placeholder="Opcional: ID da conta profissional no Meta"
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  instagramUserId: event.target.value,
                }))
              }
            />
          </label>
          <label className="field-label">
            Token Instagram
            <input
              type="password"
              value={instagramTokenDraft}
              placeholder="Cole o token do Instagram Graph API"
              onChange={(event) => setInstagramTokenDraft(event.target.value)}
            />
            <span className="field-hint">
              Ao salvar, o token vai para INSTAGRAM_ACCESS_TOKEN na Vercel.
            </span>
          </label>
          <div className="secret-action-row">
            <button
              className="secondary-button"
              type="button"
              disabled={savingSecretKey === 'INSTAGRAM_ACCESS_TOKEN'}
              onClick={() =>
                saveAdminSecret(
                  'INSTAGRAM_ACCESS_TOKEN',
                  instagramTokenDraft,
                  'Token Instagram',
                )
              }
            >
              <Save size={16} />
              {savingSecretKey === 'INSTAGRAM_ACCESS_TOKEN'
                ? 'Salvando...'
                : 'Salvar token Instagram'}
            </button>
          </div>
          {secretFeedbackKey === 'INSTAGRAM_ACCESS_TOKEN' && secretMessage && (
            <p className="form-success">{secretMessage}</p>
          )}
          {secretFeedbackKey === 'INSTAGRAM_ACCESS_TOKEN' && secretError && (
            <p className="form-error">{secretError}</p>
          )}
          {instagramImportMessage && <p className="form-success">{instagramImportMessage}</p>}
          {instagramImportError && <p className="form-error">{instagramImportError}</p>}
        </div>
        {blogPosts.length === 0 ? (
          <div className="empty-state compact">
            <h2>Nenhum post criado ainda.</h2>
          </div>
        ) : (
          <div className="blog-admin-grid">
            {mediaError && <p className="form-error">{mediaError}</p>}
            {blogPosts.map((post) => (
              <article className="blog-admin-card" key={post.id}>
                <button
                  className="icon-small admin-delete-button"
                  type="button"
                  onClick={() => deletePost(post.id)}
                  aria-label={`Excluir ${post.title}`}
                  title="Excluir post"
                >
                  <Trash2 size={17} />
                </button>
                <div className="admin-blog-media-list">
                  {(post.media && post.media.length > 0
                    ? post.media
                    : post.image
                      ? [createPostMedia(post.image, post.mediaType ?? 'image')]
                      : []
                  ).map((media) => (
                    <div className="admin-blog-media-row" key={media.id}>
                      <div className="admin-product-photo blog-photo">
                        {media.url ? (
                          <MediaPreview
                            src={media.url}
                            alt={media.alt || post.title}
                            mediaType={media.mediaType}
                            controls={media.mediaType === 'video'}
                          />
                        ) : (
                          <ImageIcon size={28} />
                        )}
                      </div>
                      <div className="admin-blog-media-fields">
                        <label className="field-label">
                          URL da mídia
                          <input
                            value={media.url}
                            onChange={(event) =>
                              updatePostMedia(post.id, media.id, {
                                url: event.target.value,
                                mediaType: inferMediaType(
                                  event.target.value,
                                  media.mediaType,
                                ),
                              })
                            }
                          />
                        </label>
                        <div className="admin-field-row compact">
                          <label className="field-label">
                            Tipo
                            <select
                              value={media.mediaType}
                              onChange={(event) =>
                                updatePostMedia(post.id, media.id, {
                                  mediaType: event.target.value as BlogMedia['mediaType'],
                                })
                              }
                            >
                              <option value="image">Imagem</option>
                              <option value="video">Vídeo</option>
                            </select>
                          </label>
                          <button
                            className="secondary-button danger"
                            type="button"
                            onClick={() => deletePostMedia(post.id, media.id)}
                          >
                            <Trash2 size={15} />
                            Remover mídia
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!(post.media?.length || post.image) && (
                    <div className="empty-state compact">
                      <h2>Nenhuma mídia adicionada.</h2>
                    </div>
                  )}
                </div>
                <label className="field-label">
                  Upload de fotos ou vídeos
                  <input
                    multiple
                    type="file"
                    accept="image/*,video/*"
                    onChange={(event) => {
                      handlePostUpload(
                        post.id,
                        event.currentTarget.files
                          ? Array.from(event.currentTarget.files)
                          : undefined,
                      )
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => addPostMedia(post.id)}
                >
                  <Plus size={15} />
                  Adicionar mídia por URL
                </button>
                <label className="field-label">
                  Título
                  <input
                    value={post.title}
                    onChange={(event) => updatePost(post.id, { title: event.target.value })}
                  />
                </label>
                <label className="field-label">
                  Resumo
                  <textarea
                    value={post.excerpt}
                    onChange={(event) => updatePost(post.id, { excerpt: event.target.value })}
                  />
                </label>
                <label className="field-label">
                  Conteúdo
                  <textarea
                    value={post.content}
                    onChange={(event) => updatePost(post.id, { content: event.target.value })}
                  />
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={post.published}
                    onChange={(event) =>
                      updatePost(post.id, { published: event.target.checked })
                    }
                  />
                  Publicado
                </label>
              </article>
            ))}
          </div>
        )}
      </section>

      <div
        className="admin-layout admin-page-panel"
        hidden={
          activeAdminPage !== 'admin-orders' && activeAdminPage !== 'admin-settings'
        }
      >
        <section
          className="table-panel admin-edit-section"
          id="admin-orders"
          hidden={activeAdminPage !== 'admin-orders'}
        >
          <div className="admin-section-title">
            <ShoppingCart size={22} />
            <div>
              <h2>Gestão de pedidos</h2>
              <p>Somente pedidos aguardando pagamento, pagos ou em separação.</p>
            </div>
            <span className="admin-count-pill">{activeOrders.length}</span>
          </div>
          {activeOrders.length === 0 ? (
            <div className="empty-state compact">
              <h2>Nenhum pedido ativo para gerenciar.</h2>
            </div>
          ) : (
            <div className="admin-order-list">
              {activeOrders.map((order) => (
                <article className="admin-order-card" key={order.id}>
                  <div className="admin-order-heading">
                    <div>
                      <strong>{order.id}</strong>
                      <span>{order.customerEmail || 'Cliente sem e-mail'}</span>
                    </div>
                    <small>{formatCurrency(order.total)}</small>
                  </div>
                  <div className="admin-order-products">
                    {order.items.map((itemName) => {
                      const product = productByName.get(itemName)
                      return (
                        <span className="order-product-chip" key={itemName}>
                          {product && (
                            <MediaPreview
                              src={product.image}
                              alt={product.name}
                              mediaType={product.mediaType}
                            />
                          )}
                          {itemName}
                        </span>
                      )
                    })}
                  </div>
                  <div className="admin-field-row compact">
                    <label className="field-label">
                      Cliente
                      <input
                        value={order.customerName}
                        onChange={(event) =>
                          updateOrder(order.id, { customerName: event.target.value })
                        }
                      />
                    </label>
                    <label className="field-label">
                      Status
                      <select
                        value={order.status}
                        onChange={(event) =>
                          updateOrder(order.id, {
                            status: event.target.value as OrderStatus,
                          })
                        }
                      >
                        {orderStatuses.map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {order.deliveryAddress && (
                    <div className="admin-customer-lines">
                      <span>
                        <MapPin size={15} />
                        {order.deliveryAddress}
                      </span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <aside
          className="settings-panel admin-edit-section"
          id="admin-settings"
          hidden={activeAdminPage !== 'admin-settings'}
        >
          <div className="admin-section-title">
            <Settings size={22} />
            <div>
              <h2>Configurações</h2>
              <p>Loja, pagamento, WhatsApp e IA.</p>
            </div>
          </div>
          <label className="field-label">
            Nome da empresa
            <input
              value={settings.companyName}
              onChange={(event) =>
                setSettings((current) => ({ ...current, companyName: event.target.value }))
              }
            />
          </label>
          <label className="field-label">
            Instagram
            <input
              value={settings.instagram}
              onChange={(event) =>
                setSettings((current) => ({ ...current, instagram: event.target.value }))
              }
            />
          </label>
          <label className="field-label">
            Facebook
            <input
              value={settings.facebook}
              onChange={(event) =>
                setSettings((current) => ({ ...current, facebook: event.target.value }))
              }
            />
          </label>
          <label className="field-label">
            WhatsApp
            <input
              value={settings.whatsapp}
              onChange={(event) =>
                setSettings((current) => ({ ...current, whatsapp: event.target.value }))
              }
            />
          </label>
          <label className="field-label">
            E-mail
            <input
              value={settings.email}
              onChange={(event) =>
                setSettings((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label className="field-label">
            Frete base
            <input
              type="number"
              value={settings.shippingBase}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  shippingBase: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="field-label">
            Horários de atendimento
            <input
              value={settings.businessHours}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  businessHours: event.target.value,
                }))
              }
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.pixEnabled}
              onChange={(event) =>
                setSettings((current) => ({ ...current, pixEnabled: event.target.checked }))
              }
            />
            PIX ativo
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.creditEnabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  creditEnabled: event.target.checked,
                }))
              }
            />
            Cartão de crédito ativo
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.debitEnabled}
              onChange={(event) =>
                setSettings((current) => ({ ...current, debitEnabled: event.target.checked }))
              }
            />
            Cartão de débito ativo
          </label>

          <div className="payment-integration-card">
            <div className="admin-section-title compact">
              <KeyRound size={18} />
              <div>
                <h3>Mercado Pago</h3>
                <p>Pix, QR Code, status e webhook em rota segura.</p>
              </div>
            </div>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.paymentGateway.enabled}
                onChange={(event) =>
                  updatePaymentGateway({ enabled: event.target.checked })
                }
              />
              Mercado Pago ativo
            </label>
            <div className="admin-field-row compact">
              <label className="field-label">
                Provedor
                <input
                  value={settings.paymentGateway.provider}
                  onChange={(event) =>
                    updatePaymentGateway({ provider: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                Ambiente
                <select
                  value={settings.paymentGateway.environment}
                  onChange={(event) =>
                    updatePaymentGateway({
                      environment: event.target.value as PaymentGatewayConfig['environment'],
                    })
                  }
                >
                  <option value="sandbox">Teste</option>
                  <option value="production">Produção</option>
                </select>
              </label>
            </div>
            <label className="field-label">
              Endpoint da API
              <input
                placeholder="https://api.mercadopago.com/v1/payments"
                value={settings.paymentGateway.apiEndpoint}
                onChange={(event) =>
                  updatePaymentGateway({ apiEndpoint: event.target.value })
                }
              />
            </label>
            <div className="admin-field-row compact">
              <label className="field-label">
                Código público
                <input
                  placeholder="Public Key ou referência da integração"
                  value={settings.paymentGateway.apiCode}
                  onChange={(event) =>
                    updatePaymentGateway({ apiCode: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                Access Token
                <input
                  type="password"
                  value={mercadoPagoTokenDraft}
                  placeholder="Cole o access token do Mercado Pago"
                  onChange={(event) => setMercadoPagoTokenDraft(event.target.value)}
                />
                <span className="field-hint">
                  Ao salvar, o token vai para MERCADO_PAGO_ACCESS_TOKEN na Vercel.
                </span>
              </label>
            </div>
            <div className="secret-action-row">
              <button
                className="secondary-button"
                type="button"
                disabled={savingSecretKey === 'MERCADO_PAGO_ACCESS_TOKEN'}
                onClick={() =>
                  saveAdminSecret(
                    'MERCADO_PAGO_ACCESS_TOKEN',
                    mercadoPagoTokenDraft,
                    'Access Token Mercado Pago',
                  )
                }
              >
                <Save size={16} />
                {savingSecretKey === 'MERCADO_PAGO_ACCESS_TOKEN'
                  ? 'Salvando...'
                  : 'Salvar token na Vercel'}
              </button>
            </div>
            {secretFeedbackKey === 'MERCADO_PAGO_ACCESS_TOKEN' && secretMessage && (
              <p className="form-success">{secretMessage}</p>
            )}
            {secretFeedbackKey === 'MERCADO_PAGO_ACCESS_TOKEN' && secretError && (
              <p className="form-error">{secretError}</p>
            )}
            <div className="admin-field-row compact">
              <label className="field-label">
                ID da conta/aplicação
                <input
                  value={settings.paymentGateway.merchantId}
                  onChange={(event) =>
                    updatePaymentGateway({ merchantId: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                Webhook
                <input
                  value={settings.paymentGateway.webhookUrl}
                  onChange={(event) =>
                    updatePaymentGateway({ webhookUrl: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="admin-field-row compact">
              <label className="field-label">
                Chave Pix registrada
                <input
                  placeholder="Opcional: a chave principal fica na conta Mercado Pago"
                  value={settings.paymentGateway.pixKey}
                  onChange={(event) =>
                    updatePaymentGateway({ pixKey: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                Expiração PIX
                <input
                  min={1}
                  type="number"
                  value={settings.paymentGateway.pixExpirationMinutes}
                  onChange={(event) =>
                    updatePaymentGateway({
                      pixExpirationMinutes: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="admin-field-row compact">
              <label className="field-label">
                Nome no PIX
                <input
                  value={settings.paymentGateway.pixReceiverName}
                  onChange={(event) =>
                    updatePaymentGateway({ pixReceiverName: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                Cidade no PIX
                <input
                  value={settings.paymentGateway.pixReceiverCity}
                  onChange={(event) =>
                    updatePaymentGateway({ pixReceiverCity: event.target.value })
                  }
                />
              </label>
            </div>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.paymentGateway.fallbackQrEnabled}
                onChange={(event) =>
                  updatePaymentGateway({ fallbackQrEnabled: event.target.checked })
                }
              />
              QR Code local de contingência
            </label>
            <div className={`payment-preview ${mercadoPagoReady ? 'ready' : ''}`}>
              <QrCode size={18} />
              <div>
                <strong>
                  {mercadoPagoReady
                    ? 'Fluxo Mercado Pago configurado'
                    : 'Mercado Pago aguardando ativação'}
                </strong>
                <span>
                  {settings.paymentGateway.enabled
                    ? `${settings.paymentGateway.provider} · ${settings.paymentGateway.environment}`
                    : 'Integração desativada'}
                </span>
              </div>
              <code>/api/mercado-pago-pix</code>
            </div>
          </div>

          <div className="payment-integration-card ai-secret-card">
            <div className="admin-section-title compact">
              <KeyRound size={18} />
              <div>
                <h3>API da Josaninha</h3>
                <p>Use OpenAI, Gemini ou outro endpoint compatível com IA por API.</p>
              </div>
            </div>
            <div className="assistant-preset-row" aria-label="Preconfigurações de IA">
              {assistantApiPresets.map((preset) => (
                <button
                  className="secondary-button"
                  type="button"
                  key={preset.label}
                  onClick={() => updateAssistantApi(preset.config)}
                >
                  <KeyRound size={15} />
                  {preset.label}
                  <small>{preset.description}</small>
                </button>
              ))}
            </div>
            <div className="admin-field-row compact">
              <label className="field-label">
                Provedor
                <input
                  value={settings.assistantApi.provider}
                  placeholder="OpenAI, Gemini, OpenRouter..."
                  onChange={(event) =>
                    updateAssistantApi({ provider: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                Modo
                <select
                  value={settings.assistantApi.mode}
                  onChange={(event) =>
                    updateAssistantApi({
                      mode: event.target.value as AssistantApiConfig['mode'],
                    })
                  }
                >
                  <option value="responses">Responses API</option>
                  <option value="chat_completions">Chat Completions</option>
                  <option value="gemini">Gemini GenerateContent</option>
                  <option value="generic_json">JSON genérico</option>
                </select>
              </label>
            </div>
            <label className="field-label">
              Endpoint
              <input
                value={settings.assistantApi.endpoint}
                placeholder="https://api.openai.com/v1/responses"
                onChange={(event) =>
                  updateAssistantApi({ endpoint: event.target.value })
                }
              />
              <span className="field-hint">
                Para Gemini, use generateContent e mantenha {'{model}'} na URL se quiser trocar modelos pelo campo abaixo.
              </span>
            </label>
            <label className="field-label">
              Modelo
              <input
                value={settings.assistantApi.model}
                placeholder="gpt-4o"
                onChange={(event) => updateAssistantApi({ model: event.target.value })}
              />
            </label>
            <label className="field-label">
              Chave da API
              <input
                type="password"
                value={assistantApiKeyDraft}
                placeholder="Cole a chave privada do provedor"
                onChange={(event) => setAssistantApiKeyDraft(event.target.value)}
              />
              <span className="field-hint">
                Ao salvar, a chave vai para AI_API_KEY na Vercel e não fica no navegador.
              </span>
            </label>
            <div className="secret-action-row">
              <button
                className="secondary-button"
                type="button"
                disabled={savingSecretKey === 'AI_ASSISTANT_CONFIG'}
                onClick={() => void saveAssistantApiConfig()}
              >
                <Save size={16} />
                {savingSecretKey === 'AI_ASSISTANT_CONFIG'
                  ? 'Salvando...'
                  : 'Salvar API da Josaninha na Vercel'}
              </button>
            </div>
            {secretFeedbackKey === 'AI_ASSISTANT_CONFIG' && secretMessage && (
              <p className="form-success">{secretMessage}</p>
            )}
            {secretFeedbackKey === 'AI_ASSISTANT_CONFIG' && secretError && (
              <p className="form-error">{secretError}</p>
            )}
            <p className="field-hint">
              Compatível com OpenAI Responses, Chat Completions, Gemini GenerateContent ou JSON simples.
            </p>
          </div>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.josaninhaEnabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  josaninhaEnabled: event.target.checked,
                }))
              }
            />
            Josaninha ativa
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.whatsappAutoEnabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  whatsappAutoEnabled: event.target.checked,
                }))
              }
            />
            WhatsApp automático
          </label>
          <label className="field-label">
            Comportamento da IA
            <textarea
              value={settings.assistantBehavior}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  assistantBehavior: event.target.value,
                }))
              }
            />
          </label>
        </aside>
      </div>

      <section
        className="table-panel admin-edit-section admin-page-panel"
        id="admin-coupons"
        hidden={activeAdminPage !== 'admin-coupons'}
      >
        <div className="admin-section-title">
          <MessageCircle size={22} />
          <div>
            <h2>Cupons</h2>
            <p>Crie cupons quando quiser começar campanhas.</p>
          </div>
          <button
            className="icon-small ml-auto"
            type="button"
            onClick={() => setCoupons([...coupons, createCoupon()])}
            aria-label="Adicionar cupom"
            title="Adicionar cupom"
          >
            <Plus size={18} />
          </button>
        </div>
        {coupons.length === 0 ? (
          <div className="empty-state compact">
            <h2>Nenhum cupom cadastrado ainda.</h2>
          </div>
        ) : (
          <div className="coupon-edit-grid">
            {coupons.map((coupon) => (
              <article className="coupon-card" key={coupon.code}>
                <label className="field-label">
                  Código
                  <input
                    value={coupon.code}
                    onChange={(event) => updateCoupon(coupon.code, { code: event.target.value })}
                  />
                </label>
                <div className="admin-field-row compact">
                  <label className="field-label">
                    Tipo
                    <select
                      value={coupon.type}
                      onChange={(event) =>
                        updateCoupon(coupon.code, {
                          type: event.target.value as Coupon['type'],
                        })
                      }
                    >
                      <option value="percent">Percentual</option>
                      <option value="fixed">Fixo</option>
                      <option value="shipping">Frete grátis</option>
                    </select>
                  </label>
                  <label className="field-label">
                    Valor
                    <input
                      type="number"
                      value={coupon.value}
                      onChange={(event) =>
                        updateCoupon(coupon.code, { value: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      </div>
    </section>
  )
}
