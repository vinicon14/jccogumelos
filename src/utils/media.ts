import type { MediaType } from '../types'

const maxLocalUploadSize = 4 * 1024 * 1024

export function inferMediaType(src: string, fallback: MediaType = 'image'): MediaType {
  const normalized = src.toLowerCase().split('?')[0]

  if (normalized.startsWith('data:video/') || /\.(mp4|webm|ogg|mov)$/.test(normalized)) {
    return 'video'
  }

  if (normalized.startsWith('data:image/') || /\.(avif|gif|jpeg|jpg|png|svg|webp)$/.test(normalized)) {
    return 'image'
  }

  return fallback
}

export function readMediaFile(file: File) {
  return new Promise<{ url: string; mediaType: MediaType }>((resolve, reject) => {
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image'

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      reject(new Error('Use uma imagem ou um vídeo.'))
      return
    }

    if (file.size > maxLocalUploadSize) {
      reject(
        new Error(
          'Arquivo muito grande para salvar localmente. Use imagem ou vídeo curto de até 4 MB.',
        ),
      )
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve({ url: reader.result, mediaType })
        return
      }

      reject(new Error('Não foi possível ler o arquivo.'))
    }
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}
