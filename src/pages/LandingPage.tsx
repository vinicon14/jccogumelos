import { ArrowRight, Camera, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { contact } from '../config/contact'

export function LandingPage() {
  return (
    <section className="landing-page">
      <div className="landing-nav">
        <BrandMark compact />
        <Link className="secondary-button" to="/login">
          Entrar
        </Link>
      </div>

      <div className="landing-hero landing-hero-minimal">
        <div className="landing-copy reveal-up">
          <BrandMark />
          <p className="eyebrow mt-8">JC Cogumelos</p>
          <h1>Cogumelos frescos, sem complicar.</h1>
          <p>
            Uma loja limpa para escolher, comprar e acompanhar produtos gourmet
            com orientação da Jozaninha quando você quiser.
          </p>
          <div className="landing-actions">
            <Link className="primary-button" to="/login">
              Acessar loja
              <ArrowRight size={18} />
            </Link>
            <a
              className="secondary-button"
              href={contact.instagramUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Camera size={18} />
              Instagram
            </a>
          </div>
        </div>
      </div>

      <div className="landing-strip">
        <span>Frescos</span>
        <span>Assinaturas</span>
        <span>Atacado</span>
        <span>
          <Camera size={16} />
          Instagram
        </span>
        <span>
          <MessageCircle size={16} />
          Jozaninha
        </span>
      </div>
    </section>
  )
}
