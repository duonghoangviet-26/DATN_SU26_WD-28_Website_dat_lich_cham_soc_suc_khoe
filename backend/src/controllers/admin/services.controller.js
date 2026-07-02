import mongoose from 'mongoose'
import { DichVu, NhatKyThaoTac, LichHen, BacSi } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

const isValidId = (id) => id && mongoose.Types.ObjectId.isValid(id)

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

// Helper: tính so_bac_si / so_luot_dat / active_appointments — công thức theo
// docs/luong-dat-dich-vu.md mục 4.3 (trước đây chưa implement, luôn undefined ở API thật).
// related: đếm BacSi.related_services chứa service._id | home: đếm BacSi.services chứa service._id.
// so_luot_dat / active_appointments: đếm LichHen.service_id — chỉ home mới có giá trị này
// (LichHen.service_id luôn null với clinic, và related không có luồng đặt lịch riêng — xem
// LichHen.js pre-validate hook), nên với related 2 số này luôn = 0, đúng theo thiết kế.
async function computeExtras(service) {
  const bacSiFilter = service.loai === 'related'
    ? { related_services: service._id, trang_thai_duyet: 'approved', la_hien: true }
    : { services: service._id, trang_thai_duyet: 'approved', la_hien: true }

  const [so_bac_si, so_luot_dat, active_appointments] = await Promise.all([
    BacSi.countDocuments(bacSiFilter),
    LichHen.countDocuments({ service_id: service._id }),
    LichHen.countDocuments({ service_id: service._id, status: { $in: ['pending', 'confirmed'] } }),
  ])

  return { so_bac_si, so_luot_dat, active_appointments }
}

// Helper: populate doc Mongoose (không findById lại — tiết kiệm 1 round-trip DB)
async function populateService(doc) {
  await doc.populate([
    { path: 'specialty_id', select: 'ten' },
    { path: 'nguoi_tao_id', select: 'ho_ten' },
  ])
  const s = doc.toObject()
  const extras = await computeExtras(doc)
  return {
    ...s,
    id:            s._id,
    specialty_ten: doc.specialty_id?.ten    ?? null,
    specialty_id:  doc.specialty_id?._id    ?? null,
    nguoi_tao:     doc.nguoi_tao_id?.ho_ten ?? null,
    ...extras,
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

// Helper: ghi audit log — không throw nếu lỗi (không dừng luồng chính)
async function writeAuditLog(userId, role, hanh_dong, serviceId, ly_do) {
  try {
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: userId,
      vai_tro:            role,
      hanh_dong,
      loai_doi_tuong:     'service',
      doi_tuong_id:       serviceId,
      ly_do,
    })
  } catch (logErr) {
    console.error('[audit-log] Ghi log thất bại:', logErr.message)
  }
}

// ─── GET /api/admin/services?loai=&status=&search=&page=&limit= ─────────────
export async function list(req, res) {
  try {
    const { loai, status, search } = req.query
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))

    const filter = {}
    if (loai)   filter.loai   = loai
    if (status) filter.status = status
    if (search?.trim()) filter.$or = [
      { ten:        { $regex: search.trim(), $options: 'i' } },
      { ma_dich_vu: { $regex: search.trim(), $options: 'i' } },
      { mo_ta_ngan: { $regex: search.trim(), $options: 'i' } },
    ]

    const [services, total] = await Promise.all([
      DichVu.find(filter)
        .populate('specialty_id', 'ten')
        .populate('nguoi_tao_id', 'ho_ten')
        .sort({ ma_dich_vu: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DichVu.countDocuments(filter),
    ])

    const items = await Promise.all(services.map(async (s) => ({
      ...s,
      id:            s._id,
      specialty_ten: s.specialty_id?.ten    ?? null,
      specialty_id:  s.specialty_id?._id    ?? null,
      nguoi_tao:     s.nguoi_tao_id?.ho_ten ?? null,
      ...(await computeExtras(s)),
    })))

    const totalPages = Math.max(1, Math.ceil(total / limit))
    return ok(res, { items, total, page, totalPages })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/admin/services/:id ────────────────────────────────────────────
export async function getById(req, res) {
  try {
    const s = await DichVu.findById(req.params.id)
      .populate('specialty_id', 'ten')
      .populate('nguoi_tao_id', 'ho_ten')
      .lean()
    if (!s) return fail(res, 404, 'Không tìm thấy dịch vụ')

    const [lich_su_thay_doi, extras] = await Promise.all([
      getAuditLogs(s._id),
      computeExtras(s),
    ])
    return ok(res, {
      ...s,
      id:               s._id,
      specialty_ten:    s.specialty_id?.ten    ?? null,
      specialty_id:     s.specialty_id?._id    ?? null,
      nguoi_tao:        s.nguoi_tao_id?.ho_ten ?? null,
      lich_su_thay_doi,
      ...extras,
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
      gio_dat_truoc_toi_thieu, specialty_id, khu_vuc, chuan_bi_truoc,
    } = req.body

    // ── Validate bắt buộc ────────────────────────────────────────────────────
    if (!ten?.trim())  return fail(res, 400, 'Tên dịch vụ là bắt buộc')
    if (ten.trim().length > 255) return fail(res, 400, 'Tên dịch vụ không vượt quá 255 ký tự')
    if (!loai)         return fail(res, 400, 'Loại dịch vụ là bắt buộc')
    if (!['home', 'related'].includes(loai)) return fail(res, 400, 'Loại dịch vụ không hợp lệ')
    if (gia === undefined || gia === null)    return fail(res, 400, 'Giá dịch vụ là bắt buộc')
    if (!Number.isInteger(Number(gia)) || Number(gia) < 1) return fail(res, 400, 'Giá phải là số nguyên lớn hơn 0')
    if (Number(gia) > 100_000_000) return fail(res, 400, 'Giá không vượt quá 100 triệu VNĐ')

    // ── Validate theo loại ───────────────────────────────────────────────────
    if (loai === 'related') {
      if (!isValidId(specialty_id)) return fail(res, 400, 'Dịch vụ liên quan bắt buộc phải có chuyên khoa')
    }
    if (loai === 'home') {
      const gdt = Number(gio_dat_truoc_toi_thieu ?? 4)
      if (!Number.isInteger(gdt) || gdt < 1 || gdt > 48)
        return fail(res, 400, 'Thời gian đặt trước phải từ 1–48 giờ')
      if (!khu_vuc || khu_vuc.length === 0)
        return fail(res, 400, 'Dịch vụ tại nhà cần chọn ít nhất 1 khu vực phục vụ')
    }

    // related: không đặt lịch riêng (đi kèm khám clinic, BS chỉ định) → thời lượng/lịch áp dụng
    // vô nghĩa, để null thay vì giá trị giả — tránh hiển thị nhầm "30 phút, T2–T7 08:00-17:00"
    // như 1 dịch vụ đặt lịch được (ServiceViewModal.tsx).
    const service = await DichVu.create({
      ten:            ten.trim(),
      loai,
      gia:            parseInt(gia, 10),
      mo_ta_ngan:     mo_ta_ngan?.trim() || null,
      mo_ta:          mo_ta?.trim()      || null,
      thoi_gian_phut: loai === 'home' ? 60 : null,
      gio_dat_truoc_toi_thieu: loai === 'home' ? parseInt(gio_dat_truoc_toi_thieu ?? 4, 10) : undefined,
      ngay_ap_dung:   loai === 'home' ? 'T2–T7' : null,
      gio_bat_dau:    loai === 'home' ? '08:00' : null,
      gio_ket_thuc:   loai === 'home' ? '17:00' : null,
      specialty_id:   loai === 'related' ? specialty_id : null,
      khu_vuc:        loai === 'home' ? (khu_vuc ?? []) : [],
      chuan_bi_truoc: loai === 'related' ? (chuan_bi_truoc?.trim() || null) : null,
      nguoi_tao_id:   req.user.id,
    })

    await writeAuditLog(req.user.id, req.user.role, 'CREATE_SERVICE', service._id, `Tạo dịch vụ "${ten.trim()}"`)

    const formatted = await populateService(service)
    return created(res, formatted, 'Tạo dịch vụ thành công')
  } catch (err) {
    if (err.code === 11000) {
      const { loai } = req.body
      return fail(res, 409,
        loai === 'related'
          ? 'Tên dịch vụ đã tồn tại trong chuyên khoa này'
          : 'Tên dịch vụ tại nhà này đã tồn tại trong hệ thống'
      )
    }
    return fail(res, 500, err.message)
  }
}

// ─── PUT /api/admin/services/:id ────────────────────────────────────────────
export async function update(req, res) {
  // Khai báo ngoài try — catch bên dưới cần đọc service.loai khi bắt lỗi trùng key (11000).
  // Khai báo bằng const bên trong try trước đây gây ReferenceError ở catch (block-scope JS).
  let service
  try {
    service = await DichVu.findById(req.params.id)
    if (!service) return fail(res, 404, 'Không tìm thấy dịch vụ')

    // ── Validate tên ─────────────────────────────────────────────────────────
    if (req.body.ten !== undefined) {
      const ten = req.body.ten?.trim()
      if (!ten) return fail(res, 400, 'Tên dịch vụ là bắt buộc')
      if (ten.length > 255) return fail(res, 400, 'Tên dịch vụ không vượt quá 255 ký tự')
      service.ten = ten
    }

    // ── Validate giá ─────────────────────────────────────────────────────────
    if (req.body.gia !== undefined) {
      const gia = Number(req.body.gia)
      if (!Number.isInteger(gia) || gia < 1) return fail(res, 400, 'Giá phải là số nguyên lớn hơn 0')
      if (gia > 100_000_000) return fail(res, 400, 'Giá không vượt quá 100 triệu VNĐ')
      service.gia = gia
    }

    // ── Kiểm tra đổi loại có lịch hẹn đang xử lý không ─────────────────────
    if (req.body.loai !== undefined && req.body.loai !== service.loai) {
      if (!['home', 'related'].includes(req.body.loai))
        return fail(res, 400, 'Loại dịch vụ không hợp lệ')

      const activeCount = await LichHen.countDocuments({
        service_id: service._id,
        status:     { $in: ['pending', 'confirmed'] },
      })
      if (activeCount > 0)
        return fail(res, 400, `Không thể đổi loại hình — đang có ${activeCount} lịch hẹn đang xử lý`)

      service.loai = req.body.loai
    }

    // ── Validate specialty_id khi loại là related ─────────────────────────────
    const currentLoai = service.loai // đã được update ở trên nếu có đổi
    if (currentLoai === 'related') {
      const specId = req.body.specialty_id !== undefined ? req.body.specialty_id : service.specialty_id
      if (!isValidId(specId))
        return fail(res, 400, 'Dịch vụ liên quan bắt buộc phải có chuyên khoa')
    }

    // ── Cập nhật các trường còn lại ──────────────────────────────────────────
    const STR_OR_NULL = new Set(['mo_ta_ngan', 'mo_ta'])
    const EDITABLE    = ['mo_ta_ngan', 'mo_ta', 'gio_dat_truoc_toi_thieu', 'khu_vuc']
    for (const f of EDITABLE) {
      if (req.body[f] === undefined) continue
      service[f] = STR_OR_NULL.has(f) ? (req.body[f]?.trim() || null) : req.body[f]
    }

    // Validate gio_dat_truoc_toi_thieu nếu home
    if (currentLoai === 'home' && req.body.gio_dat_truoc_toi_thieu !== undefined) {
      const gdt = parseInt(req.body.gio_dat_truoc_toi_thieu, 10)
      if (!Number.isInteger(gdt) || gdt < 1 || gdt > 48)
        return fail(res, 400, 'Thời gian đặt trước phải từ 1–48 giờ')
      service.gio_dat_truoc_toi_thieu = gdt
    }

    // Re-validate khu_vuc ≥1 cho home — create() đã chặn, update() trước đây tin client
    // hoàn toàn (chỉ set nếu body có field), có thể lưu 0 khu vực qua gọi API trực tiếp.
    if (currentLoai === 'home' && (!service.khu_vuc || service.khu_vuc.length === 0)) {
      return fail(res, 400, 'Dịch vụ tại nhà cần chọn ít nhất 1 khu vực phục vụ')
    }

    // home không dùng specialty_id — luôn clear kể cả khi client không gửi field này
    // (trước đây chỉ set khi body có specialty_id, nên đổi related→home dễ để sót giá trị cũ).
    if (currentLoai === 'related') {
      if (req.body.specialty_id !== undefined) service.specialty_id = req.body.specialty_id
      // đã validate isValidId(specId) ở khối "Validate specialty_id khi loại là related" phía trên
    } else {
      service.specialty_id = null
    }

    // Luôn reset các trường cố định theo loại hiện tại — related không đặt lịch riêng
    // nên thời lượng/lịch áp dụng vô nghĩa, để null (không phải giá trị giả).
    service.thoi_gian_phut = currentLoai === 'home' ? 60  : null
    service.ngay_ap_dung   = currentLoai === 'home' ? 'T2–T7' : null
    service.gio_bat_dau    = currentLoai === 'home' ? '08:00' : null
    service.gio_ket_thuc   = currentLoai === 'home' ? '17:00' : null
    if (currentLoai === 'related') {
      service.khu_vuc       = []
      service.chuan_bi_truoc = req.body.chuan_bi_truoc?.trim() || null
    } else {
      service.chuan_bi_truoc = null
    }

    await service.save()
    await writeAuditLog(
      req.user.id, req.user.role, 'UPDATE_SERVICE', service._id,
      req.body.mo_ta_thay_doi?.trim() || `Cập nhật dịch vụ "${service.ten}"`
    )

    const formatted = await populateService(service)
    return ok(res, formatted, 'Cập nhật dịch vụ thành công')
  } catch (err) {
    if (err.code === 11000) {
      return fail(res, 409,
        service?.loai === 'related'
          ? 'Tên dịch vụ đã tồn tại trong chuyên khoa này'
          : 'Tên dịch vụ tại nhà này đã tồn tại trong hệ thống'
      )
    }
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/services/:id/toggle ───────────────────────────────────
export async function toggle(req, res) {
  try {
    const service = await DichVu.findById(req.params.id)
    if (!service) return fail(res, 404, 'Không tìm thấy dịch vụ')

    const wasActive  = service.status === 'active'
    service.status   = wasActive ? 'inactive' : 'active'
    await service.save()

    await writeAuditLog(
      req.user.id, req.user.role,
      wasActive ? 'HIDE_SERVICE' : 'SHOW_SERVICE',
      service._id,
      `${wasActive ? 'Ẩn' : 'Hiện'} dịch vụ "${service.ten}"`
    )

    const formatted = await populateService(service)
    return ok(res, formatted, wasActive ? 'Đã ẩn dịch vụ' : 'Đã hiện dịch vụ')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
