import type { MediaType } from '../types'
import { inferMediaType } from '../utils/media'

interface MediaPreviewProps {
  src: string
  alt: string
  mediaType?: MediaType
  className?: string
  autoPlay?: boolean
  controls?: boolean
}

export function MediaPreview({
  src,
  alt,
  mediaType,
  className = '',
  autoPlay = false,
  controls = false,
}: MediaPreviewProps) {
  const resolvedType = inferMediaType(src, mediaType)

  if (resolvedType === 'video') {
    return (
      <video
        aria-label={alt}
        autoPlay={autoPlay}
        className={className}
        controls={controls}
        loop={autoPlay}
        muted
        playsInline
        preload="metadata"
        src={src}
      />
    )
  }

  return <img className={className} src={src} alt={alt} />
}
