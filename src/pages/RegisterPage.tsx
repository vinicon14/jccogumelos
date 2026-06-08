import { MapPin, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { useAuth } from '../context/useAuth'
import type { AccountType } from '../types'
import { formatCep, onlyDigits } from '../utils/customers'

interface ViaCepResponse {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('varejo')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [cepMessage, setCepMessage] = useState('')

  async function lookupCep(nextCep = cep) {
    const digits = onlyDigits(nextCep)

    if (digits.length !== 8) {
      if (digits.length > 0) {
        setCepMessage('Digite um CEP com 8 números.')
      }
      return
    }

    try {
      setCepMessage('Buscando endereço...')
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = (await response.json()) as ViaCepResponse

      if (!response.ok || data.erro) {
        setCepMessage('CEP não encontrado. Preencha o endereço manualmente.')
        return
      }

      setStreet(data.logradouro || street)
      setNeighborhood(data.bairro || neighborhood)
      setCity(data.localidade || city)
      setState(data.uf || state)
      setCepMessage('Endereço preenchido pelo CEP.')
    } catch {
      setCepMessage('Não foi possível buscar o CEP agora.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await register({
      name,
      email,
      phone,
      cep,
      street,
      neighborhood,
      city,
      state,
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
            CEP
            <input
              inputMode="numeric"
              value={cep}
              onBlur={() => lookupCep()}
              onChange={(event) => setCep(formatCep(event.target.value))}
            />
          </label>
        </div>
        <div className="cep-action-row">
          <button className="secondary-button" type="button" onClick={() => lookupCep()}>
            <MapPin size={16} />
            Buscar CEP
          </button>
          {cepMessage && <span>{cepMessage}</span>}
        </div>
        <label className="field-label">
          Rua / endereço
          <input value={street} onChange={(event) => setStreet(event.target.value)} />
        </label>
        <div className="admin-field-row compact">
          <label className="field-label">
            Bairro
            <input
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
            />
          </label>
          <label className="field-label">
            Cidade
            <input value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
        </div>
        <label className="field-label">
          UF
          <input
            maxLength={2}
            value={state}
            onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))}
          />
        </label>
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
