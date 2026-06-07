import { UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { useAuth } from '../context/useAuth'
import type { AccountType } from '../types'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('varejo')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = register({
      name,
      email,
      phone,
      city,
      accountType,
      password,
      confirmPassword,
    })

    if (!result.ok) {
      setError(result.message ?? 'Não foi possível cadastrar.')
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
          <h1 className="auth-word" aria-label="Cadastro">
            cada<span className="mushroom-letter mushroom-s">s</span>tro
          </h1>
          <p>Cadastre-se para comprar no varejo ou solicitar condições de atacado.</p>
        </div>

        <label className="field-label">
          Nome completo
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field-label">
          E-mail
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <div className="admin-field-row compact">
          <label className="field-label">
            Telefone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="field-label">
            Cidade
            <input value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
        </div>
        <label className="field-label">
          Tipo de conta
          <select
            value={accountType}
            onChange={(event) => setAccountType(event.target.value as AccountType)}
          >
            <option value="varejo">Varejo</option>
            <option value="atacado">Atacado</option>
          </select>
        </label>
        <div className="admin-field-row compact">
          <label className="field-label">
            Senha
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field-label">
            Confirmar senha
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button justify-center" type="submit">
          <UserPlus size={18} />
          Cadastrar
        </button>
        <p className="auth-switch">
          Já tem cadastro? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </section>
  )
}
