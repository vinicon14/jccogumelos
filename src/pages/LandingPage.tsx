import { ArrowRight, Camera, MessageCircle, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'

export function LandingPage() {
  return (
    <section className="landing-page">
      <div className="landing-nav">
        <BrandMark compact />
        <Link className="secondary-button" to="/login">
          Entrar
        </Link>
      </div>

      <div className="landing-hero">
        <div className="reveal-up">
          <BrandMark />
          <p className="eyebrow mt-8">JC Cogumelos</p>
          <h1>Cogumelos gourmet frescos, simples de pedir.</h1>
          <p>
            Produtos selecionados, planos recorrentes e a Jozaninha para ajudar
            você a escolher melhor.
          </p>
          <div className="landing-actions">
            <Link className="primary-button" to="/login">
              Acessar loja
              <ArrowRight size={18} />
            </Link>
            <a
              className="secondary-button"
              href="https://www.instagram.com/jc_cogumelos/"
              target="_blank"
              rel="noreferrer"
            >
              <Camera size={18} />
              Instagram
            </a>
          </div>
        </div>

        <div className="landing-photo reveal-up delay-100">
          <img
            src="https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?auto=format&fit=crop&w=1200&q=85"
            alt="Cogumelos frescos da JC Cogumelos"
          />
          <div className="hero-floating-card">
            <ShieldCheck size={24} />
          <div>
              <strong>Área protegida</strong>
              <span>Login e cadastro antes da compra</span>
          </div>
          </div>
        </div>
      </div>

      <div className="landing-strip">
        <span>Frescos</span>
        <span>Assinaturas</span>
        <span>Atacado</span>
        <span>WhatsApp</span>
        <span>
          <MessageCircle size={16} />
          Jozaninha
        </span>
      </div>
    </section>
  )
}
