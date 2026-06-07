import { Filter, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ProductCard } from '../components/ProductCard'
import { categoryLabels } from '../data/mockData'
import { useStore } from '../context/useStore'
import type { ProductCategory } from '../types'

type CategoryFilter = 'todos' | ProductCategory
type SortFilter = 'destaques' | 'menor-preco' | 'maior-preco'

export function CatalogPage() {
  const { products } = useStore()
  const [category, setCategory] = useState<CategoryFilter>('todos')
  const [sort, setSort] = useState<SortFilter>('destaques')
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const [onlyBestSellers, setOnlyBestSellers] = useState(false)
  const [onlyNew, setOnlyNew] = useState(false)
  const [search, setSearch] = useState('')

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return products
      .filter((product) => category === 'todos' || product.category === category)
      .filter((product) => !onlyAvailable || product.stock > 0)
      .filter((product) => !onlyBestSellers || product.bestSeller)
      .filter((product) => !onlyNew || product.isNew)
      .filter((product) => {
        if (!normalizedSearch) {
          return true
        }

        return [product.name, product.description, ...product.tags]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)
      })
      .sort((a, b) => {
        if (sort === 'menor-preco') {
          return a.price - b.price
        }

        if (sort === 'maior-preco') {
          return b.price - a.price
        }

        return Number(Boolean(b.bestSeller)) - Number(Boolean(a.bestSeller))
      })
  }, [category, onlyAvailable, onlyBestSellers, onlyNew, products, search, sort])

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Catálogo</p>
        <h1>Cogumelos frescos, kits e assinaturas</h1>
        <p>
          Filtros preparados para categoria, preço, disponibilidade, lançamentos
          e mais vendidos.
        </p>
      </div>

      <div className="catalog-layout">
        <aside className="filter-panel">
          <div className="flex items-center gap-2 text-[#2d2018]">
            <Filter size={20} />
            <strong>Filtros</strong>
          </div>

          <label className="field-label">
            Buscar
            <span className="search-field">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Shimeji, kit, receita..."
              />
            </span>
          </label>

          <label className="field-label">
            Categoria
            <select value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}>
              <option value="todos">Todas</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Ordenar
            <select value={sort} onChange={(event) => setSort(event.target.value as SortFilter)}>
              <option value="destaques">Destaques</option>
              <option value="menor-preco">Menor preço</option>
              <option value="maior-preco">Maior preço</option>
            </select>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(event) => setOnlyAvailable(event.target.checked)}
            />
            Disponíveis em estoque
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={onlyBestSellers}
              onChange={(event) => setOnlyBestSellers(event.target.checked)}
            />
            Mais vendidos
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={onlyNew}
              onChange={(event) => setOnlyNew(event.target.checked)}
            />
            Lançamentos
          </label>
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#6f5a45]">
              {filteredProducts.length} produtos encontrados
            </p>
          </div>
          <div className="product-grid catalog-grid">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
