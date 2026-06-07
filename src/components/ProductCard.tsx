import { Plus, Star } from 'lucide-react'
import { useCart } from '../context/useCart'
import { categoryLabels } from '../data/mockData'
import type { Product } from '../types'
import { formatCurrency } from '../utils/format'

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()

  return (
    <article className="product-card">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#eadcc8]">
        <img
          className="h-full w-full object-cover transition duration-500 hover:scale-105"
          src={product.image}
          alt={product.name}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.bestSeller && <span className="badge">Mais vendido</span>}
          {product.isNew && <span className="badge badge-green">Novo</span>}
        </div>
      </div>
      <div className="grid flex-1 gap-4 p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#9a5a33]">
            {categoryLabels[product.category]} · {product.weight}
          </p>
          <h3 className="mt-1 text-xl font-black leading-tight text-[#2d2018]">
            {product.name}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#6f5a45]">
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
            aria-label={`Adicionar ${product.name} ao carrinho`}
            title="Adicionar ao carrinho"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </article>
  )
}
