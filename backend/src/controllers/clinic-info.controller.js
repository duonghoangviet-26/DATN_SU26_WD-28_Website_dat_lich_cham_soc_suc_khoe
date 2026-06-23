import ThongTinPhongKham from '../models/ThongTinPhongKham.js'
import { ok, fail } from '../utils/response.js'

// GET /api/admin/clinic-info
export async function getClinicInfo(req, res) {
  try {
    let info = await ThongTinPhongKham.findOne({ ma: 'MAIN' })
    if (!info) {
      // Nếu chưa có, tạo mặc định
      info = await ThongTinPhongKham.create({
        ma: 'MAIN',
        ten: 'VitaFamily Clinic',
        dia_chi: '123 Đường ABC, Quận XYZ, TP.HCM',
        so_dien_thoai: '0901234567',
        email: 'contact@vitafamily.vn',
        gio_lam_viec: '8:00 - 17:00 (Thứ 2 - Thứ 7)',
        mo_ta: 'Phòng khám gia đình hiện đại',
      })
    }
    return ok(res, info)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// PUT /api/admin/clinic-info
export async function updateClinicInfo(req, res) {
  try {
    const { ten, dia_chi, so_dien_thoai, email, gio_lam_viec, mo_ta, logo_url, ban_do_url } = req.body

    if (!ten) return fail(res, 400, 'Tên phòng khám là bắt buộc')

    const info = await ThongTinPhongKham.findOneAndUpdate(
      { ma: 'MAIN' },
      { ten, dia_chi, so_dien_thoai, email, gio_lam_viec, mo_ta, logo_url, ban_do_url },
      { new: true, upsert: true }
    )
    return ok(res, info, 'Cập nhật thông tin phòng khám thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
