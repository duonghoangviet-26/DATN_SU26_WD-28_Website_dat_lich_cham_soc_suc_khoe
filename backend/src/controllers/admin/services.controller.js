import mongoose from 'mongoose'
import { DichVu, NhatKyThaoTac, LichHen, BacSi } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

const isValidId = (id) => id && mongoose.Types.ObjectId.isValid(id)
const DOI_TUONG_AP_DUNG_VALUES = ['tre_em', 'nguoi_lon', 'gia_dinh', 'khong_gioi_han']
const LOAI_GOI_VALUES = ['goi_don', 'goi_gia_dinh']
const SERVICE_HOME_DISABLED_MESSAGE = 'Dich vu tai nha da ngung ho tro. He thong chi giu du lieu cu de doi soat lich su.'

function normalizePackageFields(input = {}) {
  const laGoi = input.la_goi === undefined ? undefined : Boolean(input.la_goi)
  const doiTuongRaw = typeof input.doi_tuong_ap_dung === 'string'
    ? input.doi_tuong_ap_dung.trim()
    : input.doi_tuong_ap_dung

  if (doiTuongRaw != null && doiTuongRaw !== '' && !DOI_TUONG_AP_DUNG_VALUES.includes(doiTuongRaw)) {
    return { error: 'Đối tượng áp dụng không hợp lệ' }
  }

  const loaiGoiRaw = typeof input.loai_goi === 'string' ? input.loai_goi.trim() : input.loai_goi
  if (loaiGoiRaw != null && loaiGoiRaw !== '' && !LOAI_GOI_VALUES.includes(loaiGoiRaw)) {
    return { error: 'Loại gói không hợp lệ' }
  }

  const soNguoiRaw = input.so_nguoi_ap_dung
  const soNguoi = soNguoiRaw == null || soNguoiRaw === '' ? null : Number(soNguoiRaw)
  if (soNguoi != null && (!Number.isInteger(soNguoi) || soNguoi < 1 || soNguoi > 12)) {
    return { error: 'Số người áp dụng phải là số nguyên từ 1 đến 12' }
  }

  const phanTramRaw = input.phan_tram_giam_gia
  const phanTram = phanTramRaw == null || phanTramRaw === '' ? null : Number(phanTramRaw)
  if (phanTram != null && (!Number.isFinite(phanTram) || phanTram < 0 || phanTram > 90)) {
    return { error: 'Phần trăm giảm giá phải từ 0 đến 90' }
  }

  const dichVuCon = Array.isArray(input.dich_vu_con)
    ? input.dich_vu_con.filter(Boolean)
    : []
  if (dichVuCon.some((id) => !isValidId(id))) {
    return { error: 'Danh sách dịch vụ con không hợp lệ' }
  }

  return {
    la_goi: laGoi,
    doi_tuong_ap_dung: doiTuongRaw ? doiTuongRaw : null,
    loai_goi: loaiGoiRaw || null,
    so_nguoi_ap_dung: soNguoi,
    dich_vu_con: dichVuCon,
    phan_tram_giam_gia: phanTram,
  }
}

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
  const bacSiFilter = { related_services: service._id, trang_thai_duyet: 'approved', la_hien: true }

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
    const { loai, status, search, la_goi } = req.query
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))

    const filter = { loai: 'related' }
    if (loai && loai !== 'related') {
      return ok(res, { items: [], total: 0, page, totalPages: 1 })
    }
    if (status) filter.status = status
    if (la_goi !== undefined) filter.la_goi = ['true', '1'].includes(String(la_goi).toLowerCase())
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
    if (s.loai === 'home') return fail(res, 410, SERVICE_HOME_DISABLED_MESSAGE)

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
      ten, loai, gia, mo_ta_ngan, mo_ta, hinh_anh,
      gio_dat_truoc_toi_thieu, specialty_id, khu_vuc, chuan_bi_truoc, la_goi, doi_tuong_ap_dung,
      loai_goi, so_nguoi_ap_dung, dich_vu_con, phan_tram_giam_gia,
    } = req.body
    const normalizedPackage = normalizePackageFields({
      la_goi,
      doi_tuong_ap_dung,
      loai_goi,
      so_nguoi_ap_dung,
      dich_vu_con,
      phan_tram_giam_gia,
    })
    if (normalizedPackage.error) return fail(res, 400, normalizedPackage.error)

    // ── Validate bắt buộc ────────────────────────────────────────────────────
    if (!ten?.trim())  return fail(res, 400, 'Tên dịch vụ là bắt buộc')
    if (ten.trim().length > 255) return fail(res, 400, 'Tên dịch vụ không vượt quá 255 ký tự')
    if (!loai)         return fail(res, 400, 'Loại dịch vụ là bắt buộc')
    if (loai !== 'related') return fail(res, 400, SERVICE_HOME_DISABLED_MESSAGE)
    if (gia === undefined || gia === null)    return fail(res, 400, 'Giá dịch vụ là bắt buộc')
    if (!Number.isInteger(Number(gia)) || Number(gia) < 1) return fail(res, 400, 'Giá phải là số nguyên lớn hơn 0')
    if (Number(gia) > 100_000_000) return fail(res, 400, 'Giá không vượt quá 100 triệu VNĐ')

    // ── Validate theo loại ───────────────────────────────────────────────────
    if (loai === 'related') {
      if (!isValidId(specialty_id)) return fail(res, 400, 'Dịch vụ liên quan bắt buộc phải có chuyên khoa')
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
      hinh_anh:       hinh_anh?.trim()   || null,
      thoi_gian_phut: null,
      gio_dat_truoc_toi_thieu: undefined,
      ngay_ap_dung:   null,
      gio_bat_dau:    null,
      gio_ket_thuc:   null,
      specialty_id,
      la_goi:         normalizedPackage.la_goi ?? false,
      doi_tuong_ap_dung: normalizedPackage.la_goi === false ? null : normalizedPackage.doi_tuong_ap_dung,
      loai_goi:       normalizedPackage.la_goi ? normalizedPackage.loai_goi : null,
      so_nguoi_ap_dung: normalizedPackage.la_goi ? normalizedPackage.so_nguoi_ap_dung : null,
      dich_vu_con:    normalizedPackage.la_goi ? normalizedPackage.dich_vu_con : [],
      phan_tram_giam_gia: normalizedPackage.la_goi ? normalizedPackage.phan_tram_giam_gia : null,
      khu_vuc:        [],
      chuan_bi_truoc: chuan_bi_truoc?.trim() || null,
      nguoi_tao_id:   req.user.id,
    })

    await writeAuditLog(req.user.id, req.user.role, 'CREATE_SERVICE', service._id, `Tạo dịch vụ "${ten.trim()}"`)

    const formatted = await populateService(service)
    return created(res, formatted, 'Tạo dịch vụ thành công')
  } catch (err) {
    if (err.code === 11000) {
      const { loai } = req.body
      return fail(res, 409,
        'Tên dịch vụ đã tồn tại trong chuyên khoa này'
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
    if (service.loai === 'home') return fail(res, 410, SERVICE_HOME_DISABLED_MESSAGE)
    const normalizedPackage = normalizePackageFields(req.body)
    if (normalizedPackage.error) return fail(res, 400, normalizedPackage.error)

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
      if (req.body.loai !== 'related')
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
    const STR_OR_NULL = new Set(['mo_ta_ngan', 'mo_ta', 'hinh_anh'])
    const EDITABLE    = ['mo_ta_ngan', 'mo_ta', 'hinh_anh']
    for (const f of EDITABLE) {
      if (req.body[f] === undefined) continue
      service[f] = STR_OR_NULL.has(f) ? (req.body[f]?.trim() || null) : req.body[f]
    }

    // home không dùng specialty_id — luôn clear kể cả khi client không gửi field này
    // (trước đây chỉ set khi body có specialty_id, nên đổi related→home dễ để sót giá trị cũ).
    if (currentLoai === 'related') {
      if (req.body.specialty_id !== undefined) service.specialty_id = req.body.specialty_id
      // đã validate isValidId(specId) ở khối "Validate specialty_id khi loại là related" phía trên
    }

    // Luôn reset các trường cố định theo loại hiện tại — related không đặt lịch riêng
    // nên thời lượng/lịch áp dụng vô nghĩa, để null (không phải giá trị giả).
    service.thoi_gian_phut = null
    service.ngay_ap_dung   = null
    service.gio_bat_dau    = null
    service.gio_ket_thuc   = null
    service.khu_vuc        = []
    service.chuan_bi_truoc = req.body.chuan_bi_truoc?.trim() || null

    if (normalizedPackage.la_goi !== undefined) {
      service.la_goi = normalizedPackage.la_goi
    }
    if (req.body.doi_tuong_ap_dung !== undefined || normalizedPackage.la_goi === false) {
      service.doi_tuong_ap_dung =
        service.la_goi === false ? null : normalizedPackage.doi_tuong_ap_dung
    }
    if (req.body.loai_goi !== undefined || normalizedPackage.la_goi === false) {
      service.loai_goi = service.la_goi === false ? null : normalizedPackage.loai_goi
    }
    if (req.body.so_nguoi_ap_dung !== undefined || normalizedPackage.la_goi === false) {
      service.so_nguoi_ap_dung = service.la_goi === false ? null : normalizedPackage.so_nguoi_ap_dung
    }
    if (req.body.dich_vu_con !== undefined || normalizedPackage.la_goi === false) {
      service.dich_vu_con = service.la_goi === false ? [] : normalizedPackage.dich_vu_con
    }
    if (req.body.phan_tram_giam_gia !== undefined || normalizedPackage.la_goi === false) {
      service.phan_tram_giam_gia = service.la_goi === false ? null : normalizedPackage.phan_tram_giam_gia
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
        'Tên dịch vụ đã tồn tại trong chuyên khoa này'
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
    if (service.loai === 'home') return fail(res, 410, SERVICE_HOME_DISABLED_MESSAGE)

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
