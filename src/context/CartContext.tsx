import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { CartItem } from '../types'
import type { CartLine } from './cartContextValue'
import { CartContext } from './cartContextValue'
import { useStore } from './useStore'

const CART_STORAGE_KEY = 'jc-cogumelos-cart-v1'

function readStoredCart(): CartItem[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

function persistCart(items: CartItem[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { products } = useStore()
  const [items, setItems] = useState<CartItem[]>(readStoredCart)

  const commitItems = useCallback((nextItems: CartItem[]) => {
    setItems(nextItems)
    persistCart(nextItems)
  }, [])

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      const current = items.find((item) => item.productId === productId)
      const nextItems = current
        ? items.map((item) =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [...items, { productId, quantity }]

      commitItems(nextItems)
    },
    [commitItems, items],
  )

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      const nextItems = items
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, quantity) }
            : item,
        )
        .filter((item) => item.quantity > 0)

      commitItems(nextItems)
    },
    [commitItems, items],
  )

  const removeItem = useCallback(
    (productId: string) => {
      commitItems(items.filter((item) => item.productId !== productId))
    },
    [commitItems, items],
  )

  const clearCart = useCallback(() => {
    commitItems([])
  }, [commitItems])

  const lines = useMemo(
    () =>
      items
        .map((item) => {
          const product = products.find((candidate) => candidate.id === item.productId)
          if (!product) {
            return undefined
          }

          return {
            product,
            quantity: item.quantity,
            subtotal: product.price * item.quantity,
          }
        })
        .filter((line): line is CartLine => Boolean(line)),
    [items, products],
  )

  const value = useMemo(
    () => ({
      items,
      lines,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: lines.reduce((total, line) => total + line.subtotal, 0),
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [addItem, clearCart, items, lines, removeItem, updateQuantity],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
