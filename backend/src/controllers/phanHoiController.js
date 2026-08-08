import PhanHoi from '../models/PhanHoi.js'
import NguoiDung from '../models/NguoiDung.js'
import ThongBao from '../models/ThongBao.js'
import { ok, fail, created } from '../utils/response.js'
import { emitAdminRealtime } from '../realtime/socket.js'

export const createPhanHoi = async (req, res) => {
  try {
    const { ho_ten, email_sdt, noi_dung, hinh_anh } = req.body

    if (!ho_ten || !email_sdt || !noi_dung) {
      return fail(res, 400, 'Vui lòng cung cấp đầy đủ thông tin bắt buộc')
    }

    const newPhanHoi = await PhanHoi.create({
      ho_ten,
      email_sdt,
      noi_dung,
      hinh_anh: hinh_anh || null,
    })

    // Tìm các admin để gửi thông báo
    const admins = await NguoiDung.find({ role: 'admin' }).select('_id')
    
    if (admins.length > 0) {
      const thongBaos = admins.map(admin => ({
        user_id: admin._id,
        tieu_de: 'Có phản hồi mới từ khách hàng',
        noi_dung: `Khách hàng ${ho_ten} vừa gửi một phản hồi mới.`,
        loai: 'system',
        kenh_gui: 'in_app',
        related_id: newPhanHoi._id,
        related_type: 'phan_hoi',
        du_lieu_dinh_kem: {
          noi_dung_phan_hoi: noi_dung,
          hinh_anh: hinh_anh || null
        }
      }))
      
      await ThongBao.insertMany(thongBaos)
    }

    // Emit socket sự kiện cho admin
    emitAdminRealtime('thong_bao:moi', { 
      type: 'phan_hoi', 
      id: newPhanHoi._id,
      ho_ten 
    })

    return created(res, { id: newPhanHoi._id }, 'Gửi phản hồi thành công')
  } catch (error) {
    console.error('[createPhanHoi] error:', error)
    return fail(res, 500, 'Lỗi máy chủ khi gửi phản hồi')
  }
}

export const getPhanHoiList = async (req, res) => {
  try {
    const phanHoiList = await PhanHoi.find().sort({ ngay_tao: -1 })
    return ok(res, phanHoiList, 'Lấy danh sách phản hồi thành công')
  } catch (error) {
    console.error('[getPhanHoiList] error:', error)
    return fail(res, 500, 'Lỗi máy chủ khi lấy danh sách')
  }
}

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params
    const phanHoi = await PhanHoi.findByIdAndUpdate(
      id,
      { status: 'read' },
      { new: true }
    )
    if (!phanHoi) return fail(res, 404, 'Không tìm thấy phản hồi')
    
    return ok(res, phanHoi, 'Đã đánh dấu là đã đọc')
  } catch (error) {
    return fail(res, 500, 'Lỗi khi cập nhật trạng thái')
  }
}

export const deletePhanHoi = async (req, res) => {
  try {
    const { id } = req.params
    const result = await PhanHoi.findByIdAndDelete(id)
    if (!result) return fail(res, 404, 'Không tìm thấy phản hồi')
    
    return ok(res, null, 'Xóa phản hồi thành công')
  } catch (error) {
    return fail(res, 500, 'Lỗi khi xóa phản hồi')
  }
}
