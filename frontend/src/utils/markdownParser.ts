import { escapeHtml, isSafeUrl } from '@/utils/sanitizeHtml'

export const parseMarkdownToHTML = (markdown: string): string => {
  if (!markdown) return ''

  let html = escapeHtml(markdown)

  html = html.replace(/^### (.*$)/gim, '<h3 class="mb-1 mt-2 text-sm font-bold">$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2 class="mb-1 mt-3 text-base font-bold">$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1 class="mb-2 mt-3 text-lg font-bold">$1</h1>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-teal-800">$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, (_match, label: string, url: string) => {
    if (!isSafeUrl(url)) return label
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="font-medium text-teal-700 hover:underline">${label}</a>`
  })
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc marker:text-teal-600">$1</li>')
  html = html.replace(/(<li.*?>.*?<\/li>\n?)+/g, '<ul class="my-1 space-y-1">$&</ul>')

  return html
    .split(/\n\n+/)
    .map((block) => {
      if (/^<(h|ul|li)/i.test(block.trim())) return block.trim()
      return `<p class="mb-1">${block.trim().replace(/\n/g, '<br />')}</p>`
    })
    .join('')
}
