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
  city: string
  accountType: AccountType
  password: string
  confirmPassword: string
}

export interface AuthContextValue {
  user: SessionUser | null
  login: (input: LoginInput) => Promise<{ ok: boolean; message?: string }>
  register: (input: RegisterInput) => { ok: boolean; message?: string }
  logout: () => void
  isAdmin: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
