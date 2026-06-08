import { Hash, Plus, Star } from 'lucide-react'
import { useState } from 'react'
import { MediaPreview } from './MediaPreview'
import { useAuth } from '../context/useAuth'
import { useCart } from '../context/useCart'
import { useStore } from '../context/useStore'
import { categoryLabels } from '../data/mockData'
import type { Product } from '../types'
import { formatCurrency } from '../utils/format'
import {
  createWholesalePreorder,
  formatWholesaleQueueNumber,
  getWholesaleQueuePosition,
  isWholesaleQueueActive,
} from '../utils/wholesalePreorders'

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const { user } = useAuth()
  const {
    notifications,
    wholesalePreorders,
    setNotifications,
    setWholesalePreorders,
  } = useStore()
  const [wholesaleQuantity, setWholesaleQuantity] = useState(5)
  const soldOut = product.stock <= 0
  const canWholesalePreorder =
    user?.accountType === 'atacado' && Boolean(product.wholesalePrice)
  const activeWholesalePreorder = canWholesalePreorder
    ? wholesalePreorders.find(
        (preorder) =>
          preorder.customerId === user?.id &&
          preorder.productId === product.id &&
          isWholesaleQueueActive(preorder),
      )
    : undefined
  const queuePosition = activeWholesalePreorder
    ? getWholesaleQueuePosition(activeWholesalePreorder, wholesalePreorders)
    : 0

  function handleWholesalePreorder() {
    if (!user || !canWholesalePreorder || activeWholesalePreorder) {
      return
    }

    const preorder = createWholesalePreorder({
      product,
      user,
      quantity: wholesaleQuantity,
      preorders: wholesalePreorders,
    })

    setWholesalePreorders([preorder, ...wholesalePreorders])
    setNotifications([
      {
        id: crypto.randomUUID(),
        audience: 'admin',
        title: 'Nova encomenda atacado',
        message: `${user.name} entrou na fila ${formatWholesaleQueueNumber(
          preorder.queueNumber,
        )} para ${product.name}.`,
        createdAt: preorder.createdAt,
        read: false,
        link: '/admin',
      },
      {
        id: crypto.randomUUID(),
        audience: 'customer',
        title: 'Encomenda registrada',
        message: `${product.name}: fila ${formatWholesaleQueueNumber(
          preorder.queueNumber,
        )}.`,
        createdAt: preorder.createdAt,
        read: false,
        link: '/conta',
      },
      ...notifications,
    ])
  }

  return (
    <article className={`product-card ${soldOut ? 'product-card-disabled' : ''}`}>
      <div className="product-media relative aspect-[4/3] overflow-hidden bg-[#e5e2d9]">
        <MediaPreview
          autoPlay={product.mediaType === 'video'}
          className="h-full w-full object-cover transition duration-500"
          src={product.image}
          alt={product.name}
          mediaType={product.mediaType}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {soldOut && <span className="badge badge-muted">Esgotado</span>}
          {product.bestSeller && <span className="badge">Mais vendido</span>}
          {product.isNew && <span className="badge badge-green">Novo</span>}
        </div>
      </div>
      <div className="grid flex-1 gap-4 p-4">
        <div className="product-copy">
          <p className="text-xs font-black uppercase tracking-wider text-[#8c5d3b]">
            {categoryLabels[product.category]} · {product.weight}
          </p>
          <h3 className="mt-1 text-xl font-black leading-tight text-[#201b17]">
            {product.name}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#62584e]">
            {product.description}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm font-bold text-[#5f4a38]">
          <Star className="fill-[#d9893d] text-[#d9893d]" size={16} />
          {product.rating.toFixed(1)}
          <span className="font-medium text-[#8c7965]">({product.reviews})</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {product.benefits.slice(0, 3).map((benefit) => (
            <span key={benefit} className="rounded-full bg-[#f3e5d2] px-3 py-1 text-xs font-bold text-[#6d452b]">
              {benefit}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#8c7965]">Varejo</p>
            <strong className="text-2xl text-[#2d2018]">
              {formatCurrency(product.price)}
            </strong>
            <p className={`text-xs font-bold ${soldOut ? 'text-[#9d2d1b]' : 'text-[#28513c]'}`}>
              {soldOut ? 'Produto indisponível' : `${product.stock} em estoque`}
            </p>
            {product.wholesalePrice && (
              <p className="text-xs font-bold text-[#28513c]">
                Atacado {formatCurrency(product.wholesalePrice)}
              </p>
            )}
          </div>
          <button
            className="icon-action"
            type="button"
            onClick={() => addItem(product.id)}
            disabled={soldOut}
            aria-label={`Adicionar ${product.name} ao carrinho`}
            title={soldOut ? 'Produto esgotado' : 'Adicionar ao carrinho'}
          >
            <Plus size={20} />
          </button>
        </div>

        {canWholesalePreorder && (
          <div className="wholesale-queue-box">
            {activeWholesalePreorder ? (
              <div>
                <strong>
                  {formatWholesaleQueueNumber(activeWholesalePreorder.queueNumber)}
                </strong>
                <span>
                  {queuePosition > 0
                    ? `Posição ${queuePosition} na fila deste produto`
                    : 'Encomenda finalizada'}
                </span>
              </div>
            ) : (
              <label>
                Qtd. atacado
                <input
                  min={1}
                  type="number"
                  value={wholesaleQuantity}
                  onChange={(event) =>
                    setWholesaleQuantity(Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </label>
            )}
            <button
              className="secondary-button wholesale-queue-button"
              type="button"
              disabled={Boolean(activeWholesalePreorder)}
              onClick={handleWholesalePreorder}
            >
              <Hash size={16} />
              {activeWholesalePreorder ? 'Na fila' : 'Entrar na fila atacado'}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
