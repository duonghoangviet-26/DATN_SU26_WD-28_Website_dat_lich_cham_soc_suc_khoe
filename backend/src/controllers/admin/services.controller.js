import { DichVu, NhatKyThaoTac, NguoiDung } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

// ============================================================
// C4 — Quản lý dịch vụ (Admin)
// Routes: /api/admin/services
// ============================================================

// Map hanh_dong từ NhatKyThaoTac → ServiceChangeLog.hanh_dong (FE dùng)
const HANH_DONG_MAP = {
  CREATE_SERVICE: 'tao_moi',
  UPDATE_SERVICE: 'cap_nhat',
  HIDE_SERVICE:   'an',
  SHOW_SERVICE:   'hien',
}

// Helper: populate + format 1 service document → ServiceItem
async function formatService(doc) {
  const s = await DichVu.findById(doc._id ?? doc.id)
    .populate('specialty_id', 'ten')
    .lean()
  return {
    ...s,
    id:            s._id,
    specialty_ten: s.specialty_id?.ten  ?? null,
    specialty_id:  s.specialty_id?._id  ?? null,
  }
}

// Helper: lấy lịch sử thao tác của 1 dịch vụ từ NhatKyThaoTac
async function getAuditLogs(serviceId) {
  const logs = await NhatKyThaoTac.find({
    loai_doi_tuong: 'service',
    doi_tuong_id:   serviceId,
  })
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .sort({ ngay_tao: -1 })
    .lean()

  return logs.map((log) => ({
    id:             log._id,
    thoi_gian:      log.ngay_tao,
    hanh_dong:      HANH_DONG_MAP[log.hanh_dong] ?? 'cap_nhat',
    nguoi_thay_doi: log.nguoi_thuc_hien_id?.ho_ten ?? 'Hệ thống',
    mo_ta:          log.ly_do ?? undefined,
  }))
}

// ─── GET /api/admin/services?loai=&status=&search= ──────────────────────────
export async function list(req, res) {
  try {
    const { loai, status, search } = req.query

    const filter = {}
    if (loai)   filter.loai   = loai
    if (status) filter.status = status
    if (search) filter.ten    = { $regex: search, $options: 'i' }

    const services = await DichVu.find(filter)
      .populate('specialty_id', 'ten')
      .sort({ ma_dich_vu: 1 })
      .lean()

    const result = services.map((s) => ({
      ...s,
      id:            s._id,
      specialty_ten: s.specialty_id?.ten  ?? null,
      specialty_id:  s.specialty_id?._id  ?? null,
    }))

    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/admin/services/:id ────────────────────────────────────────────
export async function getById(req, res) {
  try {
    const s = await DichVu.findById(req.params.id)
      .populate('specialty_id', 'ten')
      .lean()
    if (!s) return fail(res, 404, 'Không tìm thấy dịch vụ')

    const lich_su_thay_doi = await getAuditLogs(s._id)

    return ok(res, {
      ...s,
      id:               s._id,
      specialty_ten:    s.specialty_id?.ten  ?? null,
      specialty_id:     s.specialty_id?._id  ?? null,
      lich_su_thay_doi,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/admin/services ───────────────────────────────────────────────
export async function create(req, res) {
  try {
    const {
      ten, loai, gia, mo_ta_ngan, mo_ta,
      thoi_gian_phut, gio_dat_truoc_toi_thieu,
      ngay_ap_dung, gio_bat_dau, gio_ket_thuc,
      specialty_id, khu_vuc,
    } = req.body

    if (!ten)  return fail(res, 400, 'Tên dịch vụ là bắt buộc')
    if (!loai) return fail(res, 400, 'Loại dịch vụ là bắt buộc')
    if (gia === undefined || gia === null) return fail(res, 400, 'Giá dịch vụ là bắt buộc')

    const service = await DichVu.create({
      ten, loai, gia, mo_ta_ngan, mo_ta,
      thoi_gian_phut, gio_dat_truoc_toi_thieu,
      ngay_ap_dung, gio_bat_dau, gio_ket_thuc,
      specialty_id: specialty_id || null,
      khu_vuc: loai === 'home' ? (khu_vuc ?? []) : [],
    })

    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id,
      vai_tro:            req.user.role,
      hanh_dong:          'CREATE_SERVICE',
      loai_doi_tuong:     'service',
      doi_tuong_id:       service._id,
      ly_do:              `Tạo dịch vụ "${ten}"`,
    })

    const formatted = await formatService(service)
    return created(res, formatted, 'Tạo dịch vụ thành công')
  } catch (err) {
    if (err.code === 11000) return fail(res, 409, 'Tên dịch vụ đã tồn tại trong chuyên khoa này')
    return fail(res, 500, err.message)
  }
}

// ─── PUT /api/admin/services/:id ────────────────────────────────────────────
export async function update(req, res) {
  try {
    const service = await DichVu.findById(req.params.id)
    if (!service) return fail(res, 404, 'Không tìm thấy dịch vụ')

    const fields = [
      'ten', 'loai', 'gia', 'mo_ta_ngan', 'mo_ta',
      'thoi_gian_phut', 'gio_dat_truoc_toi_thieu',
      'ngay_ap_dung', 'gio_bat_dau', 'gio_ket_thuc',
      'specialty_id', 'khu_vuc',
    ]
    for (const f of fields) {
      if (req.body[f] !== undefined) service[f] = req.body[f]
    }
    if (service.loai === 'clinic') service.khu_vuc = []

    await service.save()

    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id,
      vai_tro:            req.user.role,
      hanh_dong:          'UPDATE_SERVICE',
      loai_doi_tuong:     'service',
      doi_tuong_id:       service._id,
      ly_do:              req.body.mo_ta_thay_doi?.trim() || `Cập nhật dịch vụ "${service.ten}"`,
    })

    const formatted = await formatService(service)
    return ok(res, formatted, 'Cập nhật dịch vụ thành công')
  } catch (err) {
    if (err.code === 11000) return fail(res, 409, 'Tên dịch vụ đã tồn tại trong chuyên khoa này')
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/services/:id/toggle ───────────────────────────────────
export async function toggle(req, res) {
  try {
    const service = await DichVu.findById(req.params.id)
    if (!service) return fail(res, 404, 'Không tìm thấy dịch vụ')

    service.status = service.status === 'active' ? 'inactive' : 'active'
    await service.save()

    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id,
      vai_tro:            req.user.role,
      hanh_dong:          service.status === 'inactive' ? 'HIDE_SERVICE' : 'SHOW_SERVICE',
      loai_doi_tuong:     'service',
      doi_tuong_id:       service._id,
      ly_do:              `${service.status === 'inactive' ? 'Ẩn' : 'Hiện'} dịch vụ "${service.ten}"`,
    })

    const formatted = await formatService(service)
    return ok(res, formatted, `Đã ${service.status === 'inactive' ? 'ẩn' : 'hiện'} dịch vụ`)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
