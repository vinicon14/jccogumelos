import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import {
  Camera,
  Menu,
  MessageCircle,
  LogOut,
  ShoppingBag,
  Sprout,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { AssistantWidget } from './components/AssistantWidget'
import { BrandMark } from './components/BrandMark'
import { contact } from './config/contact'
import { useAuth } from './context/useAuth'
import { useCart } from './context/useCart'
import { AccountPage } from './pages/AccountPage'
import { AdminPage } from './pages/AdminPage'
import { BlogPage } from './pages/BlogPage'
import { CartPage } from './pages/CartPage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { HomePage } from './pages/HomePage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

const navItems = [
  { to: '/loja', label: 'Início' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/assinaturas', label: 'Assinaturas' },
  { to: '/blog-jozaninha', label: 'Blog Jozaninha' },
  { to: '/conta', label: 'Minha conta' },
]

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/loja" replace />
  }

  return children
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { itemCount } = useCart()
  const { user, isAdmin, logout } = useAuth()
  const location = useLocation()
  const publicPage =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/cadastro'
  const visibleNavItems = isAdmin
    ? [...navItems, { to: '/admin', label: 'Admin' }]
    : navItems

  useEffect(() => {
    document.title = 'JC Cogumelos'
  }, [])

  return (
    <div className="min-h-screen bg-[#f8f1e7] text-[#2d2018]">
      {!publicPage && (
      <header className="sticky top-0 z-40 border-b border-[#eadcc8] bg-[#fffaf2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <BrandMark compact />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-[8px] px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[#e7c5a4] text-[#3a2417]'
                      : 'text-[#5f4a38] hover:bg-[#f0e1cf]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {contact.whatsAppUrl ? (
              <a
                className="hidden items-center gap-2 rounded-[8px] bg-[#28513c] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1f3f2f] sm:inline-flex"
                href={contact.whatsAppUrl}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={17} />
                WhatsApp
              </a>
            ) : (
              <a
                className="hidden items-center gap-2 rounded-[8px] bg-[#28513c] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1f3f2f] sm:inline-flex"
                href={contact.instagramUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Camera size={17} />
                Instagram
              </a>
            )}
            {user && (
              <button
                className="hidden h-10 items-center gap-2 rounded-[8px] border border-[#eadcc8] bg-white px-3 text-sm font-bold text-[#3b2a1d] transition hover:border-[#c96d38] sm:inline-flex"
                type="button"
                onClick={logout}
              >
                <LogOut size={17} />
                Sair
              </button>
            )}
            <Link
              to="/carrinho"
              className="relative grid h-10 w-10 place-items-center rounded-[8px] border border-[#eadcc8] bg-white text-[#3b2a1d] transition hover:border-[#c96d38]"
              aria-label="Abrir carrinho"
            >
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#c95324] px-1 text-xs font-black text-white">
                  {itemCount}
                </span>
              )}
            </Link>
            <button
              className="grid h-10 w-10 place-items-center rounded-[8px] border border-[#eadcc8] bg-white text-[#3b2a1d] lg:hidden"
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Abrir menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-[#eadcc8] bg-[#fffaf2] px-4 py-3 lg:hidden">
            <div className="mx-auto grid max-w-7xl gap-1">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-[8px] px-3 py-3 text-sm font-semibold ${
                      isActive
                        ? 'bg-[#e7c5a4] text-[#3a2417]'
                        : 'text-[#5f4a38]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              {user && (
                <button
                  className="rounded-[8px] px-3 py-3 text-left text-sm font-semibold text-[#5f4a38]"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                  }}
                >
                  Sair
                </button>
              )}
            </div>
          </nav>
        )}
      </header>
      )}

      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/loja" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/catalogo" element={<ProtectedRoute><CatalogPage /></ProtectedRoute>} />
          <Route path="/assinaturas" element={<ProtectedRoute><HomePage focus="assinaturas" /></ProtectedRoute>} />
          <Route path="/blog-jozaninha" element={<ProtectedRoute><BlogPage /></ProtectedRoute>} />
          <Route path="/carrinho" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
          <Route path="/conta" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!publicPage && (
      <footer className="border-t border-[#eadcc8] bg-[#2d2018] px-4 py-10 text-[#f8f1e7] sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-lg font-black">
              <Sprout size={22} />
              JC Cogumelos
            </div>
            <p className="max-w-md text-sm leading-6 text-[#d9c6ad]">
              Cogumelos gourmet frescos, kits recorrentes e atendimento inteligente
              com a Jozaninha para varejo, chefs, mercados e restaurantes.
            </p>
          </div>
          <div>
            <strong className="mb-3 block text-sm uppercase tracking-wider text-[#f0b27a]">
              Canais
            </strong>
            <div className="grid gap-2 text-sm text-[#d9c6ad]">
              {contact.whatsAppUrl && <span>WhatsApp oficial</span>}
              <a href={contact.instagramUrl} target="_blank" rel="noreferrer">
                Instagram: {contact.instagramHandle}
              </a>
              {contact.contactEmail && <span>E-mail: {contact.contactEmail}</span>}
            </div>
          </div>
          <div>
            <strong className="mb-3 block text-sm uppercase tracking-wider text-[#f0b27a]">
              Atalhos
            </strong>
            <div className="flex flex-wrap gap-2">
              <Link className="footer-pill" to="/conta">
                <UserRound size={15} />
                Minha conta
              </Link>
              <Link className="footer-pill" to="/blog-jozaninha">
                <Sprout size={15} />
                Blog Jozaninha
              </Link>
            </div>
          </div>
        </div>
      </footer>
      )}

      {!publicPage && <AssistantWidget />}
    </div>
  )
}

export default App
