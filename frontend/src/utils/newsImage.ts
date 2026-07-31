import { resolveMediaUrl } from '@/utils/media'

type NewsImageSize = {
  width: number
  height: number
}

function getResolvedNewsImage(image?: string | null) {
  return resolveMediaUrl(image) || ''
}

function canTransformWithCloudinary(url: string) {
  if (!url || /^(data:|blob:)/i.test(url)) return false

  try {
    const parsed = new URL(url)
    return parsed.hostname.includes('cloudinary.com') && parsed.pathname.includes('/upload/')
  } catch {
    return false
  }
}

function buildCloudinaryTransform({ width, height }: NewsImageSize) {
  return `f_auto,q_auto:good,c_fill,g_auto,w_${width},h_${height}`
}

export function getNewsImageUrl(image: string | null | undefined, size: NewsImageSize) {
  const url = getResolvedNewsImage(image)
  if (!canTransformWithCloudinary(url)) return url

  return url.replace('/upload/', `/upload/${buildCloudinaryTransform(size)}/`)
}

export function getNewsImageSrcSet(image: string | null | undefined, sizes: NewsImageSize[]) {
  const url = getResolvedNewsImage(image)
  if (!canTransformWithCloudinary(url)) return undefined

  return sizes
    .map((size) => `${getNewsImageUrl(url, size)} ${size.width}w`)
    .join(', ')
}

export function optimizeNewsContentImages(html: string) {
  if (!html || typeof DOMParser === 'undefined') return html

  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = document.body.firstElementChild
  if (!root) return html

  root.querySelectorAll('img[src]').forEach((image) => {
    const src = image.getAttribute('src')
    if (!src) return

    image.setAttribute('src', getNewsImageUrl(src, { width: 1200, height: 675 }))
    const srcSet = getNewsImageSrcSet(src, [
      { width: 640, height: 360 },
      { width: 960, height: 540 },
      { width: 1200, height: 675 },
      { width: 1600, height: 900 },
    ])
    if (srcSet) {
      image.setAttribute('srcset', srcSet)
      image.setAttribute('sizes', '(min-width: 1024px) 760px, calc(100vw - 48px)')
    }
    image.setAttribute('loading', 'lazy')
    image.setAttribute('decoding', 'async')
  })

  return root.innerHTML
}
