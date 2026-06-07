import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  ChefHat,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { BrandMark } from '../components/BrandMark'
import { useStore } from '../context/useStore'
import { formatCurrency } from '../utils/format'

interface HomePageProps {
  focus?: 'assinaturas'
}

const benefits = [
  {
    icon: ChefHat,
    title: 'Fresco',
    text: 'Cogumelos selecionados para cozinhar melhor.',
  },
  {
    icon: Truck,
    title: 'Prático',
    text: 'Carrinho, frete e pedidos em poucos passos.',
  },
  {
    icon: BadgePercent,
    title: 'Varejo e atacado',
    text: 'Planos e condições para diferentes rotinas.',
  },
  {
    icon: ShieldCheck,
    title: 'Jozaninha',
    text: 'Ajuda rápida para escolher, preparar e comprar.',
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
          <div className="reveal-up">
            <BrandMark />
            <p className="hero-kicker">JC Cogumelos</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.98] text-[#2d2018] sm:text-6xl lg:text-7xl">
              Cogumelos frescos para cozinhar melhor.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6f5a45]">
              Um catálogo enxuto, pedidos simples e orientação sob medida
              quando você quiser escolher com mais segurança.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="primary-button" to="/catalogo">
                Comprar cogumelos
                <ArrowRight size={18} />
              </Link>
              <a
                className="secondary-button"
                href="https://www.instagram.com/jc_cogumelos/"
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
          <h2>Escolhas da semana</h2>
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
            <h2 className="section-title">Cogumelos frescos na sua rotina.</h2>
            <p className="mt-4 text-base leading-7 text-[#6f5a45]">
              Planos simples para receber com frequência e variar as receitas.
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

      <section className="section-band" id="blog-jozaninha">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="section-heading">
            <p>Blog Jozaninha</p>
            <h2>Receitas, novidades e dicas rápidas</h2>
            <Link to="/blog-jozaninha">Abrir blog</Link>
          </div>
          {publishedPosts.length > 0 ? (
            <div className="blog-grid">
              {publishedPosts.slice(0, 3).map((post) => (
                <article className="blog-card" key={post.id}>
                  {post.image && <img src={post.image} alt={post.title} />}
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
        <a
          className="primary-button"
          href="https://wa.me/5500000000000?text=Olá%20Jozaninha,%20quero%20comprar%20cogumelos"
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={19} />
          Chamar no WhatsApp
        </a>
      </section>
    </>
  )
}
