/**
 * Trình biên dịch Markdown thuần (Tự build bằng Regex)
 * Hỗ trợ: Bold, Italic, Heading, List, Link, Paragraphs
 */

export const parseMarkdownToHTML = (markdown: string): string => {
  if (!markdown) return ''

  let html = markdown

  // 1. Headers (h1, h2, h3)
  html = html.replace(/^### (.*$)/gim, '<h3 className="text-sm font-bold mt-2 mb-1">$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2 className="text-base font-bold mt-3 mb-1">$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1 className="text-lg font-bold mt-3 mb-2">$1</h1>')

  // 2. Bold (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong className="font-semibold text-emerald-800">$1</strong>')

  // 3. Italic (*text*)
  html = html.replace(/\*(.*?)\*/g, '<em className="italic">$1</em>')

  // 4. Links ([text](url))
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">$1</a>')

  // 5. Unordered Lists (- item)
  // Xử lý các dòng bắt đầu bằng dấu trừ
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li className="ml-4 list-disc marker:text-emerald-500">$1</li>')
  
  // Wrap các thẻ <li> liên tiếp vào <ul>
  html = html.replace(/(<li.*?>.*?<\/li>\n?)+/g, '<ul className="my-1 space-y-1">$&</ul>')

  // 6. Line breaks (Chuyển \n thành <br /> nếu không nằm trong thẻ block)
  // Để đơn giản, ta chỉ bọc các đoạn text thuần vào <p>
  const blocks = html.split(/\n\n+/)
  html = blocks.map(block => {
    // Nếu block đã bắt đầu bằng thẻ block (h1, h2, ul, li) thì không bọc p
    if (/^<(h|ul|li)/i.test(block.trim())) {
      return block.trim()
    }
    return `<p className="mb-1">${block.trim().replace(/\n/g, '<br />')}</p>`
  }).join('')

  return html
}
