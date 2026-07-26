import { BacSi, ChuyenKhoa, LichHen, LichLamViec } from '../models/index.js'
import { caTheoGio } from '../models/MauLichLamViec.js'
import { daQuaCutoffOnline, isSlotInPast } from '../utils/clinicTime.js'

// ============================================================
// TỰ GÁN BÁC SĨ + GIÁ THEO CHUYÊN KHOA — rule mục 12
// ============================================================
// Mặc định bệnh nhân chọn CHUYÊN KHOA + ngày + khung giờ, hệ thống tự gán bác sĩ.
// Đường "chọn đích danh bác sĩ" vẫn giữ nguyên cho tái khám / khách có nguyện vọng riêng.
//
// GIÁ = MỘT giá duy nhất theo chuyên khoa (`ChuyenKhoa.gia_kham`). `BacSi.gia_kham` giữ
// lại như field kỹ thuật nhưng KHÔNG dùng để tính tiền: tự gán mà giá nhảy theo bác sĩ sẽ
// sinh khiếu nại "sao người kia khám rẻ hơn tôi" — khách đâu có chọn ai.

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

/**
 * Giá khám của chuyên khoa. Ném lỗi nếu chưa cấu hình — thà chặn còn hơn âm thầm thu
 * theo giá bác sĩ rồi mỗi người một giá.
 */
export async function layGiaKhamChuyenKhoa(specialtyId, session = null) {
  if (!specialtyId) {
    throw Object.assign(new Error('Thiếu chuyên khoa nên chưa xác định được giá khám'), { statusCode: 400 })
  }
  const query = ChuyenKhoa.findById(specialtyId).select('ten gia_kham')
  if (session) query.session(session)
  const ck = await query.lean()

  if (!ck) {
    throw Object.assign(new Error('Không tìm thấy chuyên khoa'), { statusCode: 404 })
  }
  const gia = Number(ck.gia_kham)
  if (!Number.isFinite(gia) || gia <= 0) {
    throw Object.assign(
      new Error(`Chuyên khoa "${ck.ten}" chưa được cấu hình giá khám. Vui lòng liên hệ phòng khám.`),
      { statusCode: 400 },
    )
  }
  return { gia_kham: gia, ten_chuyen_khoa: ck.ten }
}

/**
 * Các khung giờ còn chỗ ONLINE của cả chuyên khoa trong một ngày, gộp từ mọi bác sĩ.
 * Bệnh nhân chỉ thấy khung + số chỗ, không cần biết bác sĩ nào — hệ thống gán sau.
 */
export async function layKhungTrongCuaChuyenKhoa(specialtyId, ngay, now = new Date()) {
  const doctors = await BacSi.find({
    specialties: specialtyId,
    trang_thai_duyet: 'approved',
    la_hien: true,
  }).select('_id').lean()

  if (doctors.length === 0) return []

  const schedules = await LichLamViec.find({
    doctor_id: { $in: doctors.map((d) => d._id) },
    ngay: { $gte: ngay, $lt: addDays(ngay, 1) },
    trang_thai_ngay: 'lam_viec',
    trang_thai_xac_nhan: { $ne: 'tu_choi' },
  }).lean()

  // Slot đã có LichHen còn hiệu lực -> không còn trống, dù `status` trong lịch có lệch.
  const daDat = new Set(
    (await LichHen.find({
      schedule_id: { $in: schedules.map((s) => s._id) },
      status: { $ne: 'cancelled' },
    }).select('slot_id').lean())
      .filter((a) => a.slot_id)
      .map((a) => String(a.slot_id)),
  )

  const theoKhung = new Map()
  for (const schedule of schedules) {
    for (const slot of schedule.slots) {
      if (slot.status !== 'active' || slot.benh_nhan_id) continue
      if (slot.bi_khoa_boi_nghi_phep) continue
      if (slot.loai_slot === 'walk_in') continue
      if (daDat.has(String(slot._id))) continue
      if (isSlotInPast(ngay, slot.gio_bat_dau, now)) continue
      if (daQuaCutoffOnline(ngay, slot.gio_bat_dau, now)) continue

      // Gộp theo GIỜ, không theo `khung_index`: slot cũ thiếu `khung_index` nên gộp theo nó
      // sẽ tách cùng một khung thành hai dòng, và `Number(null) === 0` còn xếp khung 13:30
      // vào ca sáng. Giờ bắt đầu luôn tồn tại và luôn đúng.
      const key = slot.gio_bat_dau
      const hienCo = theoKhung.get(key)
      if (hienCo) hienCo.so_cho_trong += 1
      else {
        theoKhung.set(key, {
          khung_index: slot.khung_index ?? null,
          gio_bat_dau: slot.gio_bat_dau,
          gio_ket_thuc: slot.gio_ket_thuc,
          ca: caTheoGio(slot.gio_bat_dau),
          so_cho_trong: 1,
        })
      }
    }
  }

  return [...theoKhung.values()].sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau))
}

/**
 * Chọn bác sĩ + slot cho một khung giờ. Thứ tự XÁC ĐỊNH, không random (rule mục 12) —
 * để kiểm thử lặp lại được và để hai lần gọi cùng dữ liệu luôn ra cùng kết quả:
 *
 *   1. Bác sĩ đã khám cho bệnh nhân này gần nhất, nếu còn slot cùng khung (giữ mạch tái khám)
 *   2. Bác sĩ có ít lịch nhất trong ca
 *   3. Tie-break theo `doctor_id` tăng dần
 *
 * @returns {Promise<{doctorId, scheduleId, slotId, slot}|null>} null nếu khung đã hết chỗ
 */
export async function chonBacSiChoKhung({
  specialtyId,
  ngay,
  gioBatDau,
  userId = null,
  memberId = null,
  now = new Date(),
  session = null,
}) {
  const doctors = await BacSi.find({
    specialties: specialtyId,
    trang_thai_duyet: 'approved',
    la_hien: true,
  }).select('_id').lean()
  if (doctors.length === 0) return null

  const scheduleQuery = LichLamViec.find({
    doctor_id: { $in: doctors.map((d) => d._id) },
    ngay: { $gte: ngay, $lt: addDays(ngay, 1) },
    trang_thai_ngay: 'lam_viec',
    trang_thai_xac_nhan: { $ne: 'tu_choi' },
  })
  if (session) scheduleQuery.session(session)
  const schedules = await scheduleQuery.lean()
  if (schedules.length === 0) return null

  const apptQuery = LichHen.find({
    schedule_id: { $in: schedules.map((s) => s._id) },
    status: { $ne: 'cancelled' },
  }).select('slot_id doctor_id gio_kham')
  if (session) apptQuery.session(session)
  const appointments = await apptQuery.lean()
  const slotDaDat = new Set(appointments.filter((a) => a.slot_id).map((a) => String(a.slot_id)))

  // Ứng viên: mỗi bác sĩ một slot online còn trống ở đúng khung này.
  const ungVien = []
  for (const schedule of schedules) {
    const slot = schedule.slots.find(
      (s) => s.gio_bat_dau === gioBatDau
        && s.status === 'active'
        && !s.benh_nhan_id
        && !s.bi_khoa_boi_nghi_phep
        && s.loai_slot !== 'walk_in'
        && !slotDaDat.has(String(s._id)),
    )
    if (!slot) continue
    if (isSlotInPast(ngay, slot.gio_bat_dau, now)) continue
    if (daQuaCutoffOnline(ngay, slot.gio_bat_dau, now)) continue

    ungVien.push({
      doctorId: schedule.doctor_id,
      scheduleId: schedule._id,
      slotId: slot._id,
      slot,
      khungIndex: slot.khung_index,
    })
  }
  if (ungVien.length === 0) return null
  if (ungVien.length === 1) return ungVien[0]

  // (1) Bác sĩ đã khám gần nhất cho chính người được khám này.
  const bacSiQuen = await timBacSiKhamGanNhat({ userId, memberId, specialtyId, session })
  if (bacSiQuen) {
    const giuMach = ungVien.find((u) => String(u.doctorId) === String(bacSiQuen))
    if (giuMach) return giuMach
  }

  // (2) Ít lịch nhất TRONG CA — không phải cả ngày: bác sĩ kín sáng nhưng trống chiều
  // vẫn nên nhận khách chiều.
  // Suy ca từ GIỜ, không từ `khung_index` — slot cũ thiếu field đó và `Number(null) === 0`
  // sẽ đếm nhầm lịch ca chiều thành ca sáng, làm sai luôn phép "ít lịch nhất trong ca".
  const caCuaKhungNay = caTheoGio(gioBatDau)
  const gioTheoSlot = new Map()
  for (const schedule of schedules) {
    for (const s of schedule.slots) gioTheoSlot.set(String(s._id), s.gio_bat_dau)
  }
  const soLichTrongCa = new Map()
  for (const appt of appointments) {
    if (!appt.slot_id) continue
    const gio = gioTheoSlot.get(String(appt.slot_id)) ?? appt.gio_kham
    if (!gio || caTheoGio(gio) !== caCuaKhungNay) continue
    const key = String(appt.doctor_id)
    soLichTrongCa.set(key, (soLichTrongCa.get(key) ?? 0) + 1)
  }

  ungVien.sort((a, b) => {
    const chenhLech = (soLichTrongCa.get(String(a.doctorId)) ?? 0) - (soLichTrongCa.get(String(b.doctorId)) ?? 0)
    if (chenhLech !== 0) return chenhLech
    // (3) Tie-break theo doctor_id tăng dần — bảo đảm kết quả lặp lại được.
    return String(a.doctorId).localeCompare(String(b.doctorId))
  })

  return ungVien[0]
}

/** Bác sĩ đã khám xong cho người này gần nhất, trong cùng chuyên khoa. */
async function timBacSiKhamGanNhat({ userId, memberId, specialtyId, session = null }) {
  const dinhDanh = memberId ? { member_id: memberId } : { user_id: userId, member_id: null }
  if (!memberId && !userId) return null

  const query = LichHen.findOne({
    ...dinhDanh,
    specialty_id: specialtyId,
    status: 'completed',
    doctor_id: { $ne: null },
  })
    .select('doctor_id')
    .sort({ ngay_kham: -1 })
  if (session) query.session(session)

  const ganNhat = await query.lean()
  return ganNhat?.doctor_id ?? null
}
