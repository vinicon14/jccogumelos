import { BadgeCheck, Gift, History, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { MediaPreview } from '../components/MediaPreview'
import { useAuth } from '../context/useAuth'
import { useStore } from '../context/useStore'
import { formatCurrency, formatDate } from '../utils/format'

const statusLabels: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_separacao: 'Em separação',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export function AccountPage() {
  const { user } = useAuth()
  const { orders, products, subscriptionPlans } = useStore()
  const productByName = new Map(products.map((product) => [product.name, product]))
  const userOrders = orders.filter((order) => order.customerName === user?.name)

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Minha conta</p>
        <h1>Painel do cliente</h1>
        <p>
          Dados do login atual, assinaturas disponíveis e histórico real quando
          pedidos forem registrados.
        </p>
      </div>

      <div className="account-grid">
        <aside className="profile-panel">
          <div className="avatar-circle">
            <UserRound size={34} />
          </div>
          <h2>{user?.name}</h2>
          <p className="account-type">
            {user?.accountType === 'varejo' ? 'Cliente varejo' : 'Cliente atacado'}
          </p>
          <div className="profile-lines">
            <span>
              <Mail size={16} />
              {user?.email}
            </span>
            {user?.phone && (
              <span>
                <Phone size={16} />
                {user.phone}
              </span>
            )}
            {user?.city && (
              <span>
                <MapPin size={16} />
                {user.city}
              </span>
            )}
          </div>
        </aside>

        <div className="grid gap-5">
          <div className="dashboard-cards">
            <article className="metric-card">
              <Gift size={24} />
              <span>Pontos</span>
              <strong>0</strong>
              <p>Programa de fidelidade pronto para pontuar compras reais.</p>
            </article>
            <article className="metric-card">
              <BadgeCheck size={24} />
              <span>Assinatura</span>
              <strong>{subscriptionPlans.length}</strong>
              <p>Planos disponíveis para assinatura.</p>
            </article>
            <article className="metric-card">
              <History size={24} />
              <span>Pedidos</span>
              <strong>{userOrders.length}</strong>
              <p>Histórico aparece quando houver pedidos cadastrados.</p>
            </article>
          </div>

          <section className="table-panel">
            <h2>Pedidos recentes</h2>
            {userOrders.length === 0 ? (
              <div className="empty-state compact">
                <h2>Nenhum pedido registrado ainda.</h2>
              </div>
            ) : (
              <div className="customer-order-list">
                {userOrders.map((order) => (
                  <article className="customer-order-card" key={order.id}>
                    <div>
                      <strong>{order.id}</strong>
                      <span>
                        {formatDate(order.createdAt)} · {statusLabels[order.status]} ·{' '}
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                    <div className="admin-order-products">
                      {order.items.map((itemName) => {
                        const product = productByName.get(itemName)
                        return (
                          <span className="order-product-chip" key={itemName}>
                            {product && (
                              <MediaPreview
                                src={product.image}
                                alt={product.name}
                                mediaType={product.mediaType}
                              />
                            )}
                            {itemName}
                          </span>
                        )
                      })}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="table-panel">
            <h2>Planos disponíveis</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {subscriptionPlans.map((plan) => (
                <article className="mini-plan" key={plan.id}>
                  <strong>{plan.name}</strong>
                  <span>{formatCurrency(plan.price)}</span>
                  <p>{plan.description}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
