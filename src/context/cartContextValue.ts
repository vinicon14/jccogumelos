import { createContext } from 'react'
import type { CartItem, Product } from '../types'

export interface CartLine {
  product: Product
  quantity: number
  subtotal: number
}

export interface CartContextValue {
  items: CartItem[]
  lines: CartLine[]
  itemCount: number
  subtotal: number
  addItem: (productId: string, quantity?: number) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
}

export const CartContext = createContext<CartContextValue | undefined>(undefined)
