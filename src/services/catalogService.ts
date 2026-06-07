import { products } from '../data/mockData'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'

export async function loadProducts(): Promise<Product[]> {
  if (!supabase) {
    return products
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error || !data?.length) {
    return products
  }

  return data.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    benefits: item.benefits ?? [],
    weight: item.weight,
    price: Number(item.price),
    wholesalePrice: item.wholesale_price
      ? Number(item.wholesale_price)
      : undefined,
    stock: Number(item.stock ?? 0),
    rating: Number(item.rating ?? 4.8),
    reviews: Number(item.reviews ?? 0),
    nutrition: item.nutrition ?? '',
    image: item.image_url,
    tags: item.tags ?? [],
    bestSeller: Boolean(item.best_seller),
    isNew: Boolean(item.is_new),
  }))
}
