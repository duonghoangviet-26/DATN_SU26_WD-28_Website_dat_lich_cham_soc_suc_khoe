import mongoose from 'mongoose'
import { DanhGia, BacSi, NhatKyThaoTac, NguoiDung } from '../models/index.js'

/**
 * Hàm cập nhật lại điểm đánh giá trung bình & tổng số đánh giá của bác sĩ
 * Chỉ tính các đánh giá có status = 'visible' và chưa bị xóa mềm (ngay_xoa = null)
 */
async function updateDoctorRating(doctorId) {
  const result = await DanhGia.aggregate([
    {
      $match: {
        doctor_id: new mongoose.Types.ObjectId(doctorId),
        status: 'visible',
        ngay_xoa: null,
      },
    },
    {
      $group: {
        _id: '$doctor_id',
        trungBinhSao: { $avg: '$so_sao' },
        tongSo: { $sum: 1 },
      },
    },
  ])

  const info = result[0] || { trungBinhSao: 0, tongSo: 0 }
  const roundedRating = Math.round(info.trungBinhSao * 10) / 10

  await BacSi.updateOne(
    { _id: doctorId },
    {
      $set: {
        diem_danh_gia: roundedRating,
        tong_danh_gia: info.tongSo,
      },
    }
  )
}

/**
 * Lấy danh sách đánh giá kèm phân trang, bộ lọc & thống kê
 */
export async function getReviewsList(query) {
  const page = parseInt(query.page) || 1
  const limit = parseInt(query.limit) || 10
  const skip = (page - 1) * limit

  const filter = {}

  // Lọc theo trạng thái xóa mềm (mặc định lấy bản ghi chưa xóa)
  if (query.deleted === 'true') {
    filter.ngay_xoa = { $ne: null }
  } else {
    filter.ngay_xoa = null
  }

  // Bộ lọc theo số sao
  if (query.rating) {
    filter.so_sao = parseInt(query.rating)
  }

  // Bộ lọc theo status
  if (query.status) {
    filter.status = query.status
  }

  // Bộ lọc theo bác sĩ
  if (query.doctor) {
    filter.doctor_id = query.doctor
  }

  // Bộ lọc tìm kiếm theo nội dung đánh giá, tên bệnh nhân hoặc tên bác sĩ
  if (query.search) {
    // 1. Tìm người dùng (bệnh nhân hoặc bác sĩ) có tên khớp với từ khóa
    const matchingUsers = await NguoiDung.find({
      ho_ten: { $regex: query.search, $options: 'i' }
    }, '_id').lean()
    const userIds = matchingUsers.map(u => u._id)

    // 2. Tìm hồ sơ bác sĩ liên quan đến người dùng có tên khớp
    const matchingDoctors = await BacSi.find({
      user_id: { $in: userIds }
    }, '_id').lean()
    const doctorIds = matchingDoctors.map(d => d._id)

    // 3. Tạo bộ lọc OR
    filter.$or = [
      { noi_dung: { $regex: query.search, $options: 'i' } },
      { user_id: { $in: userIds } },
      { doctor_id: { $in: doctorIds } }
    ]
  }

  // Bộ lọc khoảng ngày
  if (query.startDate || query.endDate) {
    filter.ngay_tao = {}
    if (query.startDate) {
      filter.ngay_tao.$gte = new Date(query.startDate)
    }
    if (query.endDate) {
      filter.ngay_tao.$lte = new Date(query.endDate)
    }
  }

  // Thực thi truy vấn lấy danh sách
  const reviews = await DanhGia.find(filter)
    .populate({
      path: 'user_id',
      select: 'ho_ten email anh_dai_dien',
    })
    .populate({
      path: 'doctor_id',
      populate: {
        path: 'user_id',
        select: 'ho_ten email',
      },
    })
    .sort({ ngay_tao: -1 })
    .skip(skip)
    .limit(limit)
    .lean()

  const total = await DanhGia.countDocuments(filter)

  // Tính toán thống kê chung (không phụ thuộc vào bộ lọc phân trang, chỉ lọc ngay_xoa = null)
  const statsResult = await DanhGia.aggregate([
    { $match: { ngay_xoa: null } },
    {
      $group: {
        _id: null,
        trungBinhSao: { $avg: '$so_sao' },
        tongSo: { $sum: 1 },
        hienThi: { $sum: { $cond: [{ $eq: ['$status', 'visible'] }, 1, 0] } },
        an: { $sum: { $cond: [{ $eq: ['$status', 'hidden'] }, 1, 0] } },
      },
    },
  ])

  const statistics = statsResult[0]
    ? {
      averageRating: Math.round(statsResult[0].trungBinhSao * 10) / 10,
      total: statsResult[0].tongSo,
      visible: statsResult[0].hienThi,
      hidden: statsResult[0].an,
    }
    : { averageRating: 0, total: 0, visible: 0, hidden: 0 }

  return {
    reviews: reviews.map(r => ({
      id: r._id,
      appointment_id: r.appointment_id,
      user: r.user_id ? {
        id: r.user_id._id,
        ho_ten: r.user_id.ho_ten,
        email: r.user_id.email,
        anh_dai_dien: r.user_id.anh_dai_dien,
      } : null,
      doctor: r.doctor_id ? {
        id: r.doctor_id._id,
        ho_ten: r.doctor_id.user_id?.ho_ten || null,
        email: r.doctor_id.user_id?.email || null,
      } : null,
      so_sao: r.so_sao,
      noi_dung: r.noi_dung,
      status: r.status,
      ngay_tao: r.ngay_tao,
      ngay_xoa: r.ngay_xoa,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    statistics,
  }
}

/**
 * Lấy chi tiết đánh giá & lịch sử thao tác
 */
export async function getReviewDetail(id) {
  const review = await DanhGia.findById(id)
    .populate({
      path: 'user_id',
      select: 'ho_ten email anh_dai_dien',
    })
    .populate({
      path: 'doctor_id',
      populate: {
        path: 'user_id',
        select: 'ho_ten email',
      },
    })
    .lean()

  if (!review) {
    throw new Error('Không tìm thấy đánh giá')
  }

  // Lấy lịch sử thay đổi từ NhatKyThaoTac
  const logs = await NhatKyThaoTac.find({
    loai_doi_tuong: 'review',
    doi_tuong_id: id,
  })
    .populate('nguoi_thuc_hien_id', 'ho_ten email role')
    .sort({ ngay_tao: -1 })
    .lean()

  return {
    review: {
      id: review._id,
      appointment_id: review.appointment_id,
      user: review.user_id ? {
        id: review.user_id._id,
        ho_ten: review.user_id.ho_ten,
        email: review.user_id.email,
        anh_dai_dien: review.user_id.anh_dai_dien,
      } : null,
      doctor: review.doctor_id ? {
        id: review.doctor_id._id,
        ho_ten: review.doctor_id.user_id?.ho_ten || null,
        email: review.doctor_id.user_id?.email || null,
      } : null,
      so_sao: review.so_sao,
      noi_dung: review.noi_dung,
      status: review.status,
      ngay_tao: review.ngay_tao,
      ngay_cap_nhat: review.ngay_cap_nhat,
      ngay_xoa: review.ngay_xoa,
    },
    history: logs.map(l => ({
      id: l._id,
      nguoi_thuc_hien: l.nguoi_thuc_hien_id ? {
        id: l.nguoi_thuc_hien_id._id,
        ho_ten: l.nguoi_thuc_hien_id.ho_ten,
        email: l.nguoi_thuc_hien_id.email,
        role: l.nguoi_thuc_hien_id.role,
      } : null,
      vai_tro: l.vai_tro,
      hanh_dong: l.hanh_dong,
      ly_do: l.ly_do,
      ngay_tao: l.ngay_tao,
    })),
  }
}

/**
 * Ẩn đánh giá
 */
export async function hideReview(id, adminId, lyDo) {
  const review = await DanhGia.findOne({ _id: id, ngay_xoa: null })
  if (!review) {
    throw new Error('Đánh giá không tồn tại hoặc đã bị xóa')
  }

  if (review.status === 'hidden') {
    throw new Error('Đánh giá đã ở trạng thái ẩn từ trước')
  }

  review.status = 'hidden'
  await review.save()

  // Cập nhật điểm bác sĩ
  await updateDoctorRating(review.doctor_id)

  // Ghi nhật ký thao tác
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: adminId,
    vai_tro: 'admin',
    hanh_dong: 'HIDE_REVIEW',
    loai_doi_tuong: 'review',
    doi_tuong_id: id,
    ly_do: lyDo || 'Ẩn đánh giá',
  })

  return review
}

/**
 * Hiện lại đánh giá
 */
export async function showReview(id, adminId, lyDo) {
  const review = await DanhGia.findOne({ _id: id, ngay_xoa: null })
  if (!review) {
    throw new Error('Đánh giá không tồn tại hoặc đã bị xóa')
  }

  if (review.status === 'visible') {
    throw new Error('Đánh giá đã ở trạng thái hiển thị từ trước')
  }

  review.status = 'visible'
  await review.save()

  // Cập nhật điểm bác sĩ
  await updateDoctorRating(review.doctor_id)

  // Ghi nhật ký thao tác
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: adminId,
    vai_tro: 'admin',
    hanh_dong: 'RESTORE_REVIEW', // Dùng RESTORE_REVIEW theo quy ước của NhatKyThaoTac hoặc có thể tự định nghĩa
    loai_doi_tuong: 'review',
    doi_tuong_id: id,
    ly_do: lyDo || 'Hiện lại đánh giá',
  })

  return review
}

/**
 * Xóa mềm đánh giá
 */
export async function softDeleteReview(id, adminId, lyDo) {
  const review = await DanhGia.findOne({ _id: id, ngay_xoa: null })
  if (!review) {
    throw new Error('Đánh giá không tồn tại hoặc đã bị xóa mềm từ trước')
  }

  review.ngay_xoa = new Date()
  review.nguoi_xoa = adminId
  await review.save()

  // Cập nhật điểm bác sĩ (nếu review bị xóa từng có status là visible)
  if (review.status === 'visible') {
    await updateDoctorRating(review.doctor_id)
  }

  // Ghi nhật ký thao tác
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: adminId,
    vai_tro: 'admin',
    hanh_dong: 'DELETE_REVIEW',
    loai_doi_tuong: 'review',
    doi_tuong_id: id,
    ly_do: lyDo || 'Xóa mềm đánh giá',
  })

  return review
}

/**
 * Khôi phục đánh giá bị xóa mềm
 */
export async function restoreReview(id, adminId, lyDo) {
  const review = await DanhGia.findOne({ _id: id, ngay_xoa: { $ne: null } })
  if (!review) {
    throw new Error('Không tìm thấy đánh giá bị xóa mềm để khôi phục')
  }

  review.ngay_xoa = null
  review.nguoi_xoa = null
  await review.save()

  // Cập nhật điểm bác sĩ (nếu sau khôi phục review có status là visible)
  if (review.status === 'visible') {
    await updateDoctorRating(review.doctor_id)
  }

  // Ghi nhật ký thao tác
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: adminId,
    vai_tro: 'admin',
    hanh_dong: 'RESTORE_REVIEW',
    loai_doi_tuong: 'review',
    doi_tuong_id: id,
    ly_do: lyDo || 'Khôi phục đánh giá',
  })

  return review
}

/**
 * Xóa cứng đánh giá (chỉ cho phép khi đã bị xóa mềm)
 */
export async function hardDeleteReview(id, adminId) {
  const review = await DanhGia.findOne({ _id: id, ngay_xoa: { $ne: null } })
  if (!review) {
    throw new Error('Đánh giá phải ở trạng thái xóa mềm trước khi xóa vĩnh viễn')
  }

  await DanhGia.deleteOne({ _id: id })

  // Ghi nhật ký thao tác
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: adminId,
    vai_tro: 'admin',
    hanh_dong: 'DELETE_REVIEW', // Hoặc có thể định nghĩa HARD_DELETE_REVIEW
    loai_doi_tuong: 'review',
    doi_tuong_id: id,
    ly_do: 'Xóa vĩnh viễn đánh giá ra khỏi hệ thống',
  })

  return { id }
}

/**
 * Thao tác hàng loạt trên nhiều đánh giá
 */
export async function batchActionReviews(ids, action, adminId, lyDo) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('Danh sách ID đánh giá không hợp lệ')
  }

  const validActions = ['hide', 'show', 'delete', 'restore', 'hard-delete']
  if (!validActions.includes(action)) {
    throw new Error('Hành động hàng loạt không hợp lệ')
  }

  let count = 0
  
  if (action === 'hard-delete') {
    // Chỉ cho phép xóa cứng các review đã bị xóa mềm
    const result = await DanhGia.deleteMany({
      _id: { $in: ids },
      ngay_xoa: { $ne: null }
    })
    count = result.deletedCount

    if (count > 0) {
      await NhatKyThaoTac.create({
        nguoi_thuc_hien_id: adminId,
        vai_tro: 'admin',
        hanh_dong: 'DELETE_REVIEW',
        loai_doi_tuong: 'review',
        doi_tuong_id: null,
        ly_do: `Xóa vĩnh viễn hàng loạt ${count} đánh giá khỏi hệ thống`,
      })
    }
  } else {
    let filter = { _id: { $in: ids } }
    if (action === 'restore') {
      filter.ngay_xoa = { $ne: null }
    } else {
      filter.ngay_xoa = null
    }

    const reviews = await DanhGia.find(filter)
    if (reviews.length === 0) {
      return { count: 0 }
    }

    const doctorIds = new Set()

    for (const r of reviews) {
      doctorIds.add(r.doctor_id.toString())

      if (action === 'hide') {
        r.status = 'hidden'
      } else if (action === 'show') {
        r.status = 'visible'
      } else if (action === 'delete') {
        r.ngay_xoa = new Date()
        r.nguoi_xoa = adminId
      } else if (action === 'restore') {
        r.ngay_xoa = null
        r.nguoi_xoa = null
      }
      await r.save()
      count++
    }

    // Cập nhật điểm bác sĩ hàng loạt
    for (const docId of doctorIds) {
      await updateDoctorRating(docId)
    }

    const actionLogNames = {
      hide: 'HIDE_REVIEW',
      show: 'RESTORE_REVIEW',
      delete: 'DELETE_REVIEW',
      restore: 'RESTORE_REVIEW',
    }

    const actionDescriptions = {
      hide: 'Ẩn hàng loạt đánh giá',
      show: 'Hiển thị hàng loạt đánh giá',
      delete: 'Xóa mềm hàng loạt đánh giá',
      restore: 'Khôi phục hàng loạt đánh giá',
    }

    if (count > 0) {
      await NhatKyThaoTac.create({
        nguoi_thuc_hien_id: adminId,
        vai_tro: 'admin',
        hanh_dong: actionLogNames[action],
        loai_doi_tuong: 'review',
        doi_tuong_id: null,
        ly_do: lyDo || `${actionDescriptions[action]} (Số lượng: ${count})`,
      })
    }
  }

  return { count }
}
