import { supabase } from '../lib/supabase'
import type { BlogPost } from '../types'

function toDb(post: BlogPost) {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    image_url: post.image || null,
    media_type: post.mediaType || 'image',
    media: JSON.stringify(post.media || []),
    source: post.source || 'manual',
    source_id: post.sourceId || null,
    source_url: post.sourceUrl || null,
    published: post.published,
    created_at: post.createdAt,
    updated_at: new Date().toISOString(),
  }
}

function fromDb(row: any): BlogPost {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt || '',
    content: row.content || '',
    image: row.image_url || '',
    mediaType: row.media_type || 'image',
    media: typeof row.media === 'string' ? JSON.parse(row.media) : (row.media || []),
    published: row.published || false,
    createdAt: row.created_at,
    source: row.source || 'manual',
    sourceId: row.source_id || undefined,
    sourceUrl: row.source_url || undefined,
  }
}

export async function loadBlogPostsFromDb(): Promise<BlogPost[] | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return null
  if (!data || data.length === 0) return null

  return data.map(fromDb)
}

export async function saveBlogPostToDb(post: BlogPost) {
  if (!supabase) return

  const db = toDb(post)

  const { error } = await supabase.from('blog_posts').upsert(db, {
    onConflict: 'id',
  })

  if (error) {
    console.warn('Erro ao salvar post no database:', error.message)
  }
}

export async function deleteBlogPostFromDb(id: string) {
  if (!supabase) return

  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', id)

  if (error) {
    console.warn('Erro ao deletar post do database:', error.message)
  }
}

export async function syncAllBlogPostsToDb(posts: BlogPost[]) {
  if (!supabase || posts.length === 0) return

  const dbPosts = posts.map(toDb)

  const { error } = await supabase.from('blog_posts').upsert(dbPosts, {
    onConflict: 'id',
  })

  if (error) {
    console.warn('Erro ao sincronizar posts no database:', error.message)
  }
}
