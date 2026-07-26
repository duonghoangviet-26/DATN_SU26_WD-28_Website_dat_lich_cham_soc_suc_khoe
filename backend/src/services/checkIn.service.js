import mongoose from 'mongoose'
import { HangDoi, LichHen, LichLamViec, NguoiDung, ThanhVien } from '../models/index.js'
import { tinhMucUuTien } from '../models/HangDoi.js'
import { buildSlotDateTime, cacMocCuaKhung, startOfDayUtc } from '../utils/clinicTime.js'
import { kiemTraQuaTai } from './queueOverflow.service.js'

// ============================================================
// CHECK-IN — MỘT service dùng chung cho MỌI vai trò (rule mục 7)
// ============================================================
// Rule mục 7 chốt: "Lễ tân & y tá dùng CHUNG 1 service check-in — không mỗi vai trò một
// luồng." Trước file này có HAI luồng khác nhau và chỉ một luồng đúng:
//
//   POST /api/doctor/queue/checkin              -> tạo HangDoi (đúng)
//   PATCH /api/receptionist/appointments/:id/arrived -> chỉ đổi status='checked_in' (SAI)
//
// Hệ quả của nhánh sai: bệnh nhân đặt online đã thanh toán, tới quầy, lễ tân bấm "đã đến"
// — và KHÔNG BAO GIỜ xuất hiện trong hàng đợi của bác sĩ. Bác sĩ không có cách nào tiếp
// nhận họ. Nặng hơn: rule mục 8 định nghĩa `no_show` = "hết ca mà KHÔNG có bản ghi HangDoi",
// nên người đã bước chân tới quầy vẫn bị coi là không đến và MẤT 100% tiền (mục 5).
//
// Vì vậy toàn bộ nghiệp vụ check-in nằm ở đây; controller chỉ còn việc chuyển tham số và
// dịch lỗi. Actor nào gọi chỉ khác ở hai chỗ: `vai_tro_tiep_nhan` ghi vào nhật ký, và
// `restrictToDoctorId` (bác sĩ chỉ check-in được bệnh nhân của chính mình, lễ tân thì không
// bị giới hạn vì họ tiếp nhận cho cả phòng khám).

// Trạng thái KHÔNG thể check-in. Giữ đúng danh sách cũ của `doctor/queue.controller.js` —
// các trạng thái sau đó (`in_progress`, `waiting_record`…) đã có HangDoi nên bị chặn bởi
// ràng buộc "mỗi lịch hẹn tối đa 1 lượt" bên dưới, không cần liệt kê lại.
const TRANG_THAI_KHONG_CHECKIN = ['cancelled', 'no_show', 'completed', 'skipped']

function loi(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

/** Ngày hôm nay theo mốc 00:00 UTC + mốc 00:00 ngày mai. */
function khoangHomNay(now) {
  const start = startOfDayUtc(now)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

/**
 * Phòng khám của lượt: ưu tiên giá trị chốt trên lịch hẹn, thiếu thì tra từ slot.
 *
 * `LichHen.phong_kham` có thể null với lịch đặt trước khi `phong_id` được thêm vào slot
 * (2026-07-26). Bác sĩ và lễ tân đều cần biết phòng để dẫn bệnh nhân, nên tra bù thay vì
 * hiển thị "—".
 */
async function timPhongKham(appt, session = null) {
  if (appt.phong_kham) return appt.phong_kham
  if (!appt.schedule_id || !appt.slot_id) return null

  const query = LichLamViec.findById(appt.schedule_id).select('slots')
  if (session) query.session(session)
  const schedule = await query.lean()
  const slot = schedule?.slots?.find((s) => String(s._id) === String(appt.slot_id))
  return slot?.phong_kham ?? null
}

/** Tuổi từ ngày sinh thành viên, thiếu thì suy từ `nam_sinh_khach` của lịch khách lẻ. */
function tinhTuoi(member, appt, now) {
  if (member?.ngay_sinh) return now.getFullYear() - new Date(member.ngay_sinh).getFullYear()
  if (appt?.nam_sinh_khach) return now.getFullYear() - Number(appt.nam_sinh_khach)
  return null
}

// `LichHen.gioi_tinh_khach` dùng male/female, `HangDoi.gioi_tinh` dùng nam/nu/khac.
const GIOI_TINH_KHACH_SANG_HANG_DOI = { male: 'nam', female: 'nu' }

/**
 * Cảnh báo (không chặn) để người tiếp nhận biết ngay tại quầy. Đây là THÔNG TIN, không phải
 * điều kiện: đã có người đứng trước mặt thì không được từ chối tiếp nhận họ.
 */
function canhBaoThoiDiem(appt, now) {
  const canhBao = []

  if (appt.payment_status !== 'paid') {
    canhBao.push(`Lịch hẹn chưa thanh toán đủ (đang: ${appt.payment_status}). Thu tiền trước khi vào phòng.`)
  }

  const moc = cacMocCuaKhung(appt.ngay_kham, appt.gio_kham)
  if (moc) {
    if (now.getTime() > moc.hetGrace.getTime()) {
      // Rule mục 5 + 11: trễ quá grace thì tụt xuống mức `offline` nhưng KHÔNG mất tiền.
      canhBao.push(`Đến sau ${appt.gio_kham} quá 15 phút — vẫn được khám nhưng xếp sau, không mất tiền.`)
    } else if (now.getTime() < moc.T.getTime()) {
      canhBao.push(`Đến sớm, khung ${appt.gio_kham} chưa tới. Chờ tới khung của mình, không bị phạt.`)
    }
  }

  return canhBao
}

/**
 * Check-in một LỊCH HẸN đã đặt trước (online hoặc đăng ký tại quầy) vào hàng đợi.
 *
 * Ghi LichHen + HangDoi trong MỘT transaction: nếu tạo lượt lỗi sau khi đã đánh dấu "đã đến"
 * thì rollback cả hai, tránh lịch `checked_in` mà không có ai trong hàng đợi — đúng tình
 * trạng mà rule mục 8 sẽ hiểu thành `no_show`.
 *
 * @param {object}  p
 * @param {string}  p.appointmentId
 * @param {string?} p.actorUserId        - người bấm check-in (null nếu route chưa có auth)
 * @param {string?} p.actorRole          - 'doctor' | 'receptionist' | 'admin'…
 * @param {string?} p.restrictToDoctorId - chỉ cho check-in lịch của bác sĩ này
 * @returns {Promise<{entry, appointment, canh_bao: string[]}>}
 */
export async function checkInLichHen({
  appointmentId,
  actorUserId = null,
  actorRole = null,
  restrictToDoctorId = null,
  now = new Date(),
}) {
  if (!appointmentId) throw loi(400, 'Thiếu mã lịch hẹn')

  const appt = await LichHen.findById(appointmentId)
  if (!appt) throw loi(404, 'Không tìm thấy lịch hẹn')

  // Khám tại nhà không có phòng, không có hàng đợi — check-in vô nghĩa.
  if (appt.loai_kham !== 'clinic') {
    throw loi(400, 'Chỉ áp dụng cho lịch khám tại phòng khám')
  }
  if (restrictToDoctorId && String(appt.doctor_id) !== String(restrictToDoctorId)) {
    throw loi(403, 'Lịch hẹn không thuộc lịch của bạn')
  }
  if (!appt.doctor_id) {
    throw loi(409, 'Lịch hẹn chưa được gán bác sĩ nên chưa vào được hàng đợi')
  }

  const { start, end } = khoangHomNay(now)
  if (appt.ngay_kham < start || appt.ngay_kham >= end) {
    throw loi(409, 'Lịch hẹn không phải của hôm nay')
  }
  if (TRANG_THAI_KHONG_CHECKIN.includes(appt.status)) {
    throw loi(409, `Không thể check-in lịch hẹn đang ở trạng thái ${appt.status}`)
  }

  // Rule mục 7: mỗi LichHen ↔ tối đa 1 HangDoi đang hoạt động. Index unique sparse trên
  // `appointment_id` chốt ở tầng DB; kiểm ở đây để trả lỗi đọc được thay vì E11000.
  const daCo = await HangDoi.findOne({ appointment_id: appt._id }).select('_id trang_thai').lean()
  if (daCo) throw loi(409, 'Lịch hẹn này đã có trong hàng đợi')

  const [member, chuTaiKhoan] = await Promise.all([
    appt.member_id ? ThanhVien.findById(appt.member_id).select('ho_ten ngay_sinh gioi_tinh').lean() : null,
    appt.user_id ? NguoiDung.findById(appt.user_id).select('ho_ten so_dien_thoai').lean() : null,
  ])
  const phongKham = await timPhongKham(appt)

  const gioHenGoc = appt.gio_kham ? buildSlotDateTime(appt.ngay_kham, appt.gio_kham) : null

  const payload = {
    nguon: 'online',
    appointment_id: appt._id,
    member_id: appt.member_id ?? null,
    // Người tự đặt cho mình không có `member_id` lẫn `ten_khach` — trước đây rơi vào
    // 'Không rõ' và bác sĩ không biết đang khám cho ai.
    ten_benh_nhan: member?.ho_ten ?? appt.ten_khach ?? chuTaiKhoan?.ho_ten ?? 'Không rõ',
    so_dien_thoai: appt.so_dien_thoai_khach ?? chuTaiKhoan?.so_dien_thoai ?? null,
    tuoi: tinhTuoi(member, appt, now),
    gioi_tinh: member?.gioi_tinh ?? GIOI_TINH_KHACH_SANG_HANG_DOI[appt.gioi_tinh_khach] ?? null,
    specialty_id: appt.specialty_id,
    doctor_id: appt.doctor_id,
    phong_kham: phongKham,
    // Snapshot lúc check-in — bậc ưu tiên THẬT tính động lúc query (rule mục 6).
    muc_uu_tien: tinhMucUuTien('online', now, gioHenGoc),
    gio_hen_goc: gioHenGoc,
    checkin_time: now,
    nguoi_tiep_nhan_id: actorUserId,
    vai_tro_tiep_nhan: actorRole,
  }

  const trangThaiCu = appt.status
  // Rule mục 8: trạng thái canonical sau check-in là `da_check_in`. Nhánh bác sĩ trước đây
  // để nguyên `confirmed` nên báo cáo/thống kê không phân biệt được "đã tới quầy" với
  // "đã xác nhận nhưng chưa tới".
  const capNhat = {
    status: 'checked_in',
    trang_thai_den: 'da_den',
    gio_den_thuc_te: now,
  }
  if (!appt.phong_kham && phongKham) capNhat.phong_kham = phongKham

  let entry
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      // ⚠️ `$set` qua findByIdAndUpdate, KHÔNG dùng `appt.save()`.
      //
      // `LichHen.pre('validate')` kiểm cả những field mà check-in không hề chạm (`ten_khach`
      // khi thiếu `member_id`, `service_id` của lịch tại nhà…). Với một bản ghi cũ thiếu
      // field nào đó, `save()` sẽ ném lỗi về field KHÁC và người tiếp nhận không thể ghi nhận
      // bệnh nhân đang đứng trước mặt — rồi cuối ca họ bị đánh `no_show` và mất 100% tiền
      // (rule mục 5, 8). Ghi nhận sự có mặt không được phụ thuộc vào chất lượng dữ liệu ở
      // chỗ khác. Đây cũng là cách `doiTrangThaiLichHen` trong queue.controller đã chốt.
      await LichHen.updateOne({ _id: appt._id }, { $set: capNhat }, { session })
      const [e] = await HangDoi.create([payload], { session })
      entry = e
    })
  } finally {
    await session.endSession()
  }

  // Đồng bộ document trong bộ nhớ với những gì vừa ghi, để controller trả về đúng trạng thái.
  Object.assign(appt, capNhat)

  const canhBao = canhBaoThoiDiem(appt, now)
  const quaTai = await kiemTraQuaTai(appt.doctor_id)
  if (quaTai.canhBao) canhBao.push(quaTai.canhBao)

  return { entry, appointment: appt, trang_thai_cu: trangThaiCu, canh_bao: canhBao }
}

/**
 * Check-in khách VÃNG LAI chưa có lịch hẹn (đến trực tiếp, không đặt trước).
 * Không tạo `LichHen` — chỉ tồn tại trong hàng đợi (rule mục 6: online + walk-in chung
 * MỘT hàng đợi, chỉ khác `nguon`).
 */
export async function checkInVangLai({
  doctorId,
  tenBenhNhan,
  soDienThoai,
  tuoi = null,
  gioiTinh = null,
  specialtyId = null,
  actorUserId = null,
  actorRole = null,
  now = new Date(),
}) {
  if (!doctorId) throw loi(400, 'Thiếu bác sĩ tiếp nhận')
  if (!tenBenhNhan?.trim() || !soDienThoai?.trim()) {
    throw loi(400, 'Khách vãng lai bắt buộc có tên và số điện thoại')
  }

  const { start } = khoangHomNay(now)
  const schedule = await LichLamViec.findOne({ doctor_id: doctorId, ngay: start }).lean()
  const slotDauNgay = schedule?.slots?.[0] ?? null
  const resolvedSpecialtyId = specialtyId ?? slotDauNgay?.specialty_id ?? null
  if (!resolvedSpecialtyId) {
    throw loi(400, 'Không xác định được chuyên khoa cho lượt khách vãng lai')
  }

  const entry = await HangDoi.create({
    nguon: 'offline',
    ten_benh_nhan: tenBenhNhan.trim(),
    so_dien_thoai: soDienThoai.trim(),
    tuoi,
    gioi_tinh: gioiTinh,
    specialty_id: resolvedSpecialtyId,
    doctor_id: doctorId,
    phong_kham: slotDauNgay?.phong_kham ?? null,
    muc_uu_tien: tinhMucUuTien('offline', now, null),
    gio_hen_goc: null,
    checkin_time: now,
    nguoi_tiep_nhan_id: actorUserId,
    vai_tro_tiep_nhan: actorRole,
  })

  const canhBao = []
  const quaTai = await kiemTraQuaTai(doctorId)
  if (quaTai.canhBao) canhBao.push(quaTai.canhBao)

  return { entry, canh_bao: canhBao }
}

/**
 * Lịch hẹn của HÔM NAY đã đến lượt tiếp nhận mà CHƯA có trong hàng đợi.
 *
 * Đây là danh sách "chờ tiếp nhận" — mắt xích còn thiếu giữa "khách đã đặt + đã trả tiền"
 * và "bác sĩ thấy bệnh nhân trong hàng đợi". Không có nó thì người tiếp nhận phải tự nhớ
 * ai đã đặt, hoặc phải tra sang trang khác.
 *
 * @param {object}  p
 * @param {string?} p.doctorId - giới hạn theo bác sĩ (bác sĩ tự xem); null = cả phòng khám
 */
export async function layLichChoTiepNhan({ doctorId = null, ngay = null, now = new Date() }) {
  const moc = ngay ? startOfDayUtc(ngay) : startOfDayUtc(now)
  const ketThuc = new Date(moc)
  ketThuc.setUTCDate(ketThuc.getUTCDate() + 1)

  const filter = {
    loai_kham: 'clinic',
    ngay_kham: { $gte: moc, $lt: ketThuc },
    status: { $in: ['pending', 'confirmed'] },
  }
  if (doctorId) filter.doctor_id = doctorId

  const appointments = await LichHen.find(filter)
    .populate('specialty_id', 'ten')
    .sort({ gio_kham: 1 })
    .lean()
  if (appointments.length === 0) return []

  // Lịch đã có lượt trong hàng đợi thì không còn "chờ tiếp nhận" nữa. Lọc bằng một truy vấn
  // thay vì kiểm từng lịch.
  const daVaoHangDoi = new Set(
    (await HangDoi.find({ appointment_id: { $in: appointments.map((a) => a._id) } })
      .select('appointment_id').lean())
      .map((e) => String(e.appointment_id)),
  )

  const memberIds = appointments.filter((a) => a.member_id).map((a) => a.member_id)
  const userIds = appointments.filter((a) => a.user_id).map((a) => a.user_id)
  const [members, users] = await Promise.all([
    ThanhVien.find({ _id: { $in: memberIds } }).select('ho_ten ngay_sinh gioi_tinh').lean(),
    NguoiDung.find({ _id: { $in: userIds } }).select('ho_ten so_dien_thoai').lean(),
  ])
  const memberById = new Map(members.map((m) => [String(m._id), m]))
  const userById = new Map(users.map((u) => [String(u._id), u]))

  return appointments
    .filter((a) => !daVaoHangDoi.has(String(a._id)))
    .map((a) => {
      const member = a.member_id ? memberById.get(String(a.member_id)) : null
      const chuTaiKhoan = a.user_id ? userById.get(String(a.user_id)) : null
      const mocKhung = cacMocCuaKhung(a.ngay_kham, a.gio_kham)

      return {
        appointment_id: a._id,
        ma_lich_hen: a.ma_lich_hen ?? null,
        ten_benh_nhan: member?.ho_ten ?? a.ten_khach ?? chuTaiKhoan?.ho_ten ?? 'Không rõ',
        so_dien_thoai: a.so_dien_thoai_khach ?? chuTaiKhoan?.so_dien_thoai ?? null,
        tuoi: tinhTuoi(member, a, now),
        gioi_tinh: member?.gioi_tinh ?? GIOI_TINH_KHACH_SANG_HANG_DOI[a.gioi_tinh_khach] ?? null,
        doctor_id: a.doctor_id,
        chuyen_khoa: a.specialty_id?.ten ?? null,
        gio_kham: a.gio_kham,
        phong_kham: a.phong_kham ?? null,
        nguon: a.nguon ?? 'online',
        status: a.status,
        payment_status: a.payment_status,
        // Ba mốc của rule mục 11, tính sẵn để UI không phải tự suy giờ phòng khám.
        da_toi_khung: mocKhung ? now.getTime() >= mocKhung.T.getTime() : false,
        con_trong_grace: mocKhung
          ? now.getTime() >= mocKhung.T.getTime() && now.getTime() <= mocKhung.hetGrace.getTime()
          : false,
        tre_qua_grace: mocKhung ? now.getTime() > mocKhung.hetGrace.getTime() : false,
      }
    })
}
