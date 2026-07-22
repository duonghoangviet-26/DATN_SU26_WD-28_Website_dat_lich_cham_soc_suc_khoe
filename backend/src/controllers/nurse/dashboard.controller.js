import { NguoiDung, LichLamViec, LichHen, KetQuaKham, ThanhVien } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// Dashboard y tá — Routes: GET /api/nurse/dashboard
// Toàn bộ số liệu lọc theo nurse_id = req.user.id (từ token), không tin FE.
// ============================================================

export async function getDashboard(req, res) {
  try {
    const nurseId = req.user.id
    const nurse = await NguoiDung.findById(nurseId).select('ho_ten').lean()

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1)

    // Bác sĩ/phòng đang hỗ trợ hôm nay — từ LichLamViec.nurse_id (gán theo ngày, mục 4 thiết kế)
    const scheduleToday = await LichLamViec.find({ nurse_id: nurseId, ngay: { $gte: todayStart, $lt: todayEnd } })
      .populate({ path: 'doctor_id', select: 'phong_kham_mac_dinh specialties', populate: [{ path: 'user_id', select: 'ho_ten' }, { path: 'specialties', select: 'ten' }] })
      .lean()

    const bac_si_ho_tro = scheduleToday
      .filter((s) => s.doctor_id)
      .map((s) => ({
        doctor_id: s.doctor_id._id,
        ten_bac_si: s.doctor_id.user_id?.ho_ten ?? null,
        chuyen_khoa: (s.doctor_id.specialties || []).map((sp) => sp.ten).join(', ') || null,
        phong_kham: s.doctor_id.phong_kham_mac_dinh ?? null,
      }))

    // Lịch hẹn hôm nay thuộc ca của y tá này — lọc theo các BÁC SĨ y tá trực hôm nay
    // (LichLamViec.nurse_id qua scheduleToday), KHÔNG dựa LichHen.nurse_id (không được gán
    // lúc đặt online) — nhất quán với appointments/queue.
    const doctorIdsToday = scheduleToday.filter((s) => s.doctor_id).map((s) => String(s.doctor_id._id))
    const apptsToday = doctorIdsToday.length === 0 ? [] : await LichHen.find({
      doctor_id: { $in: doctorIdsToday },
      ngay_kham: { $gte: todayStart, $lt: todayEnd },
    }).select('_id status trang_thai_den ma_lich_hen gio_kham member_id ten_khach').lean()

    // Tổng lịch hôm nay (KHÔNG tính hủy/không đến).
    const tong_lich_hom_nay = apptsToday.filter((a) => !['cancelled', 'no_show'].includes(a.status)).length
    // Cần tiếp nhận = CHƯA đến: còn ở pending/confirmed và chưa đánh dấu đã đến (trang_thai_den).
    // "Đã đến" dựa trên trang_thai_den (đặt khi check-in), KHÔNG suy từ trạng thái đặt lịch.
    const can_tiep_nhan = apptsToday.filter((a) =>
      ['pending', 'confirmed'].includes(a.status) && a.trang_thai_den !== 'da_den',
    ).length
    const dang_kham = apptsToday.filter((a) => a.status === 'in_progress').length

    // Chờ nhập hồ sơ: đã KẾT THÚC khám (waiting_record) nhưng CHƯA có KetQuaKham.
    // (Bỏ 'confirmed'/'completed' của bản cũ — confirmed là chưa khám nên bị thổi phồng.)
    const apptIdsToday = apptsToday.map((a) => a._id)
    const recordedApptIds = new Set(
      (await KetQuaKham.find({ appointment_id: { $in: apptIdsToday } }).select('appointment_id').lean())
        .map((r) => String(r.appointment_id)),
    )
    const cho_nhap_ho_so = apptsToday.filter((a) =>
      a.status === 'waiting_record' && !recordedApptIds.has(String(a._id)),
    ).length

    // Hồ sơ theo trạng thái — do CHÍNH y tá này nhập (không tính theo ngày, hồ sơ có thể tồn từ hôm trước)
    const myRecords = await KetQuaKham.find({ nguoi_nhap_id: nurseId }).select('status').lean()
    const ho_so_cho_xac_nhan = myRecords.filter((r) => r.status === 'cho_xac_nhan').length
    const ho_so_can_sua = myRecords.filter((r) => r.status === 'yeu_cau_chinh_sua').length
    const ho_so_da_xac_nhan = myRecords.filter((r) => r.status === 'da_xac_nhan').length

    // Danh sách gần nhất trong hàng đợi hôm nay (tối đa 5, sắp theo giờ hẹn — xem ghi chú giới
    // hạn "chưa có checkin_time thật" trong nurse/appointments.controller.js).
    // waiting_record thêm vào vì đây chính xác là việc y tá cần làm tiếp — không thêm 'skipped'
    // vào preview này vì đã là trạng thái kết thúc, không phải việc "gần nhất cần chú ý".
    const queueSample = apptsToday
      .filter((a) => ['confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm'].includes(a.status))
      .sort((a, b) => a.gio_kham.localeCompare(b.gio_kham))
      .slice(0, 5)

    const memberIds = queueSample.filter((a) => a.member_id).map((a) => a.member_id)
    const members = await ThanhVien.find({ _id: { $in: memberIds } }).select('ho_ten').lean()
    const memberNameById = new Map(members.map((m) => [String(m._id), m.ho_ten]))

    const hang_doi_gan_nhat = queueSample.map((a) => ({
      id: a._id,
      ma_lich_hen: a.ma_lich_hen ?? null,
      benh_nhan: (a.member_id ? memberNameById.get(String(a.member_id)) : null) ?? a.ten_khach ?? 'Không rõ',
      gio_kham: a.gio_kham,
      status: a.status,
    }))

    return ok(res, {
      ten_y_ta: nurse?.ho_ten ?? null,
      ngay_hien_tai: new Date(),
      bac_si_ho_tro,
      tong_lich_hom_nay,
      can_tiep_nhan,
      dang_kham,
      cho_nhap_ho_so,
      ho_so_cho_xac_nhan,
      ho_so_can_sua,
      ho_so_da_xac_nhan,
      hang_doi_gan_nhat,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
