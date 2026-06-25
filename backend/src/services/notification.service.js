import mongoose from 'mongoose'
import ThongBaoHeThong from '../models/ThongBaoHeThong.js'
import NguoiDung from '../models/NguoiDung.js'

export async function getSystemNotifications(page = 1, limit = 10) {
  const skip = (page - 1) * limit

  const [notifications, total] = await Promise.all([
    ThongBaoHeThong.find()
      .populate({ path: 'tao_boi', select: 'ho_ten email' })
      .sort({ ngay_gui: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ThongBaoHeThong.countDocuments(),
  ])

  return {
    data: notifications,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function sendSystemNotification({ tieu_de, noi_dung, doi_tuong, admin_id }) {
  if (!tieu_de || !noi_dung || !doi_tuong || !admin_id) {
    throw new Error('Vui lòng cung cấp đủ thông tin: tieu_de, noi_dung, doi_tuong, admin_id')
  }

  if (!mongoose.Types.ObjectId.isValid(admin_id)) {
    throw new Error('admin_id không hợp lệ')
  }

  // Đếm số lượng người nhận dựa trên đối tượng
  let so_nguoi_nhan = 0
  if (doi_tuong === 'tat_ca') {
    so_nguoi_nhan = await NguoiDung.countDocuments({ status: 'active' })
  } else if (doi_tuong === 'benh_nhan') {
    so_nguoi_nhan = await NguoiDung.countDocuments({ role: 'user', status: 'active' })
  } else if (doi_tuong === 'bac_si') {
    so_nguoi_nhan = await NguoiDung.countDocuments({ role: 'doctor', status: 'active' })
  } else {
    throw new Error('doi_tuong không hợp lệ (tat_ca, benh_nhan, bac_si)')
  }

  const newNotification = new ThongBaoHeThong({
    tieu_de,
    noi_dung,
    doi_tuong,
    tao_boi: admin_id,
    so_nguoi_nhan,
    ngay_gui: new Date()
  })

  await newNotification.save()

  // Lấy dữ liệu vừa tạo kèm thông tin admin để trả về
  const populatedNotification = await ThongBaoHeThong.findById(newNotification._id)
    .populate({ path: 'tao_boi', select: 'ho_ten email' })
    .lean()

  return populatedNotification
}

export async function updateSystemNotification(id, { tieu_de, noi_dung }) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('ID thông báo không hợp lệ')
  }

  if (!tieu_de || !noi_dung) {
    throw new Error('Vui lòng cung cấp đủ tiêu đề và nội dung cần sửa')
  }

  const notification = await ThongBaoHeThong.findById(id)
  if (!notification) {
    throw new Error('Không tìm thấy thông báo')
  }

  notification.tieu_de = tieu_de
  notification.noi_dung = noi_dung
  await notification.save()

  const updatedNotification = await ThongBaoHeThong.findById(id)
    .populate({ path: 'tao_boi', select: 'ho_ten email' })
    .lean()

  return updatedNotification
}

export async function deleteSystemNotification(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('ID thông báo không hợp lệ')
  }

  const notification = await ThongBaoHeThong.findById(id)
  if (!notification) {
    throw new Error('Không tìm thấy thông báo')
  }

  await ThongBaoHeThong.findByIdAndDelete(id)
  return true
}
