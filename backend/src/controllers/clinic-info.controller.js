import ThongTinPhongKham from '../models/ThongTinPhongKham.js'
import { ok, fail } from '../utils/response.js'

// Lấy danh sách tất cả các chi nhánh (bao gồm cả active và inactive, hoặc có thể lọc)
export const getAllClinics = async (req, res) => {
  try {
    const status = req.query.status
    const filter = status ? { trang_thai: status } : {}
    const clinics = await ThongTinPhongKham.find(filter).sort({ ngay_tao: 1 })
    return ok(res, clinics)
  } catch (error) {
    return fail(res, 500, 'Lỗi server khi lấy danh sách phòng khám: ' + error.message)
  }
}

// Lấy thông tin 1 chi nhánh
export const getClinicById = async (req, res) => {
  try {
    const clinic = await ThongTinPhongKham.findById(req.params.id)
    if (!clinic) return fail(res, 404, 'Không tìm thấy chi nhánh')
    return ok(res, clinic)
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

// Thêm 1 chi nhánh mới
export const createClinic = async (req, res) => {
  try {
    const { ten } = req.body
    if (!ten) return fail(res, 400, 'Tên chi nhánh là bắt buộc')

    const newClinic = new ThongTinPhongKham(req.body)
    await newClinic.save()
    return ok(res, newClinic, 'Thêm chi nhánh thành công')
  } catch (error) {
    return fail(res, 400, 'Dữ liệu không hợp lệ: ' + error.message)
  }
}

// Cập nhật thông tin 1 chi nhánh
export const updateClinicInfo = async (req, res) => {
  try {
    const { ten } = req.body
    if (ten !== undefined && !ten) return fail(res, 400, 'Tên chi nhánh không được để trống')

    const updated = await ThongTinPhongKham.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
    
    if (!updated) {
      return fail(res, 404, 'Không tìm thấy chi nhánh để cập nhật')
    }
    return ok(res, updated, 'Cập nhật thành công')
  } catch (error) {
    return fail(res, 400, 'Dữ liệu cập nhật không hợp lệ: ' + error.message)
  }
}

// Xóa mềm 1 chi nhánh (chuyển trang_thai thành inactive)
export const deleteClinic = async (req, res) => {
  try {
    const deleted = await ThongTinPhongKham.findByIdAndUpdate(
      req.params.id,
      { trang_thai: 'inactive' },
      { new: true }
    )
    if (!deleted) return fail(res, 404, 'Không tìm thấy chi nhánh')
    return ok(res, deleted, 'Đã ngừng hoạt động chi nhánh')
  } catch (error) {
    return fail(res, 500, 'Lỗi server khi xóa: ' + error.message)
  }
}

// ==========================================
// QUẢN LÝ CHUYÊN KHOA CỦA TỪNG CHI NHÁNH
// ==========================================
import ChuyenKhoa from '../models/ChuyenKhoa.js'

// Lấy danh sách chuyên khoa của 1 chi nhánh
export const getSpecialtiesByClinic = async (req, res) => {
  try {
    const specialties = await ChuyenKhoa.find({ phong_kham_id: req.params.id }).sort({ thu_tu: 1, ngay_tao: 1 }).lean()
    return ok(res, specialties)
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

// Thêm chuyên khoa mới cho 1 chi nhánh
export const createSpecialtyForClinic = async (req, res) => {
  try {
    const { id } = req.params // clinic_id
    const { ten, mo_ta, icon_url, thu_tu } = req.body
    if (!ten || !ten.trim()) {
      return fail(res, 400, 'Tên chuyên khoa là bắt buộc')
    }
    
    // Kiểm tra xem chi nhánh có tồn tại không
    const clinic = await ThongTinPhongKham.findById(id)
    if (!clinic) return fail(res, 404, 'Không tìm thấy chi nhánh')

    const specialty = await ChuyenKhoa.create({
      phong_kham_id: id,
      ten: ten.trim(),
      mo_ta: mo_ta || null,
      icon_url: icon_url || null,
      thu_tu: thu_tu ?? 0,
    })
    return ok(res, specialty.toObject(), 'Đã thêm chuyên khoa mới')
  } catch (err) {
    if (err.code === 11000) {
      return fail(res, 409, 'Tên chuyên khoa này đã tồn tại trong chi nhánh')
    }
    return fail(res, 400, 'Lỗi dữ liệu: ' + err.message)
  }
}

// Cập nhật thông tin chuyên khoa
export const updateSpecialty = async (req, res) => {
  try {
    const { specialtyId } = req.params
    const { ten, mo_ta, icon_url, thu_tu } = req.body
    if (!ten || !ten.trim()) {
      return fail(res, 400, 'Tên chuyên khoa là bắt buộc')
    }

    // Cập nhật slug khi tên thay đổi
    function toSlug(str) {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    }

    const updated = await ChuyenKhoa.findByIdAndUpdate(
      specialtyId,
      { ten: ten.trim(), slug: toSlug(ten.trim()), mo_ta: mo_ta || null, icon_url: icon_url || null, thu_tu: thu_tu ?? 0 },
      { new: true, runValidators: true }
    ).lean()

    if (!updated) return fail(res, 404, 'Không tìm thấy chuyên khoa')
    return ok(res, updated, 'Đã cập nhật chuyên khoa')
  } catch (err) {
    if (err.code === 11000) {
      return fail(res, 409, 'Tên chuyên khoa này đã tồn tại trong chi nhánh')
    }
    return fail(res, 400, 'Lỗi dữ liệu: ' + err.message)
  }
}

// Ẩn/Hiện chuyên khoa
export const toggleSpecialty = async (req, res) => {
  try {
    const { specialtyId } = req.params
    const specialty = await ChuyenKhoa.findById(specialtyId)
    if (!specialty) return fail(res, 404, 'Không tìm thấy chuyên khoa')

    specialty.status = specialty.status === 'active' ? 'hidden' : 'active'
    await specialty.save()

    return ok(res, specialty.toObject(), `Đã ${specialty.status === 'active' ? 'hiện' : 'ẩn'} chuyên khoa`)
  } catch (err) {
    return fail(res, 500, 'Lỗi server: ' + err.message)
  }
}

// Copy chuyên khoa sang nhiều chi nhánh khác
export const copySpecialty = async (req, res) => {
  try {
    const { specialtyId } = req.params
    const { targetClinicIds } = req.body

    if (!Array.isArray(targetClinicIds) || targetClinicIds.length === 0) {
      return fail(res, 400, 'Danh sách chi nhánh đích không hợp lệ')
    }

    const sourceSpecialty = await ChuyenKhoa.findById(specialtyId)
    if (!sourceSpecialty) return fail(res, 404, 'Không tìm thấy chuyên khoa gốc')

    let copiedCount = 0
    let skippedCount = 0

    for (const clinicId of targetClinicIds) {
      // Bỏ qua nếu chính là chi nhánh hiện tại
      if (clinicId.toString() === sourceSpecialty.phong_kham_id.toString()) {
        skippedCount++
        continue
      }

      // Kiểm tra xem chi nhánh có tồn tại không
      const clinicExists = await ThongTinPhongKham.exists({ _id: clinicId })
      if (!clinicExists) {
        skippedCount++
        continue
      }

      // Kiểm tra trùng lặp (dựa vào slug trong phạm vi chi nhánh)
      const existingSpecialty = await ChuyenKhoa.findOne({ phong_kham_id: clinicId, slug: sourceSpecialty.slug })
      if (existingSpecialty) {
        skippedCount++
        continue
      }

      // Tạo bản sao
      await ChuyenKhoa.create({
        phong_kham_id: clinicId,
        ten: sourceSpecialty.ten,
        mo_ta: sourceSpecialty.mo_ta,
        icon_url: sourceSpecialty.icon_url,
        slug: sourceSpecialty.slug,
        thu_tu: sourceSpecialty.thu_tu,
        status: sourceSpecialty.status
      })
      copiedCount++
    }

    return ok(res, null, `Đã copy thành công sang ${copiedCount} chi nhánh. Bỏ qua ${skippedCount} chi nhánh do đã tồn tại hoặc lỗi.`)
  } catch (err) {
    return fail(res, 500, 'Lỗi server: ' + err.message)
  }
}
