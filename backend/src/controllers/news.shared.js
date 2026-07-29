import mongoose from 'mongoose'
import { TinTuc } from '../models/index.js'

const NEWS_STATUSES = ['draft', 'published', 'hidden']

export function isValidNewsId(id) {
  return id && mongoose.Types.ObjectId.isValid(id)
}

export function toSlug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function stripTags(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeContent(html = '') {
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\son\w+=\S+/gi, '')
    .replace(/(href|src)=["']\s*javascript:[^"']*["']/gi, '$1="#"')
}

export function normalizeNewsPayload(body = {}, { partial = false } = {}) {
  const payload = {}

  if (!partial || body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) throw new Error('Vui lòng nhập tiêu đề')
    if (title.length > 200) throw new Error('Tiêu đề không vượt quá 200 ký tự')
    payload.title = title
  }

  if (!partial || body.slug !== undefined) {
    const shortTitle = typeof body.slug === 'string' ? body.slug.trim() : ''
    if (!shortTitle) throw new Error('Vui lòng nhập tiêu đề ngắn')
    payload.slug = shortTitle
  }

  if (!partial || body.image !== undefined) {
    const image = typeof body.image === 'string' ? body.image.trim() : ''
    if (!image) throw new Error('Vui lòng nhập ảnh đại diện')
    if (image.length > 1000) throw new Error('URL ảnh không vượt quá 1000 ký tự')
    payload.image = image
  }

  if (!partial || body.content !== undefined) {
    const content = sanitizeContent(body.content || '').trim()
    if (!stripTags(content)) throw new Error('Vui lòng nhập nội dung tin tức')
    payload.content = content
  }

  if (!partial || body.author_name !== undefined) {
    const authorName = typeof body.author_name === 'string' ? body.author_name.trim() : ''
    if (!authorName) throw new Error('Vui lòng nhập tác giả')
    if (authorName.length > 255) throw new Error('Tác giả không vượt quá 255 ký tự')
    payload.author_name = authorName
  }

  if (body.status !== undefined) {
    if (!NEWS_STATUSES.includes(body.status)) throw new Error('Trạng thái tin tức không hợp lệ')
    payload.status = body.status
  } else if (!partial) {
    payload.status = 'published'
  }

  return payload
}

export function formatNews(news) {
  const plain = typeof news.toObject === 'function' ? news.toObject() : news
  const authorName = plain.author_name || plain.author_id?.ho_ten || 'VitaFamily'
  const excerpt = stripTags(plain.content).slice(0, 180)

  return {
    id: String(plain._id),
    _id: plain._id,
    title: plain.title,
    slug: plain.slug,
    url_slug: plain.url_slug ?? null,
    image: plain.image,
    content: plain.content,
    excerpt,
    status: plain.status,
    author_id: plain.author_id?._id ?? plain.author_id ?? null,
    author_name: authorName,
    view_count: plain.view_count ?? 0,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
    tieu_de: plain.title,
    noi_dung_ngan: excerpt,
    noi_dung: plain.content,
    anh_dai_dien: plain.image,
    nguoi_viet: authorName,
    luot_xem: plain.view_count ?? 0,
    ngay_tao: plain.created_at,
  }
}

export async function makeAvailableUrlSlug(source, { excludeId = null } = {}) {
  const baseSlug = toSlug(source) || 'tin-tuc'
  let nextSlug = baseSlug
  let suffix = 2

  while (true) {
    const query = { url_slug: nextSlug }
    if (excludeId && isValidNewsId(excludeId)) {
      query._id = { $ne: excludeId }
    }

    const existed = await TinTuc.exists(query)
    if (!existed) return nextSlug

    const suffixText = `-${suffix}`
    const trimmedBase = baseSlug.slice(0, 220 - suffixText.length).replace(/-+$/g, '')
    nextSlug = `${trimmedBase}${suffixText}`
    suffix += 1
  }
}

export async function findNewsForAdmin(id) {
  if (!isValidNewsId(id)) return null
  return TinTuc.findById(id).populate('author_id', 'ho_ten email')
}
