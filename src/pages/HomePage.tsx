import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  ChefHat,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
  Camera,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { BlogMediaGallery } from '../components/BlogMediaGallery'
import { ProductCard } from '../components/ProductCard'
import { BrandMark } from '../components/BrandMark'
import { contact } from '../config/contact'
import { useAuth } from '../context/useAuth'
import { useStore } from '../context/useStore'
import { formatCurrency } from '../utils/format'
import {
  canSubscribeToPlan,
  createCustomerSubscription,
  createSubscriptionPaymentOrder,
} from '../utils/subscriptions'
import { buildWhatsAppUrl, markWhatsAppSiteEntry } from '../utils/whatsapp'

interface HomePageProps {
  focus?: 'assinaturas'
}

const benefits = [
  {
    icon: ChefHat,
    title: 'Fresco',
    text: 'Seleção curta, visual claro e preparo fácil.',
  },
  {
    icon: Truck,
    title: 'Prático',
    text: 'Compra direta, carrinho simples e frete previsível.',
  },
  {
    icon: BadgePercent,
    title: 'Varejo e atacado',
    text: 'Produtos e planos para casa, chefs e pequenos negócios.',
  },
  {
    icon: ShieldCheck,
    title: 'Josaninha',
    text: 'Orientação rápida para comparar, preparar e comprar.',
  },
]

export function HomePage({ focus }: HomePageProps) {
  const { user } = useAuth()
  const {
    products,
    subscriptionPlans,
    customerSubscriptions,
    orders,
    blogPosts,
    notifications,
    settings,
    setCustomerSubscriptions,
    setOrders,
    setNotifications,
  } = useStore()
  const featured = products.filter((product) => product.bestSeller || product.isNew).slice(0, 3)
  const publishedPosts = blogPosts.filter((post) => post.published)
  const whatsAppUrl = buildWhatsAppUrl(settings.whatsapp) || contact.whatsAppUrl

  useEffect(() => {
    if (focus !== 'assinaturas') {
      return
    }

    window.requestAnimationFrame(() => {
      document.getElementById('assinaturas')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [focus])

  function handleSubscribe(planId: string) {
    if (!user) {
      return
    }

    const plan = subscriptionPlans.find((item) => item.id === planId)
    if (!plan || !canSubscribeToPlan({ subscriptions: customerSubscriptions, planId, userId: user.id })) {
      return
    }

    const subscription = createCustomerSubscription({ plan, user })
    const paymentOrder = createSubscriptionPaymentOrder({ subscription, plan, user })
    setCustomerSubscriptions([subscription, ...customerSubscriptions])
    setOrders([paymentOrder, ...orders])
    setNotifications([
      {
        id: crypto.randomUUID(),
        audience: 'admin',
        title: 'Nova assinatura aguardando pagamento',
        message: `${user.name} solicitou ${plan.name}. Ative após confirmar o pagamento.`,
        createdAt: new Date().toISOString(),
        read: false,
        link: '/admin',
      },
      {
        id: crypto.randomUUID(),
        audience: 'customer',
        title: 'Pagamento da assinatura criado',
        message: `Pague o pedido ${paymentOrder.id} para ativar ${plan.name}.`,
        createdAt: new Date().toISOString(),
        read: false,
        link: '/conta',
      },
      ...notifications,
    ])
  }

  return (
    <>
      <section className="hero-section">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
          <div className="home-hero-copy reveal-up">
            <BrandMark />
            <p className="hero-kicker">JC Cogumelos</p>
            <h1 className="home-hero-title mt-5 max-w-3xl text-5xl font-black leading-[0.98] text-[#201b17] sm:text-6xl lg:text-7xl">
              Cogumelos frescos para uma cozinha mais simples.
            </h1>
            <p className="home-hero-text mt-6 max-w-2xl text-lg leading-8 text-[#62584e]">
              Escolha shimeji, shiitake e kits da semana em uma experiência
              limpa, com ajuda sob medida quando precisar decidir melhor.
            </p>
            <div className="home-hero-actions mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="primary-button" to="/catalogo">
                Comprar cogumelos
                <ArrowRight size={18} />
              </Link>
              <a
                className="secondary-button"
                href={whatsAppUrl || contact.instagramUrl}
                onClick={whatsAppUrl ? markWhatsAppSiteEntry : undefined}
                target="_blank"
                rel="noreferrer"
              >
                {whatsAppUrl ? (
                  <>
                    <MessageCircle size={18} />
                    Falar no WhatsApp
                  </>
                ) : (
                  'Ver Instagram'
                )}
              </a>
            </div>
          </div>

          <div className="hero-product-panel reveal-up delay-100">
            <div className="hero-photo">
              <img
                src="https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?auto=format&fit=crop&w=1200&q=85"
                alt="Cogumelos gourmet selecionados"
              />
            </div>
            <div className="hero-floating-card">
              <PackageCheck size={24} />
              <div>
                <strong>Seleção fresca</strong>
                <span>Shimeji, shitake e kits da semana</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <article
                className="feature-tile reveal-up"
                style={{ animationDelay: `${index * 80}ms` }}
                key={benefit.title}
              >
                <Icon size={24} />
                <h2>{benefit.title}</h2>
                <p>{benefit.text}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p>Produtos em destaque</p>
          <h2>Escolhas para começar bem</h2>
          <Link to="/catalogo">Ver catálogo completo</Link>
        </div>
        <div className="product-grid">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section
        id="assinaturas"
        className={`subscription-section ${focus === 'assinaturas' ? 'ring-focus' : ''}`}
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="eyebrow">Assinaturas</p>
            <h2 className="section-title">Uma rotina mais leve.</h2>
            <p className="mt-4 text-base leading-7 text-[#6f5a45]">
              Planos simples para receber variedade sem precisar refazer a
              escolha toda semana.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {subscriptionPlans.map((plan) => {
                const existingSubscription = user
                  ? customerSubscriptions.find(
                      (subscription) =>
                        subscription.customerId === user.id &&
                        subscription.planId === plan.id &&
                        subscription.status !== 'cancelada',
                    )
                  : undefined
                const canSubscribe = Boolean(
                  user &&
                    canSubscribeToPlan({
                      subscriptions: customerSubscriptions,
                      planId: plan.id,
                      userId: user.id,
                    }),
                )
                const actionLabel = existingSubscription
                  ? existingSubscription.status === 'aguardando_pagamento'
                    ? 'Aguardando pagamento'
                    : 'Plano já ativo'
                  : 'Assinar plano'

              return (
                <article className="plan-card" key={plan.id}>
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                  <strong>{formatCurrency(plan.price)}</strong>
                  <span>{plan.cadence}</span>
                  <button
                    className="secondary-button plan-action-button"
                    type="button"
                    disabled={!canSubscribe}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {canSubscribe ? 'Assinar plano' : actionLabel}
                  </button>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section-band" id="blog-josaninha">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="section-heading">
            <p>Blog Josaninha</p>
            <h2>Receitas, novidades e dicas rápidas</h2>
            <Link to="/blog-josaninha">Abrir blog</Link>
          </div>
          {publishedPosts.length > 0 ? (
            <div className="blog-grid">
              {publishedPosts.slice(0, 3).map((post) => (
                <article className="blog-card" key={post.id}>
                  <BlogMediaGallery
                    compact
                    media={post.media}
                    fallback={{ src: post.image, mediaType: post.mediaType, alt: post.title }}
                    title={post.title}
                  />
                  <div>
                    <CheckCircle2 size={20} />
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <h2>O primeiro post aparece aqui assim que for publicado.</h2>
            </div>
          )}
        </div>
      </section>

      <section className="whatsapp-cta">
        <div>
          <p className="eyebrow">Atendimento rápido</p>
          <h2>Escolha com ajuda, compre sem complicar.</h2>
        </div>
        {whatsAppUrl ? (
          <a
            className="primary-button"
            href={whatsAppUrl}
            onClick={markWhatsAppSiteEntry}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={19} />
            Chamar no WhatsApp
          </a>
        ) : (
          <a
            className="primary-button"
            href={contact.instagramUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Camera size={19} />
            Falar pelo Instagram
          </a>
        )}
      </section>
    </>
  )
}
