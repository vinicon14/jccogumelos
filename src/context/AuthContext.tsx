import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SessionUser } from '../types'
import { AuthContext, type LoginInput, type RegisterInput } from './authContextValue'

const AUTH_STORAGE_KEY = 'jc-cogumelos-auth-v1'
const USERS_STORAGE_KEY = 'jc-cogumelos-users-v1'
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase()

interface StoredCustomer {
  id: string
  name: string
  email: string
  phone: string
  city: string
  accountType: 'varejo' | 'atacado'
  password: string
}

function readStoredUser(): SessionUser | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

function readStoredCustomers(): StoredCustomer[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredCustomer[]) : []
  } catch {
    return []
  }
}

function persistSession(user: SessionUser) {
  setTimeout(() => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  }, 0)
}

async function authenticateAdmin(email: string, password: string) {
  try {
    const response = await fetch('/api/admin-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (response.ok) {
      const data = (await response.json()) as {
        user: SessionUser
        adminToken: string
        adminExpiresAt: number
      }
      return {
        ok: true,
        user: {
          ...data.user,
          adminToken: data.adminToken,
          adminExpiresAt: data.adminExpiresAt,
        },
      }
    }

    if (response.status === 401) {
      return { ok: false, configured: true, message: 'Credenciais administrativas inválidas.' }
    }

    if (response.status === 503) {
      return {
        ok: false,
        configured: false,
        message: 'Login administrativo ainda não está configurado no servidor.',
      }
    }

    return { ok: false, configured: false, message: 'Login administrativo indisponível.' }
  } catch {
    return { ok: false, configured: false, message: 'Login administrativo indisponível.' }
  }
}

async function verifyAdminSession(user: SessionUser) {
  if (!user.adminToken) {
    return { ok: false }
  }

  try {
    const response = await fetch('/api/admin-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: user.adminToken }),
    })

    if (!response.ok) {
      return { ok: false }
    }

    const data = (await response.json()) as {
      user: SessionUser
      adminExpiresAt: number
    }

    return {
      ok: true,
      user: {
        ...data.user,
        adminToken: user.adminToken,
        adminExpiresAt: data.adminExpiresAt,
      },
    }
  } catch {
    return { ok: false }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(readStoredUser)
  const [adminVerified, setAdminVerified] = useState(false)

  useEffect(() => {
    if (user?.role !== 'admin') {
      return
    }

    let active = true

    verifyAdminSession(user).then((result) => {
      if (!active) {
        return
      }

      if (result.ok && result.user) {
        setUser((current) => {
          if (
            current?.adminToken === result.user.adminToken &&
            current?.adminExpiresAt === result.user.adminExpiresAt &&
            current?.email === result.user.email
          ) {
            return current
          }

          return result.user
        })
        setAdminVerified(true)
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user))
      } else {
        setUser(null)
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    })

    return () => {
      active = false
    }
  }, [user])

  const login = useCallback(async (input: LoginInput) => {
    const email = input.email.trim().toLowerCase()
    const password = input.password.trim()

    if (!email || !password) {
      return { ok: false, message: 'Informe e-mail e senha.' }
    }

    const adminAttempt = await authenticateAdmin(email, password)

    if (adminAttempt.ok && adminAttempt.user) {
      setUser(adminAttempt.user)
      setAdminVerified(true)
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminAttempt.user))
      return { ok: true, user: adminAttempt.user }
    }

    if (ADMIN_EMAIL && email === ADMIN_EMAIL) {
      return { ok: false, message: adminAttempt.message }
    }

    const customer = readStoredCustomers().find(
      (candidate) =>
        candidate.email.toLowerCase() === email && candidate.password === password,
    )

    if (!customer) {
      return { ok: false, message: 'Cliente não encontrado. Faça o cadastro primeiro.' }
    }

    const nextUser: SessionUser = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      accountType: customer.accountType,
      role: 'customer',
    }

    setUser(nextUser)
    setAdminVerified(false)
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser))
    return { ok: true, user: nextUser }
  }, [])

  const register = useCallback((input: RegisterInput) => {
    if (!input.name.trim() || !input.email.trim() || !input.password.trim()) {
      return { ok: false, message: 'Preencha nome, e-mail e senha.' }
    }

    if (input.password !== input.confirmPassword) {
      return { ok: false, message: 'A confirmação de senha não confere.' }
    }

    const email = input.email.trim().toLowerCase()
    const customers = readStoredCustomers()

    if (customers.some((customer) => customer.email.toLowerCase() === email)) {
      return { ok: false, message: 'Este e-mail já possui cadastro.' }
    }

    const customer: StoredCustomer = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      email,
      phone: input.phone.trim(),
      city: input.city.trim(),
      accountType: input.accountType,
      password: input.password,
    }

    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([...customers, customer]))

    const nextUser: SessionUser = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      accountType: customer.accountType,
      role: 'customer',
    }

    setUser(nextUser)
    setAdminVerified(false)
    persistSession(nextUser)
    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setAdminVerified(false)
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  }, [])

  const value = useMemo(
    () => ({
      user,
      login,
      register,
      logout,
      isAdmin: user?.role === 'admin' && adminVerified,
      isAdminChecking: user?.role === 'admin' && !adminVerified,
    }),
    [adminVerified, login, logout, register, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
