import { describe, expect, it } from 'vitest'

import { parseMarkdownToHTML } from '@/utils/markdownParser'
import { isSafeUrl, sanitizeHtml } from '@/utils/sanitizeHtml'

describe('HTML safety helpers', () => {
  it('fails closed when a DOM parser is unavailable', () => {
    const result = sanitizeHtml('<img src=x onerror="alert(1)"><script>alert(1)</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('<img')
  })

  it('rejects executable and obfuscated URL protocols', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('java\nscript:alert(1)')).toBe(false)
    expect(isSafeUrl('https://vitafamily.vn/tin-tuc')).toBe(true)
    expect(isSafeUrl('/booking')).toBe(true)
  })

  it('escapes raw HTML before applying supported Markdown', () => {
    const result = parseMarkdownToHTML('<img src=x onerror=alert(1)> **An toàn** [x](javascript:alert(1))')
    expect(result).toContain('&lt;img')
    expect(result).toContain('<strong')
    expect(result).not.toContain('href="javascript:')
  })
})
