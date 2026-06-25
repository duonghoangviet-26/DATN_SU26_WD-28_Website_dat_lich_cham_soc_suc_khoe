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
