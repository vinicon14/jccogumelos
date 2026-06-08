import type { AccountType, RegisteredCustomer, SessionUser } from '../types'
import { loadRemotePayload, saveRemotePayload } from '../services/remotePersistence'

export const USERS_STORAGE_KEY = 'jc-cogumelos-users-v1'
const CUSTOMERS_REMOTE_ID = 'customers'

export interface StoredCustomer extends RegisteredCustomer {
  password: string
}

function asText(value: unknown) {
  return String(value || '').trim()
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function normalizeCustomer(customer: Partial<StoredCustomer>): StoredCustomer {
  return {
    id: asText(customer.id) || crypto.randomUUID(),
    name: asText(customer.name),
    email: asText(customer.email).toLowerCase(),
    phone: asText(customer.phone),
    cep: formatCep(asText(customer.cep)),
    street: asText(customer.street),
    neighborhood: asText(customer.neighborhood),
    city: asText(customer.city),
    state: asText(customer.state).toUpperCase().slice(0, 2),
    accountType: customer.accountType === 'atacado' ? 'atacado' : 'varejo',
    password: asText(customer.password),
    createdAt: asText(customer.createdAt) || new Date().toISOString(),
  }
}

export function readStoredCustomers(): StoredCustomer[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY)
    const customers = raw ? (JSON.parse(raw) as Array<Partial<StoredCustomer>>) : []
    return customers.map(normalizeCustomer)
  } catch {
    return []
  }
}

export function writeStoredCustomers(customers: StoredCustomer[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(customers))
  }
}

function normalizeCustomers(customers: Array<Partial<StoredCustomer>> = []) {
  return customers.map(normalizeCustomer).filter((customer) => customer.email)
}

export async function readSyncedCustomers(): Promise<StoredCustomer[]> {
  const localCustomers = readStoredCustomers()
  const remotePayload = await loadRemotePayload<{ customers?: Partial<StoredCustomer>[] }>(
    CUSTOMERS_REMOTE_ID,
  )
  const remoteCustomers = normalizeCustomers(remotePayload?.customers)

  if (remoteCustomers.length > 0) {
    writeStoredCustomers(remoteCustomers)
    return remoteCustomers
  }

  if (localCustomers.length > 0) {
    void saveRemotePayload(CUSTOMERS_REMOTE_ID, { customers: localCustomers })
  }

  return localCustomers
}

export async function writeSyncedCustomers(customers: StoredCustomer[]) {
  const normalizedCustomers = normalizeCustomers(customers)
  writeStoredCustomers(normalizedCustomers)
  await saveRemotePayload(CUSTOMERS_REMOTE_ID, { customers: normalizedCustomers })
}

export function toSessionUser(customer: StoredCustomer): SessionUser {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    cep: customer.cep,
    street: customer.street,
    neighborhood: customer.neighborhood,
    city: customer.city,
    state: customer.state,
    accountType: customer.accountType,
    role: 'customer',
  }
}

export function formatCustomerAddress(
  customer: Pick<RegisteredCustomer, 'cep' | 'street' | 'neighborhood' | 'city' | 'state'>,
) {
  const streetLine = [customer.street, customer.neighborhood].filter(Boolean).join(', ')
  const cityLine = [customer.city, customer.state].filter(Boolean).join(' - ')
  const cepLine = customer.cep ? `CEP ${formatCep(customer.cep)}` : ''

  return [streetLine, cityLine, cepLine].filter(Boolean).join(' · ') || 'Endereço não cadastrado'
}

export function normalizeAccountType(value: AccountType) {
  return value === 'atacado' ? 'Cliente atacado' : 'Cliente varejo'
}
