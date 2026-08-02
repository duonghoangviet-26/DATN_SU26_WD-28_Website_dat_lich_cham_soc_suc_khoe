import mongoose from 'mongoose'
import LichHen from '../../models/LichHen.js'
import NguoiDung from '../../models/NguoiDung.js'
import LichLamViec from '../../models/LichLamViec.js'
import LichSuLichHen from '../../models/LichSuLichHen.js'
import ThanhToan from '../../models/ThanhToan.js'
import ThongBao from '../../models/ThongBao.js'
import BacSi from '../../models/BacSi.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'
import { checkInLichHen, layLichChoTiepNhan } from '../../services/checkIn.service.js'
import { apDungPhuongAn } from '../../services/appointmentReschedule.service.js'
import { sendNotificationEmail, isMailConfigured } from '../../services/mail.service.js'
import { cacMocCuaKhung } from '../../utils/clinicTime.js'

export const getAppointments = async (req, res) => {
  try {
    const { date, status, timeframe, search, doctor_id, page = 1, limit = 10 } = req.query
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 10
    const query = { loai_kham: 'clinic' }
    
    if (search) {
      const users = await NguoiDung.find({
        $or: [
          { ho_ten: { $regex: search, $options: 'i' } },
          { so_dien_thoai: { $regex: search, $options: 'i' } }
        ]
      }).select('_id')
      
      const userIds = users.map(u => u._id)
      
      query.$or = [
        { ma_lich_hen: { $regex: search, $options: 'i' } },
        { ten_khach: { $regex: search, $options: 'i' } },
        { so_dien_thoai_khach: { $regex: search, $options: 'i' } },
        { user_id: { $in: userIds } }
      ]
    }
    
    if (date) {
      query.ngay_kham = new Date(`${date}T00:00:00.000Z`)
    } else {
      const now = new Date()
      // Ép chuẩn về múi giờ Việt Nam (UTC+7) để Server không bị lạc ngày
      const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
      const todayString = vnTime.toISOString().split('T')[0]
      const todayUTC = new Date(`${todayString}T00:00:00.000Z`)
      
      const tomorrowVn = new Date(vnTime.getTime() + 24 * 60 * 60 * 1000)
      const tomorrowString = tomorrowVn.toISOString().split('T')[0]
      const tomorrowUTC = new Date(`${tomorrowString}T00:00:00.000Z`)

      if (timeframe === 'today') {
        query.ngay_kham = todayUTC
      } else if (timeframe === 'tomorrow') {
        query.ngay_kham = tomorrowUTC
      } else if (timeframe === 'upcoming') {
        query.ngay_kham = { $gt: todayUTC }
      } else if (timeframe === 'past') {
        query.ngay_kham = { $lt: todayUTC }
      }
    }
    
    if (status) query.status = status
    if (doctor_id) query.doctor_id = doctor_id

    let sortOption = { ngay_kham: 1, gio_kham: 1 }
    if (timeframe === 'past') {
      sortOption = { ngay_kham: -1, gio_kham: -1 }
    }

    const totalDocs = await LichHen.countDocuments(query)
    const totalPages = Math.ceil(totalDocs / limitNum)

    const appointments = await LichHen.find(query)
      .populate('user_id', 'ho_ten so_dien_thoai email anh_dai_dien')
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'ho_ten' }
      })
      .sort(sortOption)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      
    res.status(200).json({ 
      success: true, 
      data: appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalDocs,
        totalPages
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// Lễ tân tiếp nhận bệnh nhân tới quầy.
//
// ⚠️ Trước 2026-07-26 hàm này CHỈ đổi `status = 'checked_in'`. Bệnh nhân đặt online, đã thanh
// toán, tới quầy, lễ tân bấm "đã đến" — và không bao giờ xuất hiện trong hàng đợi của bác sĩ,
// vì hàng đợi neo trên collection `HangDoi` chứ không trên `LichHen.status`. Bác sĩ không có
// cách nào tiếp nhận họ; tệ hơn, rule mục 8 định nghĩa `no_show` = "hết ca mà không có bản ghi
// HangDoi" nên người đã tới quầy vẫn bị coi là không đến và mất 100% tiền (mục 5).
//
// Nay gọi CHUNG service check-in với bác sĩ (rule mục 7). Khác biệt duy nhất: lễ tân tiếp nhận
// cho cả phòng khám nên không truyền `restrictToDoctorId`.
export const markAsArrived = async (req, res) => {
  try {
    const { entry, appointment, trang_thai_cu, canh_bao } = await checkInLichHen({
      appointmentId: req.params.id,
      actorUserId: req.user?._id ?? req.user?.id ?? null,
      actorRole: 'receptionist',
    })

    // Create ThanhToan record if it doesn't exist
    const existingPayment = await ThanhToan.findOne({ appointment_id: appointment._id })
    if (!existingPayment && appointment.payment_status === 'unpaid') {
      await ThanhToan.create({
        appointment_id: appointment._id,
        benh_nhan_id: appointment.user_id,
        ma_giao_dich: `TXN${Date.now().toString().slice(-6)}`,
        so_tien: appointment.gia_kham || 200000,
        loai_thanh_toan: 'phi_dat_lich',
        phuong_thuc: 'tien_mat',
        status: 'pending',
        ngay_tao: new Date()
      })
    }

    emitDashboardAppointmentChanged(trang_thai_cu, appointment.status)

    res.status(200).json({
      success: true,
      message: 'Đã check-in bệnh nhân vào hàng đợi',
      data: appointment,
      hang_doi: {
        id: entry._id,
        doctor_id: entry.doctor_id,
        phong_kham: entry.phong_kham,
        gio_hen_goc: entry.gio_hen_goc,
        checkin_time: entry.checkin_time,
      },
      canh_bao,
    })
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

// GET /api/receptionist/appointments/pending-checkin — khách đã đặt hôm nay, chưa vào hàng đợi.
// Cùng nguồn dữ liệu với danh sách của bác sĩ, chỉ khác là không giới hạn theo một bác sĩ.
export const getPendingCheckin = async (req, res) => {
  try {
    const rows = await layLichChoTiepNhan({ ngay: req.query.date ?? null })
    res.status(200).json({ success: true, data: rows })
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

// Trần số lần khách tự xin dời (rule mục 5) — giống `patient/reschedule.controller.js`.
const TRAN_DOI_KHACH_YEU_CAU = 1

// Slot còn nhận được người mới. Cùng định nghĩa với `appointmentReschedule.service.js`.
function slotConTrong(slot) {
  return slot.status === 'active' && !slot.benh_nhan_id && !slot.bi_khoa_boi_nghi_phep
}

// Lễ tân dời lịch hộ khách.
//
// ⚠️ Bản trước bỏ qua gần hết mục 5/11 và có thể làm hỏng dữ liệu:
//   - Không kiểm mốc `T-30'` → khách sắp trễ nhờ lễ tân dời lúc `T-5'`, phòng khám mất
//     trắng chỗ vì không kịp bán lại (đúng chiêu mà mục 11 dựng mốc đó để chặn).
//   - `slots.find(s => s.gio_bat_dau === gio_kham)` lấy slot ĐẦU TIÊN trùng giờ: một khung
//     có nhiều slot (TMH 2 slot/khung) nên slot đầu có thể đã kín trong khi slot bên cạnh
//     còn trống → báo "đã kín" oan. Ngược lại nó cũng nhận cả slot `walk_in` và slot người
//     khác đang giữ chỗ, trong khi mục 5 chốt khách tự dời KHÔNG BAO GIỜ được lấn walk-in.
//   - Không kiểm lịch hẹn nào khác đã trỏ vào slot đó → đụng unique index
//     `uniq_lich_hen_theo_slot` và trả 500 thay vì thông báo đọc được.
//   - Đếm hạn mức bằng `so_lan_thay_doi` (đếm MỌI thay đổi) thay vì
//     `so_lan_doi_khach_yeu_cau`, nên một lần dời do lỗi phòng khám cũng ăn mất quyền dời
//     của khách — trái mục 5 ("lỗi phòng khám KHÔNG tính vào hạn mức").
//   - Trả slot cũ về `active` ngay trong cùng transaction, kể cả khi khung đã sát giờ.
//
// Nay dùng CHUNG `apDungPhuongAn()` với luồng bệnh nhân tự dời: một chỗ quyết định cách
// chiếm slot, khoá slot cũ, đặt `ly_do_doi`, đếm hạn mức và ghi nhật ký.
export const rescheduleAppointment = async (req, res) => {
  try {
    const { ngay_kham, gio_kham, ly_do_doi_lich, ly_do_doi } = req.body

    if (!ngay_kham || !gio_kham) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày và giờ khám mới' })
    }

    const appointment = await LichHen.findById(req.params.id).populate('user_id', 'email')
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
    }
    if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
      return res.status(409).json({ success: false, message: 'Lịch hẹn đã kết thúc, không dời được' })
    }

    // Đang có đề xuất của phòng khám (bác sĩ nghỉ/bận — mục 14, 15) thì phải xử lý đề xuất đó,
    // không dời tay chồng lên: chỗ của phương án đang được giữ sẵn cho khách.
    const deXuat = appointment.de_xuat_doi
    if (deXuat && ['cho_khach_chon', 'cho_admin_duyet'].includes(deXuat.trang_thai)) {
      return res.status(409).json({
        success: false,
        message: 'Lịch này đang có phương án dời do phòng khám đề xuất. Hãy xử lý đề xuất đó trước.',
      })
    }

    // `ly_do_doi` là trường BẮT BUỘC khi dời (mục 10.D) và quyết định hạn mức:
    //   khach_yeu_cau → tính vào trần 1 lần của khách, phải trước `T-30'`
    //   phong_kham    → KHÔNG tính hạn mức, không áp mốc `T-30'` (mục 15), nhưng phải có
    //                   người duyệt + lý do và được ghi nhật ký
    // Mặc định `khach_yeu_cau`: lễ tân dời hộ thì gần như luôn là khách yêu cầu, và chọn
    // mặc định này KHÔNG thể bị dùng để lách trần. Muốn `phong_kham` thì phải nói rõ.
    const laLoiPhongKham = ly_do_doi === 'phong_kham'
    const lyDoDoi = laLoiPhongKham ? 'phong_kham' : 'khach_yeu_cau'

    if (laLoiPhongKham && !ly_do_doi_lich?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Dời do lỗi phòng khám bắt buộc ghi lý do cụ thể (rule mục 5).',
      })
    }

    if (!laLoiPhongKham) {
      const daDung = appointment.so_lan_doi_khach_yeu_cau ?? 0
      if (daDung >= TRAN_DOI_KHACH_YEU_CAU) {
        return res.status(409).json({
          success: false,
          message: `Khách đã dùng hết ${TRAN_DOI_KHACH_YEU_CAU} lần dời lịch. Nếu đây là lỗi phòng khám, `
            + 'chọn lý do "phòng khám" kèm giải trình.',
        })
      }

      // Mốc `T-30'` của khung CŨ (mục 11). Chặn chiêu né mất tiền: sắp trễ mới xin dời thì
      // slot không kịp bán cho ai.
      const moc = cacMocCuaKhung(appointment.ngay_kham, appointment.gio_kham)
      if (!moc || Date.now() >= moc.dongDatOnline.getTime()) {
        return res.status(409).json({
          success: false,
          message: 'Đã quá hạn xin dời (trước giờ khám 30 phút). Khách vẫn được khám nếu tới trong ca '
            + 'và KHÔNG mất tiền.',
        })
      }
    }

    // ── Tìm slot đích ────────────────────────────────────────────────────────
    const ngayMoi = new Date(ngay_kham)
    if (Number.isNaN(ngayMoi.getTime())) {
      return res.status(400).json({ success: false, message: 'ngay_kham không hợp lệ' })
    }
    ngayMoi.setUTCHours(0, 0, 0, 0)

    const scheduleMoi = await LichLamViec.findOne({
      doctor_id: appointment.doctor_id,
      ngay: { $gte: ngayMoi, $lt: new Date(ngayMoi.getTime() + 86400000) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' },
    }).lean()

    if (!scheduleMoi) {
      return res.status(400).json({ success: false, message: 'Bác sĩ không có lịch làm việc vào ngày này' })
    }

    // Lịch hẹn khác đã trỏ vào slot nào thì slot đó hết chỗ, dù `status` trong lịch có lệch.
    const slotDaCoLich = new Set(
      (await LichHen.find({
        schedule_id: scheduleMoi._id,
        status: { $ne: 'cancelled' },
        _id: { $ne: appointment._id },
      }).select('slot_id').lean())
        .filter((a) => a.slot_id).map((a) => String(a.slot_id)),
    )

    // Quét MỌI slot trùng giờ, không lấy slot đầu tiên: một khung có nhiều slot.
    const slotTrungGio = scheduleMoi.slots.filter((s) => s.gio_bat_dau === gio_kham)
    if (slotTrungGio.length === 0) {
      return res.status(400).json({ success: false, message: `Bác sĩ không có khung ${gio_kham} trong ngày này` })
    }
    if (slotTrungGio.some((s) => String(s._id) === String(appointment.slot_id))) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày và giờ khác với lịch hẹn hiện tại' })
    }

    // Khách tự dời KHÔNG BAO GIỜ được lấn slot walk-in (mục 5, 15). Lỗi phòng khám thì mục 15
    // cho lấn nhưng có trần 1 slot/khung và phải ghi nhật ký — chưa hiện thực ở màn hình này,
    // nên tạm thời chặn cả hai chiều thay vì lấn không kiểm soát.
    const slotMoi = slotTrungGio.find(
      (s) => slotConTrong(s) && s.loai_slot !== 'walk_in' && !slotDaCoLich.has(String(s._id)),
    )
    if (!slotMoi) {
      const coWalkIn = slotTrungGio.some((s) => slotConTrong(s) && s.loai_slot === 'walk_in')
      return res.status(409).json({
        success: false,
        message: coWalkIn
          ? `Khung ${gio_kham} chỉ còn chỗ dành cho khách tới quầy, không dùng để dời lịch đặt trước.`
          : `Khung ${gio_kham} đã kín, vui lòng chọn khung khác.`,
      })
    }

    // ── Ghi ──────────────────────────────────────────────────────────────────
    const gioCu = appointment.gio_kham
    const ngayCu = appointment.ngay_kham
    const trangThaiCu = appointment.status

    let phongKhamCu = null
    if (appointment.schedule_id && appointment.slot_id) {
      const scheduleCu = await LichLamViec.findById(appointment.schedule_id).lean()
      if (scheduleCu && scheduleCu.slots) {
        const slotCu = scheduleCu.slots.find(s => String(s._id) === String(appointment.slot_id))
        if (slotCu) phongKhamCu = slotCu.phong_kham
      }
    }
    const phongKhamMoi = slotMoi.phong_kham || null

    await apDungPhuongAn({
      appointment,
      phuongAn: {
        loai: 'doi_khung',
        doctor_id: appointment.doctor_id,
        schedule_id: scheduleMoi._id,
        slot_id: slotMoi._id,
        ngay: scheduleMoi.ngay,
        gio_bat_dau: slotMoi.gio_bat_dau,
        lan_walk_in: false,
      },
      lyDoDoi,
      actorUserId: req.user?.id ?? req.user?._id ?? null,
    })

    // `ly_do_doi_lich` là mô tả tự do cho lễ tân đọc lại; `ly_do_doi` là phân loại nghiệp vụ.
    appointment.ly_do_doi_lich = ly_do_doi_lich?.trim()
      || (laLoiPhongKham ? 'Phòng khám dời lịch' : 'Khách yêu cầu dời lịch')
    await appointment.save()

    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: trangThaiCu,
      den_trang_thai: appointment.status,
      loai_thay_doi: 'reschedule',
      ly_do_thay_doi: appointment.ly_do_doi_lich,
      // Enum `vai_tro` chưa có 'receptionist' — giữ 'admin' như code cũ để không đổi schema
      // của thành viên khác. `nguoi_thay_doi_id` mới là căn cứ truy người thật.
      vai_tro: 'admin',
      kenh_thay_doi: 'web',
      ngay_kham_cu: ngayCu,
      ngay_kham_moi: appointment.ngay_kham,
      gio_kham_cu: gioCu,
      gio_kham_moi: appointment.gio_kham,
      phong_kham_cu: phongKhamCu,
      phong_kham_moi: phongKhamMoi,
      ly_do: `ly_do_doi=${lyDoDoi}`,
      nguoi_thay_doi_id: req.user?.id ?? req.user?._id ?? (appointment.user_id?._id || appointment.user_id),
    }])

    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };
    const roomStr = phongKhamMoi ? ` tại phòng ${phongKhamMoi}` : '';
    const noiDungThayDoi = `Phòng khám đã dời lịch hẹn của bạn sang ngày ${formatDate(appointment.ngay_kham)}, lúc ${appointment.gio_kham}${roomStr}.`;
    const tieuDeThayDoi = 'Lịch hẹn của bạn đã được thay đổi';

    if (appointment.user_id) {
      await ThongBao.create({
        user_id: appointment.user_id?._id || appointment.user_id,
        tieu_de: tieuDeThayDoi,
        noi_dung: noiDungThayDoi,
        loai: 'appointment',
        related_id: appointment._id,
        related_type: 'LichHen',
      });
    }

    const emailNhan = appointment.user_id?.email || appointment.email_khach;
    if (emailNhan && isMailConfigured()) {
      sendNotificationEmail({
        to: emailNhan,
        title: tieuDeThayDoi,
        content: noiDungThayDoi,
      }).catch(err => console.error('Lỗi khi gửi email dời lịch:', err));
    }

    res.status(200).json({
      success: true,
      message: laLoiPhongKham
        ? 'Đã dời lịch hẹn (lỗi phòng khám — không tính vào hạn mức của khách)'
        : `Đã dời lịch hẹn. Khách đã dùng ${appointment.so_lan_doi_khach_yeu_cau}/${TRAN_DOI_KHACH_YEU_CAU} lần dời.`,
      data: appointment,
      ly_do_doi: lyDoDoi,
      so_lan_doi_khach_yeu_cau: appointment.so_lan_doi_khach_yeu_cau,
    })
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

export const cancelAppointment = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { id } = req.params
    const { ly_do_huy } = req.body
    
    const appointment = await LichHen.findById(id).session(session)
    if (!appointment) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
    }

    if (['checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm', 'completed', 'cancelled', 'no_show', 'skipped'].includes(appointment.status)) {
      await session.abortTransaction()
      session.endSession()
      return res.status(409).json({ success: false, message: `Không thể hủy lịch hẹn ở trạng thái ${appointment.status}` })
    }
    
    const oldStatus = appointment.status
    appointment.status = 'cancelled'
    appointment.ly_do_huy = ly_do_huy || 'Lễ tân hủy lịch'
    appointment.huy_boi = 'admin'
    if (req.user && req.user._id) {
      appointment.nguoi_huy_id = req.user._id
    }
    
    // Giải phóng slot trong LichLamViec
    const { schedule_id, slot_id } = appointment
    if (schedule_id && slot_id) {
      const schedule = await LichLamViec.findById(schedule_id).session(session)
      if (schedule) {
        const slot = schedule.slots.id(slot_id)
        if (slot) {
          slot.status = 'active'
          await schedule.save({ session })
        }
      }
    }

    await appointment.save({ session })
    await session.commitTransaction()
    session.endSession()

    emitDashboardAppointmentChanged(oldStatus, appointment.status)
    
    res.status(200).json({ success: true, message: 'Đã hủy lịch hẹn', data: appointment })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getRescheduleHistory = async (req, res) => {
  try {
    const { id } = req.params
    const history = await LichSuLichHen.find({
      appointment_id: id,
      loai_thay_doi: 'reschedule'
    }).populate('nguoi_thay_doi_id', 'ho_ten')
      .sort({ thoi_diem: 1 })
    
    res.status(200).json({ success: true, data: history })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const bulkCancelAppointments = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { ids, reason } = req.body
    if (!ids || !ids.length) {
      return res.status(400).json({ success: false, message: 'Không có lịch hẹn nào được chọn' })
    }

    const appointments = await LichHen.find({ _id: { $in: ids }, status: { $in: ['pending', 'confirmed'] } }).populate('user_id', 'email')
    
    for (const appointment of appointments) {
      const oldStatus = appointment.status
      appointment.status = 'cancelled'
      appointment.ly_do_huy = reason || 'Hủy lịch hàng loạt'
      
      // Giai phong slot if needed
      if (appointment.schedule_id && appointment.slot_id) {
        const schedule = await LichLamViec.findById(appointment.schedule_id).session(session)
        if (schedule) {
          const slot = schedule.slots.id(appointment.slot_id)
          if (slot && String(slot.benh_nhan_id) === String(appointment.user_id?._id || appointment.user_id)) {
            slot.benh_nhan_id = null
            slot.benh_nhan_tam_giu_id = null
            slot.status = 'active'
            await schedule.save({ session })
          }
        }
      }
      
      await appointment.save({ session })

      await LichSuLichHen.create([{
        appointment_id: appointment._id,
        tu_trang_thai: oldStatus,
        den_trang_thai: 'cancelled',
        loai_thay_doi: 'cancel',
        ly_do_thay_doi: appointment.ly_do_huy,
        vai_tro: 'admin',
        kenh_thay_doi: 'web',
        nguoi_thay_doi_id: req.user?.id ?? req.user?._id ?? null,
      }], { session })
      
      emitDashboardAppointmentChanged(oldStatus, 'cancelled')
      
      // Notification
      const tieuDe = 'Lịch hẹn của bạn đã bị hủy'
      const noiDung = `Phòng khám đã hủy lịch hẹn ngày ${appointment.ngay_kham.toLocaleDateString('vi-VN')} lúc ${appointment.gio_kham}. Lý do: ${appointment.ly_do_huy}`
      
      if (appointment.user_id) {
        await ThongBao.create([{
          user_id: appointment.user_id._id,
          tieu_de: tieuDe,
          noi_dung: noiDung,
          loai: 'appointment',
          related_id: appointment._id,
          related_type: 'LichHen',
        }], { session })
      }
      
      const emailNhan = appointment.user_id?.email || appointment.email_khach
      if (emailNhan && isMailConfigured()) {
        sendNotificationEmail({
          to: emailNhan,
          title: tieuDe,
          content: noiDung,
        }).catch(err => console.error(err))
      }
    }
    
    await session.commitTransaction()
    session.endSession()
    res.status(200).json({ success: true, message: `Đã hủy ${appointments.length} lịch hẹn` })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(500).json({ success: false, message: error.message })
  }
}

export const bulkRescheduleAppointments = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { ids, startDate, startTime, reason } = req.body
    if (!ids || !ids.length || !startDate) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin dời lịch' })
    }

    const appointments = await LichHen.find({ _id: { $in: ids }, status: { $in: ['pending', 'confirmed'] } })
      .populate('user_id', 'email')
      .sort({ ngay_kham: 1, gio_kham: 1 })
      
    let assignedCount = 0
    let startSearchDate = new Date(startDate)
    startSearchDate.setHours(0, 0, 0, 0)
    
    // Find booked slots to avoid conflict
    const getBookedSlotIds = async () => {
      const booked = await LichHen.find({ status: { $ne: 'cancelled' } }).select('slot_id').lean()
      return new Set(booked.filter(a => a.slot_id).map(a => String(a.slot_id)))
    }
    
    const bookedSlots = await getBookedSlotIds()
    
    for (const appointment of appointments) {
      const oldStatus = appointment.status
      const ngayCu = appointment.ngay_kham
      const gioCu = appointment.gio_kham
      
      // Giải phóng slot cũ trước (cục bộ trong memory/session) để nếu chính nó được xếp lại cùng lịch thì ko bị lỗi
      if (appointment.schedule_id && appointment.slot_id) {
        const schedule = await LichLamViec.findById(appointment.schedule_id).session(session)
        if (schedule) {
          const slot = schedule.slots.id(appointment.slot_id)
          if (slot) {
            slot.benh_nhan_id = null
            slot.benh_nhan_tam_giu_id = null
            slot.status = 'active'
            await schedule.save({ session })
            bookedSlots.delete(String(slot._id))
          }
        }
      }
      
      // Auto-fill spill-over logic
      let newSlotFound = false
      let searchDate = new Date(startSearchDate)
      const maxDaysToSearch = 14 // Try up to 14 days forward
      
      for (let dayOffset = 0; dayOffset < maxDaysToSearch; dayOffset++) {
        const currentDate = new Date(searchDate.getTime() + dayOffset * 86400000)
        
        // Lấy tất cả lịch làm việc trong ngày này cho chuyên khoa của appointment
        const schedules = await LichLamViec.find({
          ngay: { $gte: currentDate, $lt: new Date(currentDate.getTime() + 86400000) },
          trang_thai_ngay: 'lam_viec',
          trang_thai_xac_nhan: { $ne: 'tu_choi' }
        }).populate('doctor_id').session(session)
        
        for (const schedule of schedules) {
          // Bỏ qua nếu ko đúng chuyên khoa (nếu appointment có specialty_id)
          if (appointment.specialty_id) {
             const bacSi = await BacSi.findById(schedule.doctor_id).session(session)
             if (!bacSi || !bacSi.specialties.includes(appointment.specialty_id)) continue
          }
          
          const availableSlot = schedule.slots.find(s => {
            if (dayOffset === 0 && startTime && s.gio_bat_dau < startTime) {
              return false;
            }
            return s.status === 'active' && 
                   !s.benh_nhan_id && 
                   !s.bi_khoa_boi_nghi_phep &&
                   !bookedSlots.has(String(s._id));
          })
          
          if (availableSlot) {
            // Assign this slot
            availableSlot.benh_nhan_id = appointment.user_id?._id || appointment.user_id
            await schedule.save({ session })
            bookedSlots.add(String(availableSlot._id))
            
            appointment.schedule_id = schedule._id
            appointment.slot_id = availableSlot._id
            appointment.doctor_id = schedule.doctor_id
            appointment.ngay_kham = schedule.ngay
            appointment.gio_kham = availableSlot.gio_bat_dau
            appointment.ly_do_doi_lich = reason || 'Dời lịch hàng loạt (Auto-fill)'
            
            // Xử lý phòng khám
            const phongKhamMoi = availableSlot.phong_id ? (await mongoose.model('MauLichLamViec').findOne({'ca_kham.phong_id': availableSlot.phong_id})).ca_kham.find(c => String(c.phong_id) === String(availableSlot.phong_id))?.ten_phong : null;
            
            await appointment.save({ session })
            
            await LichSuLichHen.create([{
              appointment_id: appointment._id,
              tu_trang_thai: oldStatus,
              den_trang_thai: appointment.status,
              loai_thay_doi: 'reschedule',
              ly_do_thay_doi: appointment.ly_do_doi_lich,
              vai_tro: 'admin',
              kenh_thay_doi: 'web',
              ngay_kham_cu: ngayCu,
              ngay_kham_moi: appointment.ngay_kham,
              gio_kham_cu: gioCu,
              gio_kham_moi: appointment.gio_kham,
              phong_kham_moi: phongKhamMoi,
              nguoi_thay_doi_id: req.user?.id ?? req.user?._id ?? null,
            }], { session })
            
            // Notify
            const tieuDe = 'Lịch hẹn của bạn đã được thay đổi'
            const noiDung = `Phòng khám đã tự động dời lịch hẹn của bạn sang ngày ${new Date(appointment.ngay_kham).toLocaleDateString('vi-VN')} lúc ${appointment.gio_kham}.`
            if (appointment.user_id) {
              await ThongBao.create([{
                user_id: appointment.user_id._id,
                tieu_de: tieuDe,
                noi_dung: noiDung,
                loai: 'appointment',
                related_id: appointment._id,
                related_type: 'LichHen',
              }], { session })
            }
            const emailNhan = appointment.user_id?.email || appointment.email_khach
            if (emailNhan && isMailConfigured()) {
               sendNotificationEmail({ to: emailNhan, title: tieuDe, content: noiDung }).catch(console.error)
            }
            
            newSlotFound = true
            assignedCount++
            break // Done with this appointment
          }
        }
        
        if (newSlotFound) break
      }
    }
    
    await session.commitTransaction()
    session.endSession()
    res.status(200).json({ success: true, message: `Đã dời thành công ${assignedCount}/${appointments.length} lịch hẹn` })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(500).json({ success: false, message: error.message })
  }
}

export default {
  getAppointments,
  markAsArrived,
  getPendingCheckin,
  rescheduleAppointment,
  cancelAppointment,
  getRescheduleHistory,
  bulkCancelAppointments,
  bulkRescheduleAppointments
}
