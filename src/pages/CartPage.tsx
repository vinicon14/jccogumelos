import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useCart } from '../context/useCart'
import { useStore } from '../context/useStore'
import { formatCurrency } from '../utils/format'

function calculateDiscount(
  availableCoupons: ReturnType<typeof useStore>['coupons'],
  couponCode: string,
  subtotal: number,
  shipping: number,
) {
  const coupon = availableCoupons.find(
    (item) => item.code === couponCode.trim().toUpperCase(),
  )
  if (!coupon || subtotal < coupon.minOrder) {
    return 0
  }

  if (coupon.type === 'percent') {
    return subtotal * (coupon.value / 100)
  }

  if (coupon.type === 'fixed') {
    return coupon.value
  }

  return shipping
}

export function CartPage() {
  const { lines, subtotal, updateQuantity, removeItem } = useCart()
  const { coupons } = useStore()
  const [cep, setCep] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const shipping = cep.replace(/\D/g, '').length >= 8 ? 18.9 : 0
  const discount = useMemo(
    () => calculateDiscount(coupons, couponCode, subtotal, shipping),
    [couponCode, coupons, shipping, subtotal],
  )
  const total = Math.max(0, subtotal + shipping - discount)

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Carrinho</p>
        <h1>Revise sua seleção</h1>
        <p>Altere quantidades, aplique cupom e simule o frete antes do checkout.</p>
      </div>

      {lines.length === 0 ? (
        <div className="empty-state">
          <h2>Seu carrinho está esperando cogumelos frescos.</h2>
          <Link className="primary-button" to="/catalogo">
            Ver catálogo
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-lines">
            {lines.map((line) => (
              <article className="cart-line" key={line.product.id}>
                <img src={line.product.image} alt={line.product.name} />
                <div className="min-w-0 flex-1">
                  <h2>{line.product.name}</h2>
                  <p>{line.product.weight}</p>
                  <strong>{formatCurrency(line.product.price)}</strong>
                </div>
                <div className="qty-control" aria-label={`Quantidade de ${line.product.name}`}>
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.product.id, line.quantity - 1)}
                    aria-label="Diminuir quantidade"
                  >
                    <Minus size={15} />
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.product.id, line.quantity + 1)}
                    aria-label="Aumentar quantidade"
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <button
                  className="icon-small"
                  type="button"
                  onClick={() => removeItem(line.product.id)}
                  aria-label={`Remover ${line.product.name}`}
                  title="Remover"
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>

          <aside className="summary-panel">
            <h2>Resumo do pedido</h2>
            <label className="field-label">
              Cupom
              <input
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                placeholder="JOSANE10"
              />
            </label>
            <label className="field-label">
              CEP
              <span className="search-field">
                <Truck size={17} />
                <input
                  value={cep}
                  onChange={(event) => setCep(event.target.value)}
                  placeholder="00000-000"
                />
              </span>
            </label>
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="summary-row">
              <span>Frete</span>
              <strong>{shipping ? formatCurrency(shipping) : 'Simule pelo CEP'}</strong>
            </div>
            <div className="summary-row">
              <span>Desconto</span>
              <strong>- {formatCurrency(discount)}</strong>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <Link className="primary-button w-full justify-center" to="/checkout">
              Ir para pagamento
            </Link>
          </aside>
        </div>
      )}
    </section>
  )
}
