import { BookOpenText } from 'lucide-react'
import { MediaPreview } from '../components/MediaPreview'
import { useStore } from '../context/useStore'

export function BlogPage() {
  const { blogPosts } = useStore()
  const publishedPosts = blogPosts.filter((post) => post.published)

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Blog Jozaninha</p>
        <h1>Receitas e novidades</h1>
        <p>
          Conteúdos curtos publicados no painel administrativo.
        </p>
      </div>

      {publishedPosts.length > 0 ? (
        <div className="blog-grid full">
          {publishedPosts.map((post) => (
            <article className="blog-card large" key={post.id}>
              {post.image && (
                <MediaPreview
                  src={post.image}
                  alt={post.title}
                  mediaType={post.mediaType}
                  controls={post.mediaType === 'video'}
                />
              )}
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
          <h2>O Blog Jozaninha ainda não tem posts publicados.</h2>
        </div>
      )}
    </section>
  )
}
