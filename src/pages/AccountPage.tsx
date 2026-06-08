import {
  BadgeCheck,
  CalendarClock,
  Gift,
  Hash,
  History,
  Mail,
  MapPin,
  PackageCheck,
  PauseCircle,
  Phone,
  PlayCircle,
  UserRound,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { MediaPreview } from '../components/MediaPreview'
import { useAuth } from '../context/useAuth'
import { useStore } from '../context/useStore'
import { formatCep, formatCustomerAddress } from '../utils/customers'
import { formatCurrency, formatDate } from '../utils/format'
import {
  formatPaymentRemaining,
  getOrderTrackingIndex,
  orderBelongsToUser,
  orderStatusLabels,
  orderTrackingSteps,
} from '../utils/orders'
import {
  canSubscribeToPlan,
  createCustomerSubscription,
  createSubscriptionPaymentOrder,
  isActiveSubscription,
  subscriptionStatusLabels,
} from '../utils/subscriptions'
import type { SubscriptionStatus, WholesaleQueueStatus } from '../types'
import {
  formatWholesaleQueueNumber,
  getWholesaleQueuePosition,
  isWholesaleQueueActive,
  wholesaleQueueStatusLabels,
} from '../utils/wholesalePreorders'

export function AccountPage() {
  const { user } = useAuth()
  const [now, setNow] = useState(0)
  const {
    orders,
    products,
    subscriptionPlans,
    customerSubscriptions,
    wholesalePreorders,
    notifications,
    setCustomerSubscriptions,
    setNotifications,
    setOrders,
    setWholesalePreorders,
  } = useStore()
  const productByName = new Map(products.map((product) => [product.name, product]))
  const userOrders = orders.filter((order) => orderBelongsToUser(order, user))
  const subscriptionOrderById = new Map(
    userOrders
      .filter((order) => order.subscriptionId)
      .map((order) => [order.subscriptionId, order]),
  )
  const userSubscriptions = customerSubscriptions.filter(
    (subscription) => subscription.customerId === user?.id,
  )
  const activeSubscriptions = userSubscriptions.filter(isActiveSubscription)
  const userWholesalePreorders = wholesalePreorders
    .filter((preorder) => preorder.customerId === user?.id)
    .sort((a, b) => b.queueNumber - a.queueNumber)
  const activeWholesalePreorders = userWholesalePreorders.filter(isWholesaleQueueActive)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(interval)
  }, [])

  function subscribeToPlan(planId: string) {
    if (!user) {
      return
    }

    const plan = subscriptionPlans.find((item) => item.id === planId)
    if (
      !plan ||
      !canSubscribeToPlan({ subscriptions: customerSubscriptions, planId, userId: user.id })
    ) {
      return
    }

    const subscription = createCustomerSubscription({ plan, user })
    const paymentOrder = createSubscriptionPaymentOrder({ subscription, plan, user })
    setCustomerSubscriptions([subscription, ...customerSubscriptions])
    setOrders([paymentOrder, ...orders])
    setNotifications([
      {
        id: crypto.randomUUID(),
        audience: 'admin',
        title: 'Nova assinatura aguardando pagamento',
        message: `${user.name} solicitou ${plan.name}. Ative após confirmar o pagamento.`,
        createdAt: new Date().toISOString(),
        read: false,
        link: '/admin',
      },
      {
        id: crypto.randomUUID(),
        audience: 'customer',
        title: 'Pagamento da assinatura criado',
        message: `Pague o pedido ${paymentOrder.id} para ativar ${plan.name}.`,
        createdAt: new Date().toISOString(),
        read: false,
        link: '/conta',
      },
      ...notifications,
    ])
  }

  function updateSubscriptionStatus(id: string, status: SubscriptionStatus) {
    setCustomerSubscriptions(
      customerSubscriptions.map((subscription) =>
        subscription.id === id
          ? {
              ...subscription,
              status,
              lastUpdatedAt: new Date().toISOString(),
            }
          : subscription,
      ),
    )
  }

  function updateWholesalePreorderStatus(id: string, status: WholesaleQueueStatus) {
    const preorder = wholesalePreorders.find((item) => item.id === id)
    const now = new Date().toISOString()

    setWholesalePreorders(
      wholesalePreorders.map((item) =>
        item.id === id ? { ...item, status, updatedAt: now } : item,
      ),
    )

    if (preorder && status === 'cancelada') {
      setNotifications([
        {
          id: crypto.randomUUID(),
          audience: 'admin',
          title: 'Encomenda atacado cancelada',
          message: `${preorder.customerName} cancelou ${formatWholesaleQueueNumber(
            preorder.queueNumber,
          )}.`,
          createdAt: now,
          read: false,
          link: '/admin',
        },
        ...notifications,
      ])
    }
  }

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
            {user?.cep && (
              <span>
                <MapPin size={16} />
                {formatCustomerAddress({
                  cep: formatCep(user.cep),
                  street: user.street,
                  neighborhood: user.neighborhood,
                  city: user.city,
                  state: user.state,
                })}
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
              <strong>{activeSubscriptions.length}</strong>
              <p>Planos ativos ou pausados na sua conta.</p>
            </article>
            <article className="metric-card">
              <History size={24} />
              <span>Pedidos</span>
              <strong>{userOrders.length}</strong>
              <p>Histórico aparece quando houver pedidos cadastrados.</p>
            </article>
            {user?.accountType === 'atacado' && (
              <article className="metric-card green">
                <Hash size={24} />
                <span>Encomendas</span>
                <strong>{activeWholesalePreorders.length}</strong>
                <p>Fila atacado com posição e status atualizados.</p>
              </article>
            )}
          </div>

          {user?.accountType === 'atacado' && (
            <section className="table-panel">
              <h2>Fila de encomendas atacado</h2>
              {userWholesalePreorders.length === 0 ? (
                <div className="empty-state compact">
                  <h2>Nenhuma encomenda em fila ainda.</h2>
                </div>
              ) : (
                <div className="customer-order-list wholesale-queue-list">
                  {userWholesalePreorders.map((preorder) => {
                    const position = getWholesaleQueuePosition(preorder, wholesalePreorders)

                    return (
                      <article className="customer-order-card wholesale-queue-card" key={preorder.id}>
                        <div className="wholesale-queue-heading">
                          {preorder.productImage && (
                            <MediaPreview
                              src={preorder.productImage}
                              alt={preorder.productName}
                            />
                          )}
                          <div>
                            <strong>{preorder.productName}</strong>
                            <span>
                              {formatWholesaleQueueNumber(preorder.queueNumber)} ·{' '}
                              {wholesaleQueueStatusLabels[preorder.status]}
                            </span>
                          </div>
                          <small>
                            {position > 0 ? `Posição ${position}` : 'Finalizada'}
                          </small>
                        </div>
                        <div className="admin-customer-lines">
                          <span>
                            <PackageCheck size={15} />
                            {preorder.requestedQuantity} un. · {preorder.productWeight} ·{' '}
                            {formatCurrency(preorder.unitPrice)} atacado
                          </span>
                          <span>
                            <CalendarClock size={15} />
                            Criada em {formatDate(preorder.createdAt)}
                          </span>
                        </div>
                        {isWholesaleQueueActive(preorder) && (
                          <button
                            className="secondary-button danger"
                            type="button"
                            onClick={() =>
                              updateWholesalePreorderStatus(preorder.id, 'cancelada')
                            }
                          >
                            <XCircle size={16} />
                            Cancelar encomenda
                          </button>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          <section className="table-panel">
            <h2>Minhas assinaturas</h2>
            {userSubscriptions.length === 0 ? (
              <div className="empty-state compact">
                <h2>Nenhuma assinatura ativa ainda.</h2>
              </div>
            ) : (
              <div className="customer-order-list">
                {userSubscriptions.map((subscription) => {
                  const paymentOrder = subscriptionOrderById.get(subscription.id)

                  return (
                  <article className="customer-order-card subscription-account-card" key={subscription.id}>
                    <div>
                      <strong>{subscription.planName}</strong>
                      <span>
                        {subscriptionStatusLabels[subscription.status]} ·{' '}
                        {formatCurrency(subscription.price)} · {subscription.cadence}
                      </span>
                    </div>
                    <div className="subscription-card-meta">
                      <span>
                        <CalendarClock size={16} />
                        Próxima entrega: {formatDate(subscription.nextDeliveryAt)}
                      </span>
                      {subscription.status === 'aguardando_pagamento' && (
                        <span>
                          <CalendarClock size={16} />
                          Pagamento pendente
                          {paymentOrder ? ` no pedido ${paymentOrder.id}` : ''}
                        </span>
                      )}
                      <span>
                        <MapPin size={16} />
                        {subscription.deliveryAddress}
                      </span>
                    </div>
                    <div className="subscription-actions">
                      {subscription.status === 'ativa' && (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => updateSubscriptionStatus(subscription.id, 'pausada')}
                        >
                          <PauseCircle size={16} />
                          Pausar
                        </button>
                      )}
                      {subscription.status === 'pausada' && (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => updateSubscriptionStatus(subscription.id, 'ativa')}
                        >
                          <PlayCircle size={16} />
                          Reativar
                        </button>
                      )}
                      {subscription.status !== 'cancelada' && (
                        <button
                          className="secondary-button danger"
                          type="button"
                          onClick={() => updateSubscriptionStatus(subscription.id, 'cancelada')}
                        >
                          <XCircle size={16} />
                          Cancelar
                        </button>
                      )}
                    </div>
                  </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="table-panel">
            <h2>Pedidos recentes</h2>
            {userOrders.length === 0 ? (
              <div className="empty-state compact">
                <h2>Nenhum pedido registrado ainda.</h2>
              </div>
            ) : (
              <div className="customer-order-list">
                {userOrders.map((order) => {
                  const currentIndex = getOrderTrackingIndex(order.status)

                  return (
                    <article className="customer-order-card" key={order.id}>
                      <div>
                        <strong>{order.id}</strong>
                        <span>
                          {formatDate(order.createdAt)} · {orderStatusLabels[order.status]} ·{' '}
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
                      <div
                        className={`order-tracker ${
                          order.status === 'cancelado' ? 'cancelled' : ''
                        }`}
                      >
                        {orderTrackingSteps.map((step, index) => {
                          const isDone =
                            order.status !== 'cancelado' &&
                            currentIndex >= index &&
                            currentIndex >= 0
                          const isCurrent = order.status === step.status

                          return (
                            <span
                              className={`order-tracker-step ${
                                isDone ? 'done' : ''
                              } ${isCurrent ? 'current' : ''}`}
                              key={step.status}
                            >
                              <i />
                              {step.label}
                            </span>
                          )
                        })}
                        {order.status === 'cancelado' && (
                          <span className="order-tracker-step danger current">
                            <i />
                            Cancelado
                          </span>
                        )}
                      </div>
                      <div className="customer-order-meta">
                        {order.deliveryAddress && (
                          <span>
                            <MapPin size={15} />
                            {order.deliveryAddress}
                          </span>
                        )}
                        {order.status === 'aguardando_pagamento' && (
                          <span>
                            <CalendarClock size={15} />
                            Pagamento expira em{' '}
                            {now ? formatPaymentRemaining(order, now) : 'calculando'}
                          </span>
                        )}
                        {order.status === 'cancelado' && (
                          <span>
                            <XCircle size={15} />
                            Pedido cancelado. Faça uma nova compra quando quiser.
                          </span>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="table-panel">
            <h2>Planos disponíveis</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {subscriptionPlans.map((plan) => {
                const existingSubscription = user
                  ? customerSubscriptions.find(
                      (subscription) =>
                        subscription.customerId === user.id &&
                        subscription.planId === plan.id &&
                        subscription.status !== 'cancelada',
                    )
                  : undefined
                const canSubscribe = Boolean(
                  user &&
                    canSubscribeToPlan({
                      subscriptions: customerSubscriptions,
                      planId: plan.id,
                      userId: user.id,
                    }),
                )
                const actionLabel = existingSubscription
                  ? existingSubscription.status === 'aguardando_pagamento'
                    ? 'Aguardando pagamento'
                    : 'Já ativo'
                  : 'Assinar'

                return (
                  <article className="mini-plan" key={plan.id}>
                    <strong>{plan.name}</strong>
                    <span>{formatCurrency(plan.price)}</span>
                    <p>{plan.description}</p>
                    <button
                      className="secondary-button plan-action-button"
                      type="button"
                      disabled={!canSubscribe}
                      onClick={() => subscribeToPlan(plan.id)}
                    >
                      {canSubscribe ? 'Assinar' : actionLabel}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
