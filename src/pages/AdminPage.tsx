import {
  Boxes,
  FilePlus2,
  Image as ImageIcon,
  MessageCircle,
  Percent,
  Plus,
  Settings,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { MediaPreview } from '../components/MediaPreview'
import { useStore } from '../context/useStore'
import type {
  BlogPost,
  Coupon,
  Order,
  OrderStatus,
  Product,
  ProductCategory,
  SubscriptionPlan,
} from '../types'
import { formatCurrency } from '../utils/format'
import { inferMediaType, readMediaFile } from '../utils/media'

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

interface StoreSettings {
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
  businessHours: string
}

const seedSettings: StoreSettings = {
  companyName: 'JC Cogumelos',
  instagram: '@jc_cogumelos',
  facebook: '',
  whatsapp: '',
  email: '',
  shippingBase: 18.9,
  pixEnabled: true,
  creditEnabled: true,
  debitEnabled: true,
  josaninhaEnabled: true,
  whatsappAutoEnabled: true,
  assistantBehavior:
    'Atender com tom acolhedor, gourmet e objetivo. Recomendar produtos, receitas e assinaturas.',
  businessHours: '',
}

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
    published: false,
    createdAt: new Date().toISOString(),
  }
}

export function AdminPage() {
  const {
    products,
    subscriptionPlans,
    coupons,
    orders,
    blogPosts,
    notifications,
    setProducts,
    setSubscriptionPlans,
    setCoupons,
    setOrders,
    setBlogPosts,
    setNotifications,
  } = useStore()
  const [settings, setSettings] = useState<StoreSettings>(seedSettings)
  const [mediaError, setMediaError] = useState('')

  const monthSales = orders.reduce((total, order) => total + order.total, 0)
  const productByName = useMemo(() => {
    return new Map(products.map((product) => [product.name, product]))
  }, [products])

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
    setOrders(orders.map((order) => (order.id === id ? { ...order, ...patch } : order)))
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

  function updatePost(id: string, patch: Partial<BlogPost>) {
    const currentPost = blogPosts.find((post) => post.id === id)
    setBlogPosts(
      blogPosts.map((post) => (post.id === id ? { ...post, ...patch } : post)),
    )

    if (patch.published && currentPost && !currentPost.published) {
      setNotifications([
        {
          id: crypto.randomUUID(),
          audience: 'customer',
          title: 'Novo post no Blog Jozaninha',
          message: currentPost.title,
          createdAt: new Date().toISOString(),
          read: false,
          link: '/blog-jozaninha',
        },
        ...notifications,
      ])
    }
  }

  function deletePost(id: string) {
    setBlogPosts(blogPosts.filter((post) => post.id !== id))
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

  async function handlePostUpload(id: string, file?: File) {
    if (!file) {
      return
    }

    try {
      setMediaError('')
      const media = await readMediaFile(file)
      updatePost(id, { image: media.url, mediaType: media.mediaType })
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Upload não concluído.')
    }
  }

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

      <div className="dashboard-cards">
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
        <article className="metric-card green">
          <FilePlus2 size={24} />
          <span>Blog</span>
          <strong>{blogPosts.filter((post) => post.published).length}</strong>
          <p>Posts publicados no Blog Jozaninha.</p>
        </article>
        <article className="metric-card">
          <Percent size={24} />
          <span>Planos</span>
          <strong>{subscriptionPlans.length}</strong>
          <p>Assinaturas editáveis.</p>
        </article>
      </div>

      <section className="table-panel admin-edit-section">
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

      <section className="table-panel admin-edit-section">
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

      <section className="table-panel admin-edit-section">
        <div className="admin-section-title">
          <FilePlus2 size={22} />
          <div>
            <h2>Blog Jozaninha</h2>
            <p>Crie, edite, publique ou tire posts do ar.</p>
          </div>
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
                <div className="admin-product-photo blog-photo">
                  {post.image ? (
                    <MediaPreview
                      src={post.image}
                      alt={post.title}
                      mediaType={post.mediaType}
                      controls={post.mediaType === 'video'}
                    />
                  ) : (
                    <ImageIcon size={28} />
                  )}
                </div>
                <label className="field-label">
                  Upload de foto ou vídeo
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(event) => {
                      handlePostUpload(post.id, event.currentTarget.files?.[0])
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
                <div className="admin-field-row compact">
                  <label className="field-label">
                    URL da mídia
                    <input
                      value={post.image}
                      onChange={(event) =>
                        updatePost(post.id, {
                          image: event.target.value,
                          mediaType: inferMediaType(
                            event.target.value,
                            post.mediaType ?? 'image',
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Tipo
                    <select
                      value={post.mediaType ?? 'image'}
                      onChange={(event) =>
                        updatePost(post.id, {
                          mediaType: event.target.value as BlogPost['mediaType'],
                        })
                      }
                    >
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo</option>
                    </select>
                  </label>
                </div>
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

      <div className="admin-layout">
        <section className="table-panel admin-edit-section">
          <div className="admin-section-title">
            <ShoppingCart size={22} />
            <div>
              <h2>Gestão de pedidos</h2>
              <p>Quando houver vendas, status e itens poderão ser editados aqui.</p>
            </div>
          </div>
          {orders.length === 0 ? (
            <div className="empty-state compact">
              <h2>Nenhum pedido cadastrado ainda.</h2>
            </div>
          ) : (
            <div className="admin-order-list">
              {orders.map((order) => (
                <article className="admin-order-card" key={order.id}>
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
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="settings-panel admin-edit-section">
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
            Jozaninha ativa
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

      <section className="table-panel admin-edit-section">
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
    </section>
  )
}
