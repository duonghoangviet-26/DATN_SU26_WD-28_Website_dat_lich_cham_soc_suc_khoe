const allowedTags = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'FIGCAPTION', 'FIGURE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'LI', 'OL', 'P',
  'PRE', 'S', 'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR',
  'U', 'UL',
])

const allowedAttributes = new Set([
  'alt', 'class', 'colspan', 'height', 'href', 'loading', 'rel', 'rowspan', 'src',
  'target', 'title', 'width',
])

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function isSafeUrl(value: string) {
  const normalized = Array.from(value.trim())
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code > 31 && code !== 127 && !/\s/.test(character)
    })
    .join('')
    .toLowerCase()
  return normalized === '' || normalized.startsWith('/') || normalized.startsWith('#') || /^(https?:|mailto:|tel:)/.test(normalized)
}

export function sanitizeHtml(input: string) {
  if (!input) return ''
  if (typeof DOMParser === 'undefined') return escapeHtml(input)

  const document = new DOMParser().parseFromString(`<div>${input}</div>`, 'text/html')
  const root = document.body.firstElementChild
  if (!root) return ''

  Array.from(root.querySelectorAll('*')).forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (!allowedAttributes.has(name) || name.startsWith('on')) {
        element.removeAttribute(attribute.name)
      }
    })

    for (const attributeName of ['href', 'src']) {
      const value = element.getAttribute(attributeName)
      if (value !== null && !isSafeUrl(value)) element.removeAttribute(attributeName)
    }

    if (element.tagName === 'A' && element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer')
    }
    if (element.tagName === 'IMG') element.setAttribute('loading', 'lazy')
  })

  return root.innerHTML
}
