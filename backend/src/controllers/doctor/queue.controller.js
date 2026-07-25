import mongoose from 'mongoose'
import { HangDoi, LichHen, LichLamViec, TrangThaiPhongKham, ThanhVien, NhatKyThaoTac, ThongBao, NguoiDung, BacSi } from '../../models/index.js'
import {
  daToiKhungCuaMinh,
  soSanhThuTuHangDoi,
  tinhBacUuTienDong,
  tinhMucUuTien,
} from '../../models/HangDoi.js'
import { ok, created, fail } from '../../utils/response.js'
import { findOrCreateRoomStatus } from './room-status.controller.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'
import { buildSlotDateTime } from '../../utils/clinicTime.js'
import { kiemTraQuaTai } from '../../services/queueOverflow.service.js'

// ============================================================
// Hàng đợi động (Bác sĩ) — Routes: /api/doctor/queue
// Online + offline ĐỒNG NHẤT trong 1 collection HangDoi — chỉ khác nhánh muc_uu_tien.
// KHÔNG lưu thu_tu — sort động app-side (muc_uu_tien -> checkin_time).
// Bác sĩ chỉ thao tác trên hàng đợi của chính mình (docId = BacSi._id của req.user).
// ============================================================

const CON_HIEN_DIEN = ['dang_cho', 'da_goi']
const DANG_XU_LY = ['dang_cho', 'da_goi', 'trong_phong']

async function getDocId(userId) {
  const d = await BacSi.findOne({ user_id: userId }).select('_id').lean()
  return d?._id ?? null
}

function getTodayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

async function updateAppointmentStatus(appointmentId, nextStatus) {
  const appointment = await LichHen.findById(appointmentId).select('status')
  if (!appointment) return
  const oldStatus = appointment.status
  appointment.status = nextStatus
  await appointment.save()
  emitDashboardAppointmentChanged(oldStatus, nextStatus)
}

// Sắp xếp theo bậc ưu tiên ĐỘNG (rule mục 6) — KHÔNG dùng `muc_uu_tien` lưu trong DB.
// Giá trị lưu cứng đó là snapshot lúc check-in; dùng nó để xếp thứ tự sẽ phạt oan người
// đến sớm và không bao giờ tự nâng bậc khi tới khung.
function sapXepHangDoi(list, now = new Date()) {
  return [...list].sort((a, b) => soSanhThuTuHangDoi(a, b, now))
}

// gio_hen_goc quyet dinh BAC UU TIEN hang doi (rule §6) nen sai gio la sai thu tu goi benh nhan.
// Comment cu o day ghi "local — KHONG dung setUTCHours (tranh lech mui gio)" la HIEU NHAM:
// config/timezone.js ep TZ=UTC toan tien trinh nen setHours() CHINH LA setUTCHours() -> van lech
// 7 tieng. Nay dung ham chuan (tru 7) trong utils/clinicTime.js.
function buildGioHenGoc(ngayKham, gioKham) {
  if (!gioKham) return null
  return buildSlotDateTime(ngayKham, gioKham)
}

async function ghiAuditQueue(doctorUserId, hanhDong, entryId, duLieuCu, duLieuMoi) {
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: doctorUserId,
    vai_tro: 'doctor',
    hanh_dong: hanhDong,
    loai_doi_tuong: 'queue_entry',
    doi_tuong_id: entryId,
    du_lieu_cu: duLieuCu,
    du_lieu_moi: duLieuMoi,
  })
}

async function timEntryCuaMinh(entryId, docId) {
  const entry = await HangDoi.findById(entryId)
  if (!entry) return { entry: null, error: [404, 'Không tìm thấy hàng đợi'] }
  if (String(entry.doctor_id) !== String(docId)) {
    return { entry: null, error: [403, 'Hàng đợi này không thuộc lịch của bạn'] }
  }
  return { entry, error: null }
}

async function tinhCanhBaoQuaTai(doctorId, todayStart) {
  const schedule = await LichLamViec.findOne({ doctor_id: doctorId, ngay: todayStart }).lean()
  if (!schedule?.slots?.length) return null
  const gioKetThucCa = schedule.slots.reduce((max, s) => (s.gio_ket_thuc > max ? s.gio_ket_thuc : max), '00:00')
  // Gio ket thuc ca cung la gio phong kham -> dung ham chuan, khong setHours truc tiep.
  const ketThucCa = buildSlotDateTime(todayStart, gioKetThucCa)
  if (!ketThucCa) return null

  const room = await TrangThaiPhongKham.findOne({ doctor_id: doctorId, ngay: todayStart }).lean()
  const tbPhut = room?.thoi_gian_kham_tb_phut ?? 20
  const soDangPhucVu = await HangDoi.countDocuments({ doctor_id: doctorId, trang_thai: { $in: DANG_XU_LY } })
  const duKienXong = new Date(Date.now() + (soDangPhucVu + 1) * tbPhut * 60000)

  // Hai loại cảnh báo khác nhau, gộp lại cho người dùng thấy đủ:
  //  - QUÁ TẢI DỰ KIẾN: ước lượng tương lai, "kiểu này sẽ xong sau giờ đóng ca".
  //  - ĐỘ TRỄ TÍCH LUỸ: sự thật hiện tại, "người khung 09:00 vẫn chưa được gọi lúc 09:35".
  //    Chính con số này quyết định có ngừng bán chỗ hay không (rule mục 6).
  const canhBao = []
  if (duKienXong > ketThucCa) {
    canhBao.push(`Dự kiến xong lúc ${duKienXong.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}, sau giờ kết thúc ca (${gioKetThucCa}). Cân nhắc hẹn đợt sau.`)
  }

  const quaTai = await kiemTraQuaTai(doctorId)
  if (quaTai.canhBao) canhBao.push(quaTai.canhBao)

  return canhBao.length > 0 ? canhBao.join(' ') : null
}

// ─── POST /api/doctor/queue/checkin ──────────────────────────────────────────
export async function checkin(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { appointment_id, ten_benh_nhan, so_dien_thoai, tuoi, gioi_tinh, specialty_id } = req.body
    const { start: todayStart, end: todayEnd } = getTodayRange()
    const now = new Date()

    let payload
    let appt = null
    let apptOldStatus = null

    if (appointment_id) {
      // ── Online: bám theo LichHen đã đặt trước ──────────────────────────
      appt = await LichHen.findById(appointment_id)
      if (!appt) return fail(res, 404, 'Không tìm thấy lịch hẹn')
      if (String(appt.doctor_id) !== String(docId)) {
        return fail(res, 403, 'Lịch hẹn không thuộc lịch của bạn')
      }
      if (appt.ngay_kham < todayStart || appt.ngay_kham >= todayEnd) {
        return fail(res, 409, 'Lịch hẹn không phải của hôm nay')
      }
      if (['cancelled', 'no_show', 'completed', 'skipped'].includes(appt.status)) {
        return fail(res, 409, `Không thể check-in lịch hẹn đang ở trạng thái ${appt.status}`)
      }
      const exists = await HangDoi.findOne({ appointment_id: appt._id })
      if (exists) return fail(res, 409, 'Lịch hẹn này đã có trong hàng đợi')

      const member = appt.member_id ? await ThanhVien.findById(appt.member_id).select('ho_ten ngay_sinh gioi_tinh').lean() : null
      const gioHenGoc = buildGioHenGoc(appt.ngay_kham, appt.gio_kham)
      const mucUuTien = tinhMucUuTien('online', now, gioHenGoc)

      payload = {
        nguon: 'online',
        appointment_id: appt._id,
        member_id: appt.member_id ?? null,
        ten_benh_nhan: member?.ho_ten ?? appt.ten_khach ?? 'Không rõ',
        so_dien_thoai: appt.so_dien_thoai_khach ?? null,
        tuoi: member?.ngay_sinh ? new Date().getFullYear() - new Date(member.ngay_sinh).getFullYear() : null,
        gioi_tinh: member?.gioi_tinh ?? null,
        specialty_id: appt.specialty_id,
        doctor_id: appt.doctor_id,
        phong_kham: appt.phong_kham,
        muc_uu_tien: mucUuTien,
        gio_hen_goc: gioHenGoc,
        checkin_time: now,
        nguoi_tiep_nhan_id: req.user.id,
        vai_tro_tiep_nhan: 'doctor',
      }

      apptOldStatus = appt.status
      appt.gio_den_thuc_te = now
      appt.trang_thai_den = 'da_den'
      if (appt.status === 'pending') appt.status = 'confirmed'
      // appt.save() dời xuống dưới — ghi cùng HangDoi.create trong 1 transaction (nguyên tử).
      // Emit realtime cho dashboard admin đặt SAU khi transaction commit (xem dưới).
    } else {
      // ── Offline: khách vãng lai / đến trực tiếp ────────────────────────
      if (!ten_benh_nhan?.trim() || !so_dien_thoai?.trim()) {
        return fail(res, 400, 'Offline bắt buộc có ten_benh_nhan và so_dien_thoai')
      }
      const schedule = await LichLamViec.findOne({ doctor_id: docId, ngay: todayStart }).lean()
      const phongKham = schedule?.slots?.[0]?.phong_kham ?? null
      const resolvedSpecialtyId = specialty_id ?? schedule?.slots?.[0]?.specialty_id ?? null
      if (!resolvedSpecialtyId) return fail(res, 400, 'Không xác định được chuyên khoa cho lịch offline')

      payload = {
        nguon: 'offline',
        ten_benh_nhan: ten_benh_nhan.trim(),
        so_dien_thoai: so_dien_thoai.trim(),
        tuoi: tuoi ?? null,
        gioi_tinh: gioi_tinh ?? null,
        specialty_id: resolvedSpecialtyId,
        doctor_id: docId,
        phong_kham: phongKham,
        muc_uu_tien: tinhMucUuTien('offline', now, null),
        gio_hen_goc: null,
        checkin_time: now,
        nguoi_tiep_nhan_id: req.user.id,
        vai_tro_tiep_nhan: 'doctor',
      }
    }

    // Online: LichHen (trang_thai_den/status) + HangDoi.create phải NGUYÊN TỬ — nếu tạo lượt lỗi
    // sau khi đã đánh dấu "đã đến" thì rollback cả hai (tránh lịch 'da_den' mà không có lượt khám).
    // Offline: chỉ 1 lượt ghi (HangDoi) — không cần transaction.
    let entry
    if (appt) {
      const session = await mongoose.startSession()
      try {
        await session.withTransaction(async () => {
          await appt.save({ session })
          const [e] = await HangDoi.create([payload], { session })
          entry = e
        })
      } finally {
        await session.endSession()
      }
    } else {
      entry = await HangDoi.create(payload)
    }

    // Online: sau khi lịch + lượt đã ghi nguyên tử, mới báo realtime cho dashboard admin.
    if (appt) emitDashboardAppointmentChanged(apptOldStatus, appt.status)

    // Cảnh báo quá tải (không chặn — quyết định đã chốt)
    const canhBao = await tinhCanhBaoQuaTai(payload.doctor_id, todayStart)

    return created(res, { entry, canh_bao_qua_tai: canhBao }, 'Đã check-in vào hàng đợi')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/doctor/queue-actions?status= ───────────────────────────────────
// Hàng đợi động chi tiết (khác GET /api/doctor/queue = examQueue, dùng cho UI danh sách
// hồ sơ chờ khám). Endpoint này trả kèm thời gian chờ ước tính, dùng cho các action
// gọi/vào phòng/kết thúc/bỏ lượt/hủy.
export async function list(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { status } = req.query
    const filter = { doctor_id: docId }
    filter.trang_thai = status || { $in: [...DANG_XU_LY, 'skipped', 'cancelled', 'hoan_thanh'] }

    const entries = await HangDoi.find(filter).lean()
    const room = await TrangThaiPhongKham.findOne({ doctor_id: docId }).lean()
    const tbPhut = room?.thoi_gian_kham_tb_phut ?? 20
    const now = new Date()

    const sorted = sapXepHangDoi(entries, now)
    let viTriChoDangCho = 0
    const result = sorted.map((e) => {
      const isWaiting = CON_HIEN_DIEN.includes(e.trang_thai)
      if (isWaiting) viTriChoDangCho++
      return {
        id: e._id,
        nguon: e.nguon,
        ten_benh_nhan: e.ten_benh_nhan,
        tuoi: e.tuoi,
        gioi_tinh: e.gioi_tinh,
        doctor_id: e.doctor_id,
        phong_kham: e.phong_kham,
        // Bậc ĐANG có hiệu lực, không phải snapshot lúc check-in.
        muc_uu_tien: tinhBacUuTienDong(e, now),
        muc_uu_tien_luc_checkin: e.muc_uu_tien,
        gio_hen_goc: e.gio_hen_goc,
        da_toi_khung: daToiKhungCuaMinh(e, now),
        trang_thai: e.trang_thai,
        checkin_time: e.checkin_time,
        so_lan_goi: e.so_lan_goi,
        thoi_gian_cho_uoc_tinh_phut: isWaiting ? viTriChoDangCho * tbPhut : null,
      }
    })
    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/queue/:id/call ────────────────────────────────────────
export async function call(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaMinh(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Chỉ gọi được bệnh nhân đang chờ hoặc đã gọi trước đó')
    }

    // Đến sớm KHÔNG bị phạt, nhưng cũng KHÔNG được gọi trước đầu khung của mình —
    // ngoại lệ duy nhất là bác sĩ đang rảnh và không còn ai thuộc khung hiện tại
    // (rule mục 6). `so_lan_goi > 0` = đã gọi rồi, gọi lại luôn được.
    const now = new Date()
    if (entry.so_lan_goi === 0 && !daToiKhungCuaMinh(entry, now)) {
      const dsChoKhac = await HangDoi.find({
        doctor_id: docId,
        trang_thai: 'dang_cho',
        _id: { $ne: entry._id },
      }).select('nguon gio_hen_goc checkin_time trang_thai').lean()

      const daToiLuot = dsChoKhac.filter((e) => daToiKhungCuaMinh(e, now))
      if (daToiLuot.length > 0) {
        const gioKhung = new Date(entry.gio_hen_goc).toLocaleTimeString('vi-VN', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
        })
        return fail(
          res,
          409,
          `Bệnh nhân này đến sớm, khung ${gioKhung} chưa tới. Còn ${daToiLuot.length} người đã tới lượt đang chờ — `
          + 'gọi họ trước, hoặc chờ tới khung của bệnh nhân này.',
        )
      }
    }

    const tu = entry.trang_thai
    entry.trang_thai = 'da_goi'
    entry.so_lan_goi += 1
    entry.thoi_diem_goi = new Date()
    await entry.save()

    await ghiAuditQueue(req.user.id, 'CALL_PATIENT', entry._id, { trang_thai: tu }, { trang_thai: 'da_goi', so_lan_goi: entry.so_lan_goi })

    const reception = await NguoiDung.findOne({ role: 'receptionist' }).select('_id').lean()
    if (reception) {
      const room = await findOrCreateRoomStatus(entry.doctor_id)
      await ThongBao.create({
        user_id: reception._id,
        tieu_de: 'Gọi bệnh nhân vào phòng',
        noi_dung: `${entry.ten_benh_nhan} — Phòng ${room.phong_kham ?? '?'} — mời dẫn bệnh nhân vào.`,
        loai: 'appointment',
        related_id: entry._id,
        related_type: 'hang_doi',
        ngay_gui_du_kien: new Date(),
      })
    }

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai, so_lan_goi: entry.so_lan_goi }, 'Đã gọi bệnh nhân')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/queue/:id/into-room ───────────────────────────────────
// Presence-gate: chỉ entry đang CON_HIEN_DIEN (dang_cho/da_goi) mới được vào phòng.
export async function intoRoom(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaMinh(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Bệnh nhân phải đang có mặt (chờ hoặc đã gọi) mới vào được phòng')
    }

    const room = await findOrCreateRoomStatus(entry.doctor_id)
    if (room.trang_thai !== 'san_sang') {
      return fail(res, 409, `Phòng chưa sẵn sàng (đang: ${room.trang_thai})`)
    }

    const tuRoom = room.trang_thai // chụp trước khi đổi — dùng cho nhật ký
    // HangDoi + phòng khám + LichHen.status NGUYÊN TỬ: nếu cập nhật LichHen lỗi sau khi đã đổi
    // hàng đợi/phòng thì rollback tất cả (tránh lịch kẹt 'confirmed' còn hàng đợi 'trong_phong').
    let apptOldStatus = null
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        entry.trang_thai = 'trong_phong'
        entry.thoi_diem_vao_phong = new Date()
        await entry.save({ session })

        room.trang_thai = 'dang_kham'
        room.benh_nhan_hien_tai_id = entry._id
        room.nguoi_dieu_khien_id = req.user.id
        room.nguoi_dieu_khien_vai_tro = 'doctor'
        room.thoi_diem_doi = new Date()
        await room.save({ session })

        if (entry.appointment_id) {
          const appt = await LichHen.findById(entry.appointment_id).select('status').session(session)
          if (appt) {
            apptOldStatus = appt.status
            appt.status = 'in_progress'
            await appt.save({ session })
          }
        }
      })
    } finally {
      await session.endSession()
    }
    // Sau commit mới báo realtime (đặt ngoài transaction để tránh emit lặp nếu retry).
    if (apptOldStatus) emitDashboardAppointmentChanged(apptOldStatus, 'in_progress')

    // Nhật ký best-effort — ngoài transaction, lỗi ghi log không làm rollback trạng thái nghiệp vụ.
    await ghiAuditQueue(req.user.id, 'CALL_PATIENT', entry._id, { trang_thai: 'da_goi' }, { trang_thai: 'trong_phong' })
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id, vai_tro: 'doctor', hanh_dong: 'CHANGE_DOCTOR_STATUS',
      loai_doi_tuong: 'room_status', doi_tuong_id: entry.doctor_id,
      du_lieu_cu: { trang_thai: tuRoom }, du_lieu_moi: { trang_thai: 'dang_kham' },
    })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Bệnh nhân đã vào phòng')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/queue/:id/finish ──────────────────────────────────────
export async function finish(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaMinh(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (entry.trang_thai !== 'trong_phong') {
      return fail(res, 409, 'Chỉ kết thúc được lịch đang trong phòng')
    }

    const room = await findOrCreateRoomStatus(entry.doctor_id)
    if (String(room.benh_nhan_hien_tai_id) !== String(entry._id)) {
      return fail(res, 409, 'Bệnh nhân này không khớp với người đang trong phòng')
    }

    const tuRoom = room.trang_thai // chụp trước khi đổi — dùng cho nhật ký
    // HangDoi + phòng + LichHen.status NGUYÊN TỬ: nếu cập nhật LichHen lỗi sau khi đã đổi hàng đợi
    // thì rollback (tránh lượt 'hoan_thanh' mà lịch chưa 'waiting_record').
    let apptOldStatus = null
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        entry.trang_thai = 'hoan_thanh'
        entry.thoi_diem_ket_thuc = new Date()
        await entry.save({ session })

        room.trang_thai = 'dang_don_phong'
        room.benh_nhan_hien_tai_id = null
        room.thoi_diem_doi = new Date()
        if (entry.thoi_diem_vao_phong) {
          const phutThucTe = Math.max(1, Math.round((entry.thoi_diem_ket_thuc - entry.thoi_diem_vao_phong) / 60000))
          room.thoi_gian_kham_tb_phut = Math.round(0.7 * room.thoi_gian_kham_tb_phut + 0.3 * phutThucTe)
        }
        await room.save({ session })

        if (entry.appointment_id) {
          const appt = await LichHen.findById(entry.appointment_id).select('status').session(session)
          if (appt) {
            apptOldStatus = appt.status
            appt.status = 'waiting_record'
            await appt.save({ session })
          }
        }
      })
    } finally {
      await session.endSession()
    }
    // Sau commit mới báo realtime (đặt ngoài transaction để tránh emit lặp nếu retry).
    if (apptOldStatus) emitDashboardAppointmentChanged(apptOldStatus, 'waiting_record')

    // Nhật ký best-effort — ngoài transaction, lỗi ghi log không làm rollback trạng thái nghiệp vụ.
    await ghiAuditQueue(req.user.id, 'CALL_PATIENT', entry._id, { trang_thai: 'trong_phong' }, { trang_thai: 'hoan_thanh' })
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id, vai_tro: 'doctor', hanh_dong: 'CHANGE_DOCTOR_STATUS',
      loai_doi_tuong: 'room_status', doi_tuong_id: entry.doctor_id,
      du_lieu_cu: { trang_thai: tuRoom }, du_lieu_moi: { trang_thai: 'dang_don_phong' },
    })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Đã kết thúc khám, chờ nhập hồ sơ')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/queue/:id/skip ────────────────────────────────────────
export async function skip(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaMinh(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Chỉ bỏ lượt được bệnh nhân đang chờ hoặc đã gọi')
    }

    const tu = entry.trang_thai
    entry.trang_thai = 'skipped'
    await entry.save()

    if (entry.appointment_id) {
      await updateAppointmentStatus(entry.appointment_id, 'skipped')
    }

    await ghiAuditQueue(req.user.id, 'SKIP_PATIENT', entry._id, { trang_thai: tu }, { trang_thai: 'skipped' })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Đã bỏ lượt bệnh nhân')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/queue/:id/cancel ──────────────────────────────────────
export async function cancel(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaMinh(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Chỉ hủy được bệnh nhân đang chờ hoặc đã gọi')
    }

    const tu = entry.trang_thai
    entry.trang_thai = 'cancelled'
    await entry.save()

    if (entry.appointment_id) {
      await updateAppointmentStatus(entry.appointment_id, 'cancelled')
    }

    await ghiAuditQueue(req.user.id, 'SKIP_PATIENT', entry._id, { trang_thai: tu }, { trang_thai: 'cancelled' })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Đã hủy lượt khám')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
