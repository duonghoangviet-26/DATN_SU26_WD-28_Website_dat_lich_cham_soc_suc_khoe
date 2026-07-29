import { TinTuc, NhatKyThaoTac } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'
import {
  findNewsForAdmin,
  formatNews,
  isValidNewsId,
  makeAvailableUrlSlug,
  normalizeNewsPayload,
} from '../news.shared.js'

async function writeNewsLog(req, action, newsId, before = null, after = null, note = null) {
  try {
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user?.id ?? null,
      vai_tro: req.user?.role ?? 'system',
      hanh_dong: action,
      loai_doi_tuong: 'news',
      doi_tuong_id: newsId,
      du_lieu_cu: before,
      du_lieu_moi: after,
      ly_do: note,
    })
  } catch (_) {
    // Audit log không được chặn luồng quản lý tin tức.
  }
}

export async function list(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const keyword = String(req.query.keyword || '').trim()
    const status = String(req.query.status || '').trim()

    const filter = {}
    if (['draft', 'published', 'hidden'].includes(status)) filter.status = status
    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ title: regex }, { slug: regex }, { author_name: regex }, { url_slug: regex }, { content: regex }]
    }

    const [items, total, published, draft, hidden] = await Promise.all([
      TinTuc.find(filter)
        .populate('author_id', 'ho_ten email')
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TinTuc.countDocuments(filter),
      TinTuc.countDocuments({ status: 'published' }),
      TinTuc.countDocuments({ status: 'draft' }),
      TinTuc.countDocuments({ status: 'hidden' }),
    ])

    return ok(res, {
      items: items.map(formatNews),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      statistics: {
        total: published + draft + hidden,
        published,
        draft,
        hidden,
      },
    }, 'Lấy danh sách tin tức thành công')
  } catch (error) {
    return fail(res, 500, 'Không thể tải danh sách tin tức: ' + error.message)
  }
}

export async function listForReceptionist(req, res) {
  try {
    if (!isValidNewsId(req.user?.id)) {
      return fail(res, 401, 'Không xác định được tài khoản lễ tân')
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const keyword = String(req.query.keyword || '').trim()
    const status = String(req.query.status || '').trim()

    const filter = { author_id: req.user.id }
    if (['draft', 'published', 'hidden'].includes(status)) filter.status = status
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
    }, 'Lấy danh sách tin tức đã thêm thành công')
  } catch (error) {
    return fail(res, 500, 'Không thể tải danh sách tin tức đã thêm: ' + error.message)
  }
}

export async function detailForReceptionist(req, res) {
  try {
    if (!isValidNewsId(req.user?.id)) {
      return fail(res, 401, 'Không xác định được tài khoản lễ tân')
    }

    if (!isValidNewsId(req.params.id)) {
      return fail(res, 400, 'Mã tin tức không hợp lệ')
    }

    const news = await TinTuc.findOne({ _id: req.params.id, author_id: req.user.id })
      .populate('author_id', 'ho_ten email')

    if (!news) return fail(res, 404, 'Không tìm thấy tin tức đã thêm')
    return ok(res, formatNews(news), 'Lấy chi tiết tin tức đã thêm thành công')
  } catch (error) {
    return fail(res, 500, 'Không thể tải chi tiết tin tức đã thêm: ' + error.message)
  }
}

export async function detail(req, res) {
  try {
    const news = await findNewsForAdmin(req.params.id)
    if (!news) return fail(res, 404, 'Không tìm thấy tin tức')
    return ok(res, formatNews(news), 'Lấy chi tiết tin tức thành công')
  } catch (error) {
    return fail(res, 500, 'Không thể tải chi tiết tin tức: ' + error.message)
  }
}

export async function create(req, res) {
  try {
    const payload = normalizeNewsPayload(req.body)
    payload.url_slug = await makeAvailableUrlSlug(payload.title)
    const news = await TinTuc.create({
      ...payload,
      author_id: isValidNewsId(req.user?.id) ? req.user.id : null,
    })

    const populated = await findNewsForAdmin(news._id)
    await writeNewsLog(req, 'CREATE_NEWS', news._id, null, formatNews(populated), `Tạo tin tức "${news.title}"`)

    return created(res, formatNews(populated), 'Tạo tin tức thành công')
  } catch (error) {
    const status = error.code === 11000 ? 409 : 400
    return fail(res, status, error.code === 11000 ? 'Đường dẫn hệ thống của tin tức đã tồn tại' : error.message)
  }
}

export async function updateForReceptionist(req, res) {
  try {
    if (!isValidNewsId(req.user?.id)) {
      return fail(res, 401, 'Không xác định được tài khoản lễ tân')
    }

    if (!isValidNewsId(req.params.id)) {
      return fail(res, 400, 'Mã tin tức không hợp lệ')
    }

    const news = await TinTuc.findOne({ _id: req.params.id, author_id: req.user.id })
      .populate('author_id', 'ho_ten email')

    if (!news) return fail(res, 404, 'Không tìm thấy tin tức đã thêm')

    const before = formatNews(news)
    const payload = normalizeNewsPayload(req.body, { partial: true })
    if (!news.url_slug) {
      payload.url_slug = await makeAvailableUrlSlug(payload.title || news.title, { excludeId: news._id })
    }

    Object.assign(news, payload)
    await news.save()

    const populated = await findNewsForAdmin(news._id)
    const after = formatNews(populated)
    await writeNewsLog(req, 'UPDATE_NEWS', news._id, before, after, `Lễ tân cập nhật tin tức "${news.title}"`)

    return ok(res, after, 'Cập nhật tin tức thành công')
  } catch (error) {
    const status = error.code === 11000 ? 409 : 400
    return fail(res, status, error.code === 11000 ? 'Đường dẫn hệ thống của tin tức đã tồn tại' : error.message)
  }
}

export async function update(req, res) {
  try {
    const news = await findNewsForAdmin(req.params.id)
    if (!news) return fail(res, 404, 'Không tìm thấy tin tức')

    const before = formatNews(news)
    const payload = normalizeNewsPayload(req.body, { partial: true })
    if (!news.url_slug) {
      payload.url_slug = await makeAvailableUrlSlug(payload.title || news.title, { excludeId: news._id })
    }
    Object.assign(news, payload)
    await news.save()

    const populated = await findNewsForAdmin(news._id)
    const after = formatNews(populated)
    await writeNewsLog(req, 'UPDATE_NEWS', news._id, before, after, `Cập nhật tin tức "${news.title}"`)

    return ok(res, after, 'Cập nhật tin tức thành công')
  } catch (error) {
    const status = error.code === 11000 ? 409 : 400
    return fail(res, status, error.code === 11000 ? 'Đường dẫn hệ thống của tin tức đã tồn tại' : error.message)
  }
}

export async function toggle(req, res) {
  try {
    const news = await findNewsForAdmin(req.params.id)
    if (!news) return fail(res, 404, 'Không tìm thấy tin tức')

    const before = formatNews(news)
    news.status = news.status === 'published' ? 'hidden' : 'published'
    await news.save()

    const populated = await findNewsForAdmin(news._id)
    const after = formatNews(populated)
    await writeNewsLog(
      req,
      news.status === 'published' ? 'PUBLISH_NEWS' : 'HIDE_NEWS',
      news._id,
      before,
      after,
      `${news.status === 'published' ? 'Hiển thị' : 'Ẩn'} tin tức "${news.title}"`
    )

    return ok(res, after, news.status === 'published' ? 'Đã hiển thị tin tức' : 'Đã ẩn tin tức')
  } catch (error) {
    return fail(res, 500, 'Không thể đổi trạng thái tin tức: ' + error.message)
  }
}

export async function remove(req, res) {
  try {
    const news = await findNewsForAdmin(req.params.id)
    if (!news) return fail(res, 404, 'Không tìm thấy tin tức')

    const before = formatNews(news)
    await TinTuc.findByIdAndDelete(news._id)
    await writeNewsLog(req, 'DELETE_NEWS', news._id, before, null, `Xóa tin tức "${news.title}"`)

    return ok(res, { id: req.params.id }, 'Xóa tin tức thành công')
  } catch (error) {
    return fail(res, 500, 'Không thể xóa tin tức: ' + error.message)
  }
}
