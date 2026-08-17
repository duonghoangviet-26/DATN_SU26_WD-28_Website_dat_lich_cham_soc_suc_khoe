import mongoose from 'mongoose'
import { LichHen, DanhGia, BacSi } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

// ─── GET /api/patient/reviews/pending ────────────────────────────────────────
// Danh sách lịch hẹn đã hoàn thành nhưng chưa có đánh giá
export async function getPendingReviews(req, res) {
  try {
    const userId = req.user.id

    // 1. Lấy tất cả lịch hẹn đã hoàn thành của bệnh nhân trong vòng 30 ngày
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const completedAppointments = await LichHen.find({
      user_id: userId,
      status: 'completed',
      ngay_kham: { $gte: thirtyDaysAgo },
    })
      .select('_id ma_lich_hen ngay_kham gio_kham gio_ket_thuc doctor_id specialty_id phong_kham')
      .populate('doctor_id', 'user_id diem_danh_gia tong_danh_gia')
      .populate('specialty_id', 'ten')
      .sort({ ngay_kham: -1 })
      .lean()

    if (completedAppointments.length === 0) {
      return ok(res, [])
    }

    // 2. Lấy danh sách appointment_id đã có đánh giá
    const appointmentIds = completedAppointments.map((a) => a._id)
    const existingReviews = await DanhGia.find({
      appointment_id: { $in: appointmentIds },
    })
      .select('appointment_id')
      .lean()

    const reviewedIds = new Set(existingReviews.map((r) => r.appointment_id.toString()))

    // 3. Lọc ra lịch hẹn chưa được đánh giá
    const pending = completedAppointments.filter(
      (a) => !reviewedIds.has(a._id.toString())
    )

    // 4. Populate thông tin bác sĩ (ho_ten, anh_dai_dien)
    const doctorIds = [...new Set(pending.map((a) => a.doctor_id?._id?.toString()).filter(Boolean))]
    const doctors = await mongoose.model('NguoiDung')
      .find({ _id: { $in: doctorIds.map((id) => pending.find((p) => p.doctor_id?._id?.toString() === id)?.doctor_id?.user_id).filter(Boolean) } })
      .select('ho_ten anh_dai_dien')
      .lean()

    // Build lookup: doctor ObjectId -> user info
    const doctorUserMap = new Map()
    for (const appt of pending) {
      if (appt.doctor_id?.user_id) {
        const userInfo = doctors.find((d) => d._id.toString() === appt.doctor_id.user_id.toString())
        if (userInfo) {
          doctorUserMap.set(appt.doctor_id._id.toString(), userInfo)
        }
      }
    }

    const result = pending.map((a) => {
      const doctorUser = doctorUserMap.get(a.doctor_id?._id?.toString())
      return {
        appointment_id: a._id,
        ma_lich_hen: a.ma_lich_hen,
        ngay_kham: a.ngay_kham,
        gio_kham: a.gio_kham,
        gio_ket_thuc: a.gio_ket_thuc,
        phong_kham: a.phong_kham,
        doctor: a.doctor_id
          ? {
              id: a.doctor_id._id,
              ho_ten: doctorUser?.ho_ten || 'Bác sĩ',
              anh_dai_dien: doctorUser?.anh_dai_dien || null,
            }
          : null,
        specialty: a.specialty_id
          ? { id: a.specialty_id._id, ten: a.specialty_id.ten }
          : null,
      }
    })

    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/reviews/my ─────────────────────────────────────────────
// Danh sách đánh giá đã gửi của bệnh nhân (phân trang)
export async function getMyReviews(req, res) {
  try {
    const userId = req.user.id
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10))
    const skip = (page - 1) * limit

    const filter = { user_id: userId, ngay_xoa: null }

    const [reviews, total] = await Promise.all([
      DanhGia.find(filter)
        .populate({
          path: 'appointment_id',
          select: 'ma_lich_hen ngay_kham gio_kham gio_ket_thuc specialty_id phong_kham',
          populate: { path: 'specialty_id', select: 'ten' },
        })
        .populate({
          path: 'doctor_id',
          select: 'user_id diem_danh_gia',
          populate: { path: 'user_id', select: 'ho_ten anh_dai_dien' },
        })
        .sort({ ngay_tao: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DanhGia.countDocuments(filter),
    ])

    const items = reviews.map((r) => ({
      id: r._id,
      so_sao: r.so_sao,
      chi_tiet: r.chi_tiet || {
        danh_gia_le_tan: r.so_sao || 5,
        danh_gia_bac_si: r.so_sao || 5,
        danh_gia_dich_vu: r.so_sao || 5,
      },
      noi_dung: r.noi_dung,
      status: r.status,
      ngay_tao: r.ngay_tao,
      appointment: r.appointment_id
        ? {
            ma_lich_hen: r.appointment_id.ma_lich_hen,
            ngay_kham: r.appointment_id.ngay_kham,
            gio_kham: r.appointment_id.gio_kham,
            gio_ket_thuc: r.appointment_id.gio_ket_thuc,
            phong_kham: r.appointment_id.phong_kham,
            specialty: r.appointment_id.specialty_id
              ? { ten: r.appointment_id.specialty_id.ten }
              : null,
          }
        : null,
      doctor: r.doctor_id?.user_id
        ? {
            id: r.doctor_id._id,
            ho_ten: r.doctor_id.user_id.ho_ten,
            anh_dai_dien: r.doctor_id.user_id.anh_dai_dien,
          }
        : null,
    }))

    return ok(res, {
      reviews: items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/patient/reviews ───────────────────────────────────────────────
// Tạo đánh giá mới — hỗ trợ đánh giá đa tiêu chí (lễ tân, bác sĩ, dịch vụ)
export async function createReview(req, res) {
  try {
    const userId = req.user.id
    const { appointment_id, so_sao, danh_gia_le_tan, danh_gia_bac_si, danh_gia_dich_vu, noi_dung } = req.body

    // Validate input
    if (!appointment_id) {
      return fail(res, 400, 'Vui lòng chọn lịch hẹn cần đánh giá.')
    }

    const leTan = danh_gia_le_tan ? Math.min(5, Math.max(1, parseInt(danh_gia_le_tan))) : (so_sao ? parseInt(so_sao) : 5)
    const bacSi = danh_gia_bac_si ? Math.min(5, Math.max(1, parseInt(danh_gia_bac_si))) : (so_sao ? parseInt(so_sao) : 5)
    const dichVu = danh_gia_dich_vu ? Math.min(5, Math.max(1, parseInt(danh_gia_dich_vu))) : (so_sao ? parseInt(so_sao) : 5)

    const calculatedAvg = Math.round(((leTan + bacSi + dichVu) / 3) * 10) / 10
    const finalSoSao = so_sao ? parseFloat(so_sao) : calculatedAvg

    if (!finalSoSao || finalSoSao < 1 || finalSoSao > 5) {
      return fail(res, 400, 'Số sao phải nằm trong khoảng từ 1 đến 5.')
    }
    if (noi_dung && noi_dung.length > 500) {
      return fail(res, 400, 'Nội dung đánh giá không được vượt quá 500 ký tự.')
    }

    // 1. Kiểm tra lịch hẹn thuộc về bệnh nhân này + đã hoàn thành
    const appointment = await LichHen.findOne({
      _id: appointment_id,
      user_id: userId,
    }).lean()

    if (!appointment) {
      return fail(res, 404, 'Không tìm thấy lịch hẹn hoặc lịch hẹn không thuộc về bạn.')
    }
    if (appointment.status !== 'completed') {
      return fail(res, 400, 'Chỉ có thể đánh giá lịch hẹn đã hoàn thành.')
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    if (new Date(appointment.ngay_kham) < thirtyDaysAgo) {
      return fail(res, 400, 'Lịch hẹn đã quá thời hạn 30 ngày để đánh giá.')
    }

    // 2. Kiểm tra chưa có đánh giá cho lịch hẹn này
    const existing = await DanhGia.findOne({ appointment_id }).lean()
    if (existing) {
      return fail(res, 400, 'Lịch hẹn này đã được đánh giá rồi.')
    }

    // 3. Lấy doctor_id từ lịch hẹn
    const doctorId = appointment.doctor_id
    if (!doctorId) {
      return fail(res, 400, 'Lịch hẹn này không có thông tin bác sĩ.')
    }

    // 4. Tạo đánh giá
    const review = await DanhGia.create({
      appointment_id,
      user_id: userId,
      doctor_id: doctorId,
      so_sao: finalSoSao,
      chi_tiet: {
        danh_gia_le_tan: leTan,
        danh_gia_bac_si: bacSi,
        danh_gia_dich_vu: dichVu,
      },
      noi_dung: noi_dung?.trim() || null,
      status: 'visible',
    })

    // 5. Cập nhật điểm đánh giá trung bình cho bác sĩ (lấy theo tiêu chí bác sĩ hoặc so_sao)
    const agg = await DanhGia.aggregate([
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

    const info = agg[0] || { trungBinhSao: 0, tongSo: 0 }
    await BacSi.updateOne(
      { _id: doctorId },
      {
        $set: {
          diem_danh_gia: Math.round(info.trungBinhSao * 10) / 10,
          tong_danh_gia: info.tongSo,
        },
      }
    )

    return created(res, {
      id: review._id,
      so_sao: review.so_sao,
      chi_tiet: review.chi_tiet,
      noi_dung: review.noi_dung,
      ngay_tao: review.ngay_tao,
    }, 'Đã gửi đánh giá thành công!')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
