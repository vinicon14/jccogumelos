import { BookOpenText } from 'lucide-react'
import { BlogMediaGallery } from '../components/BlogMediaGallery'
import { useStore } from '../context/useStore'

export function BlogPage() {
  const { blogPosts } = useStore()
  const publishedPosts = blogPosts.filter((post) => post.published)

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Blog Josaninha</p>
        <h1>Receitas e novidades</h1>
        <p>
          Conteúdos curtos publicados no painel administrativo.
        </p>
      </div>

      {publishedPosts.length > 0 ? (
        <div className="blog-grid full">
          {publishedPosts.map((post) => (
            <article className="blog-card large" key={post.id}>
              <BlogMediaGallery
                media={post.media}
                fallback={{ src: post.image, mediaType: post.mediaType, alt: post.title }}
                title={post.title}
              />
              <div>
                <BookOpenText size={22} />
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
                <div className="blog-content">{post.content}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>O Blog Josaninha ainda não tem posts publicados.</h2>
        </div>
      )}
    </section>
  )
}
