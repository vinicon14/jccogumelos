import type { BlogMedia, MediaType } from '../types'
import { MediaPreview } from './MediaPreview'

interface BlogMediaGalleryProps {
  media?: BlogMedia[]
  fallback?: {
    src: string
    mediaType?: MediaType
    alt: string
  }
  title: string
  compact?: boolean
}

export function BlogMediaGallery({
  media,
  fallback,
  title,
  compact = false,
}: BlogMediaGalleryProps) {
  const resolvedMedia =
    media && media.length > 0
      ? media
      : fallback?.src
        ? [
            {
              id: 'cover',
              url: fallback.src,
              mediaType: fallback.mediaType ?? 'image',
              alt: fallback.alt,
            },
          ]
        : []

  if (!resolvedMedia.length) {
    return null
  }

  return (
    <div
      className={`blog-media-gallery ${compact ? 'compact' : ''} ${
        resolvedMedia.length > 1 ? 'multi' : 'single'
      }`}
    >
      {resolvedMedia.map((item, index) => (
        <MediaPreview
          className="blog-media-item"
          controls={item.mediaType === 'video'}
          key={item.id || `${item.url}-${index}`}
          src={item.url}
          alt={item.alt || `${title} - mídia ${index + 1}`}
          mediaType={item.mediaType}
        />
      ))}
      {resolvedMedia.length > 1 && (
        <span className="blog-media-count">{resolvedMedia.length} mídias</span>
      )}
    </div>
  )
}
