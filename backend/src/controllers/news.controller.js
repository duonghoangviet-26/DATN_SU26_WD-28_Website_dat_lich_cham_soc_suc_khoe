import { TinTuc } from '../models/index.js'
import { ok, fail } from '../utils/response.js'
import { formatNews, isValidNewsId } from './news.shared.js'

export async function list(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 9))
    const keyword = String(req.query.keyword || '').trim()

    const filter = { status: 'published' }
    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ title: regex }, { slug: regex }, { author_name: regex }, { url_slug: regex }, { content: regex }]
    }

    const [items, total] = await Promise.all([
      TinTuc.find(filter)
        .populate('author_id', 'ho_ten email')
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TinTuc.countDocuments(filter),
    ])

    return ok(res, {
      items: items.map(formatNews),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }, 'Lấy danh sách tin tức thành công')
  } catch (error) {
    return fail(res, 500, 'Không thể tải danh sách tin tức: ' + error.message)
  }
}

export async function detail(req, res) {
  try {
    const identifier = String(req.params.slug || '').trim()
    const filter = isValidNewsId(identifier)
      ? { _id: identifier, status: 'published' }
      : { url_slug: identifier.toLowerCase(), status: 'published' }
    const news = await TinTuc.findOneAndUpdate(
      filter,
      { $inc: { view_count: 1 } },
      { new: true }
    ).populate('author_id', 'ho_ten email')

    if (!news) return fail(res, 404, 'Không tìm thấy tin tức')

    const related = await TinTuc.find({
      _id: { $ne: news._id },
      status: 'published',
    })
      .populate('author_id', 'ho_ten email')
      .sort({ created_at: -1 })
      .limit(3)
      .lean()

    return ok(res, {
      article: formatNews(news),
      related: related.map(formatNews),
    }, 'Lấy chi tiết tin tức thành công')
  } catch (error) {
    return fail(res, 500, 'Không thể tải chi tiết tin tức: ' + error.message)
  }
}
