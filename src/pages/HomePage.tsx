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
import { ProductCard } from '../components/ProductCard'
import { BrandMark } from '../components/BrandMark'
import { MediaPreview } from '../components/MediaPreview'
import { contact } from '../config/contact'
import { useStore } from '../context/useStore'
import { formatCurrency } from '../utils/format'

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
  const { products, subscriptionPlans, blogPosts } = useStore()
  const featured = products.filter((product) => product.bestSeller || product.isNew).slice(0, 3)
  const publishedPosts = blogPosts.filter((post) => post.published)

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
                href={contact.instagramUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver Instagram
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
            {subscriptionPlans.map((plan) => (
              <article className="plan-card" key={plan.id}>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <strong>{formatCurrency(plan.price)}</strong>
                <span>{plan.cadence}</span>
              </article>
            ))}
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
                  {post.image && (
                    <MediaPreview
                      src={post.image}
                      alt={post.title}
                      mediaType={post.mediaType}
                    />
                  )}
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
        {contact.whatsAppUrl ? (
          <a
            className="primary-button"
            href={contact.whatsAppUrl}
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
