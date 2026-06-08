import { createContext } from 'react'
import type { AccountType, SessionUser } from '../types'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  name: string
  email: string
  phone: string
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
  accountType: AccountType
  password: string
  confirmPassword: string
}

export interface AuthContextValue {
  user: SessionUser | null
  login: (input: LoginInput) => Promise<{ ok: boolean; message?: string; user?: SessionUser }>
  register: (input: RegisterInput) => Promise<{ ok: boolean; message?: string }>
  logout: () => void
  isAdmin: boolean
  isAdminChecking: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
