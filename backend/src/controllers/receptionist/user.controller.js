import { NguoiDung, LichHen } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

export const lookupUser = async (req, res) => {
  try {
    const { phone } = req.query
    if (!phone) {
      return fail(res, 400, 'Thiếu số điện thoại để tra cứu')
    }

    const user = await NguoiDung.findOne({ so_dien_thoai: phone, status: 'active', role: { $in: ['patient', 'user'] } }).lean()
    
    if (!user) {
      return ok(res, { found: false, user: null })
    }

    // Đếm số lần đặt lịch
    const count = await LichHen.countDocuments({ user_id: user._id })

    // Lấy lịch sử gần nhất
    const lastAppointment = await LichHen.findOne({ user_id: user._id, status: { $in: ['completed', 'confirmed', 'checked_in'] } })
      .sort({ ngay_kham: -1, gio_kham: -1 })
      .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } })
      .lean()

    const userData = {
      _id: user._id,
      ho_ten: user.ho_ten,
      so_dien_thoai: user.so_dien_thoai,
      email: user.email,
      anh_dai_dien: user.anh_dai_dien,
      so_lan_dat_lich: count,
      lich_su_gan_nhat: lastAppointment ? {
        ngay_kham: lastAppointment.ngay_kham,
        gio_kham: lastAppointment.gio_kham,
        ten_bac_si: lastAppointment.doctor_id?.user_id?.ho_ten || 'Chưa rõ',
      } : null,
    }

    return ok(res, { found: true, user: userData })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
