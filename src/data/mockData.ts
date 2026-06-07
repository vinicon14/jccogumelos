import type {
  BlogPost,
  Coupon,
  Order,
  Product,
  StoreSettings,
  SubscriptionPlan,
} from '../types'

export const products: Product[] = [
  {
    id: 'shimeji-branco-200g',
    name: 'Shimeji Branco Fresco',
    category: 'frescos',
    description:
      'Cachos claros e firmes para saltear inteiro com manteiga, shoyu, alho e cebolinha.',
    benefits: ['Textura delicada', 'Preparo rápido', 'Sabor suave'],
    weight: '200 g',
    price: 15.9,
    wholesalePrice: 12.9,
    stock: 24,
    rating: 4.9,
    reviews: 0,
    nutrition: 'Fonte de proteínas vegetais, potássio e vitaminas do complexo B.',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Shimeji%20mushroom.jpg?width=900',
    tags: ['shimeji', 'fresco', 'salteado'],
    bestSeller: true,
  },
  {
    id: 'shiitake-fresco-200g',
    name: 'Shiitake Fresco',
    category: 'frescos',
    description:
      'Chapéus carnudos, aroma intenso e sabor umami para grelhados, risotos e massas.',
    benefits: ['Umami intenso', 'Chapéu carnudo', 'Ótimo para grelhar'],
    weight: '200 g',
    price: 22.9,
    wholesalePrice: 18.5,
    stock: 18,
    rating: 4.8,
    reviews: 0,
    nutrition: 'Contem fibras, cobre, selênio e compostos bioativos naturais.',
    image:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Fresh%20shiitake%20mushrooms.jpg?width=900',
    tags: ['shiitake', 'shitaki', 'gourmet', 'fresco'],
    isNew: true,
  },
  {
    id: 'paris-fresco-250g',
    name: 'Cogumelo Paris Fresco',
    category: 'frescos',
    description:
      'Cogumelos claros e uniformes para strogonoff, pizzas, cremes, saladas e molhos.',
    benefits: ['Sabor leve', 'Uso versátil', 'Bom rendimento'],
    weight: '250 g',
    price: 14.9,
    wholesalePrice: 11.9,
    stock: 30,
    rating: 4.7,
    reviews: 0,
    nutrition: 'Boa fonte de minerais, antioxidantes e proteínas de origem vegetal.',
    image:
      'https://commons.wikimedia.org/wiki/Special:FilePath/1_-_button_mushrooms.jpg',
    tags: ['paris', 'champignon', 'fresco'],
  },
  {
    id: 'portobello-300g',
    name: 'Portobello Fresco',
    category: 'frescos',
    description:
      'Cogumelo grande e suculento, ideal para grelha, forno, hambúrguer vegetariano e recheios.',
    benefits: ['Tamanho grande', 'Textura carnuda', 'Vai bem na grelha'],
    weight: '300 g',
    price: 19.9,
    wholesalePrice: 15.9,
    stock: 16,
    rating: 4.8,
    reviews: 0,
    nutrition: 'Fonte de fibras, minerais e compostos antioxidantes.',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Portobello_mushrooms.jpg',
    tags: ['portobello', 'grelha', 'fresco'],
    bestSeller: true,
  },
  {
    id: 'eryngui-250g',
    name: 'Eryngui King Oyster',
    category: 'frescos',
    description:
      'Cogumelo de haste grossa e corte bonito, perfeito para medalhões, grelhados e pratos autorais.',
    benefits: ['Corte em medalhões', 'Textura firme', 'Visual premium'],
    weight: '250 g',
    price: 27.9,
    wholesalePrice: 22.5,
    stock: 14,
    rating: 4.8,
    reviews: 0,
    nutrition: 'Boa fonte de fibras e minerais, com baixa gordura.',
    image:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Kr%C3%A4uter-Seitling_Pleurotus_eryngii.jpg',
    tags: ['eryngui', 'king oyster', 'fresco'],
    isNew: true,
  },
  {
    id: 'enoki-150g',
    name: 'Enoki Fresco',
    category: 'frescos',
    description:
      'Hastes longas e finas para sopas, lamen, saladas mornas e finalização delicada.',
    benefits: ['Delicado', 'Ótimo para sopas', 'Textura crocante'],
    weight: '150 g',
    price: 16.9,
    wholesalePrice: 13.9,
    stock: 12,
    rating: 4.7,
    reviews: 0,
    nutrition: 'Fonte leve de fibras e micronutrientes.',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Enoki_mushroom.jpg',
    tags: ['enoki', 'lamen', 'fresco'],
  },
  {
    id: 'hiratake-250g',
    name: 'Hiratake / Cogumelo Ostra',
    category: 'frescos',
    description:
      'Lâminas macias e sabor suave para salteados, empanados, massas e recheios.',
    benefits: ['Sabor suave', 'Boa textura', 'Versátil'],
    weight: '250 g',
    price: 18.9,
    wholesalePrice: 14.9,
    stock: 20,
    rating: 4.8,
    reviews: 0,
    nutrition: 'Cogumelo comestível rico em fibras e proteínas vegetais.',
    image:
      'https://commons.wikimedia.org/wiki/Special:FilePath/1d_-_Pleurotus_ostreatus_%28oyster_mushroom%29_%289774270281%29.jpg',
    tags: ['hiratake', 'ostra', 'fresco'],
  },
  {
    id: 'kit-cogumelos-frescos-1kg',
    name: 'Kit Cogumelos Frescos 1kg',
    category: 'kits',
    description:
      'Seleção com shimeji, shiitake, Paris e hiratake para variar receitas durante a semana.',
    benefits: ['Mix variado', 'Ideal para famílias', 'Melhor custo por kg'],
    weight: '1 kg',
    price: 74.9,
    wholesalePrice: 64.9,
    stock: 10,
    rating: 5,
    reviews: 0,
    nutrition: 'Mix de cogumelos com diferentes texturas, fibras e minerais.',
    image:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Fresh%20shiitake%20mushrooms.jpg?width=900',
    tags: ['kit', 'shimeji', 'shiitake', 'hiratake'],
    bestSeller: true,
  },
]

export const categoryLabels: Record<Product['category'], string> = {
  frescos: 'Frescos',
  kits: 'Kits',
  desidratados: 'Desidratados',
  insumos: 'Insumos',
  assinaturas: 'Assinaturas',
}

export const orders: Order[] = []

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'kit-semanal',
    name: 'Kit Semanal',
    cadence: 'semanal',
    price: 44.9,
    description: 'Seleção fresca para cozinhar durante a semana.',
  },
  {
    id: 'kit-quinzenal',
    name: 'Kit Quinzenal',
    cadence: 'quinzenal',
    price: 79.9,
    description: 'Boa variedade para famílias e pequenos restaurantes.',
  },
  {
    id: 'kit-mensal',
    name: 'Kit Mensal',
    cadence: 'mensal',
    price: 149.9,
    description: 'Entrega planejada com receitas e prioridade na safra.',
  },
]

export const coupons: Coupon[] = [
]

export const blogPosts: BlogPost[] = []

export const storeSettings: StoreSettings = {
  companyName: 'JC Cogumelos',
  instagram: '@jc_cogumelos',
  facebook: '',
  whatsapp: '',
  email: '',
  shippingBase: 18.9,
  pixEnabled: true,
  creditEnabled: true,
  debitEnabled: true,
  josaninhaEnabled: true,
  whatsappAutoEnabled: true,
  assistantBehavior:
    'Atender com tom acolhedor, gourmet e objetivo. Recomendar produtos, receitas e assinaturas.',
  businessHours: '',
  paymentGateway: {
    enabled: false,
    provider: 'Banco',
    environment: 'sandbox',
    apiEndpoint: '',
    apiCode: '',
    apiSecret: '',
    merchantId: '',
    pixKey: '',
    pixReceiverName: 'JC Cogumelos',
    pixReceiverCity: 'SAO PAULO',
    pixExpirationMinutes: 5,
    webhookUrl: 'https://jccogumelos.vercel.app/api/payment-webhook',
    fallbackQrEnabled: true,
  },
}
