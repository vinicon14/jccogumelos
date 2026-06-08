import type {
  Product,
  SessionUser,
  WholesalePreorder,
  WholesaleQueueStatus,
} from '../types'
import { formatCep, formatCustomerAddress } from './customers'

export const wholesaleQueueStatusLabels: Record<WholesaleQueueStatus, string> = {
  na_fila: 'Na fila',
  em_producao: 'Em produção',
  disponivel: 'Disponível',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
}

export const activeWholesaleQueueStatuses = new Set<WholesaleQueueStatus>([
  'na_fila',
  'em_producao',
  'disponivel',
])

export function isWholesaleQueueActive(preorder: WholesalePreorder) {
  return activeWholesaleQueueStatuses.has(preorder.status)
}

export function formatWholesaleQueueNumber(queueNumber: number) {
  return `#${String(queueNumber).padStart(4, '0')}`
}

export function getNextWholesaleQueueNumber(preorders: WholesalePreorder[]) {
  return (
    preorders.reduce(
      (highest, preorder) => Math.max(highest, Number(preorder.queueNumber) || 0),
      0,
    ) + 1
  )
}

export function getWholesaleQueuePosition(
  preorder: WholesalePreorder,
  preorders: WholesalePreorder[],
) {
  if (!isWholesaleQueueActive(preorder)) {
    return 0
  }

  const productQueue = preorders
    .filter(
      (candidate) =>
        candidate.productId === preorder.productId && isWholesaleQueueActive(candidate),
    )
    .sort((a, b) => {
      const numberDiff = a.queueNumber - b.queueNumber

      if (numberDiff !== 0) {
        return numberDiff
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

  return productQueue.findIndex((candidate) => candidate.id === preorder.id) + 1
}

export function createWholesalePreorder({
  product,
  user,
  quantity,
  preorders,
}: {
  product: Product
  user: SessionUser
  quantity: number
  preorders: WholesalePreorder[]
}): WholesalePreorder {
  const createdAt = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    queueNumber: getNextWholesaleQueueNumber(preorders),
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    productWeight: product.weight,
    requestedQuantity: Math.max(1, Math.round(quantity)),
    unitPrice: product.wholesalePrice || product.price,
    customerId: user.id,
    customerName: user.name,
    customerEmail: user.email,
    customerPhone: user.phone,
    deliveryCep: formatCep(user.cep),
    deliveryAddress: formatCustomerAddress({
      cep: formatCep(user.cep),
      street: user.street,
      neighborhood: user.neighborhood,
      city: user.city,
      state: user.state,
    }),
    status: 'na_fila',
    note: '',
    createdAt,
    updatedAt: createdAt,
  }
}
