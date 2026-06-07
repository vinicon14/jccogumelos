import { CreditCard, QrCode, TimerReset } from 'lucide-react'
import { useState } from 'react'
import { useCart } from '../context/useCart'
import type { PaymentMethod } from '../types'
import { formatCurrency } from '../utils/format'

const paymentOptions: Array<{ value: PaymentMethod; label: string; icon: typeof QrCode }> = [
  { value: 'pix', label: 'PIX', icon: QrCode },
  { value: 'credito', label: 'Cartão de crédito', icon: CreditCard },
  { value: 'debito', label: 'Cartão de débito', icon: CreditCard },
]

const statuses = [
  'Pedido criado',
  'Aguardando pagamento',
  'Pagamento aprovado',
  'Pedido em preparação',
  'Pedido enviado',
  'Pedido entregue',
]

export function CheckoutPage() {
  const { lines, subtotal } = useCart()
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const total = subtotal > 0 ? subtotal + 18.9 : 0

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Checkout</p>
        <h1>Finalizar pedido</h1>
        <p>
          Fluxo preparado para PIX, cartão e cancelamento automático se o pagamento
          não for aprovado em 5 minutos.
        </p>
      </div>

      <div className="checkout-layout">
        <div className="payment-panel">
          <h2>Método de pagamento</h2>
          <div className="grid gap-3">
            {paymentOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  className={`payment-option ${method === option.value ? 'active' : ''}`}
                  type="button"
                  onClick={() => setMethod(option.value)}
                >
                  <Icon size={20} />
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-6 rounded-[8px] bg-[#fff7ec] p-4 text-sm leading-6 text-[#6f5a45]">
            <strong className="block text-[#2d2018]">
              {method === 'pix' ? 'QR Code PIX será gerado aqui.' : 'Dados do cartão entram aqui.'}
            </strong>
            A confirmação de pagamento aparecerá aqui assim que o pedido for
            processado.
          </div>
        </div>

        <aside className="summary-panel">
          <h2>Status do pedido</h2>
          {lines.length > 0 && (
            <div className="checkout-items">
              {lines.map((line) => (
                <article className="checkout-item" key={line.product.id}>
                  <img src={line.product.image} alt={line.product.name} />
                  <div>
                    <strong>{line.product.name}</strong>
                    <span>
                      {line.quantity}x · {formatCurrency(line.subtotal)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="status-list">
            {statuses.map((status, index) => (
              <div className="status-step" key={status}>
                <span>{index + 1}</span>
                <p>{status}</p>
              </div>
            ))}
          </div>
          <div className="timer-card">
            <TimerReset size={22} />
            <p>Pedidos sem pagamento podem ser cancelados automaticamente.</p>
          </div>
          <div className="summary-total">
            <span>Total estimado</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </aside>
      </div>
    </section>
  )
}
