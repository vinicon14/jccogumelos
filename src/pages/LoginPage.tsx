import { LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { useAuth } from '../context/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await login({ email, password })

    if (!result.ok) {
      setError(result.message ?? 'Não foi possível entrar.')
      return
    }

    navigate('/loja')
  }

  return (
    <section className="login-page">
      <Link className="landing-back" to="/">
        JC Cogumelos
      </Link>
      <form className="login-card reveal-up" onSubmit={handleSubmit}>
        <div className="auth-brand-stage">
          <BrandMark />
          <h1 className="auth-word" aria-label="Login">
            lo<span className="mushroom-letter mushroom-g">g</span>in
          </h1>
          <p>Entre com seu e-mail para acessar a loja JC Cogumelos.</p>
        </div>

        <label className="field-label">
          E-mail
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field-label">
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button justify-center" type="submit">
          <LockKeyhole size={18} />
          Entrar
        </button>
        <p className="auth-switch">
          Ainda não tem cadastro? <Link to="/cadastro">Criar conta</Link>
        </p>
      </form>
    </section>
  )
}
