import { LichLamViec, NhatKyThaoTac } from '../models/index.js'
import { daQuaCutoffOnline, startOfDayUtc } from '../utils/clinicTime.js'

// ============================================================
// NHẢ SLOT GIỮ CHỖ QUÁ HẠN — quét TỪ PHÍA SLOT
// ============================================================
// VÌ SAO CẦN: cơ chế nhả cũ chạy TỪ PHÍA LỊCH HẸN (cron tìm `LichHen` quá hạn thanh toán rồi
// gọi `releaseAppointmentSlot({ appointment })`). Slot không còn `LichHen` trỏ tới thì KHÔNG có
// đường nào để nhả -> khóa vĩnh viễn. Ngày 2026-07-25 tìm thấy 20 slot như vậy trên DB thật.
//
// Bộ quét này đi ngược lại: duyệt SLOT, không cần biết `LichHen` còn hay mất. Nhờ vậy tự chữa
// được cả những nguyên nhân chưa biết (giao dịch vỡ giữa chừng, ai đó xóa tay `LichHen`...).
//
// COI LÀ HỎNG (nhả) khi status='pending_payment' VÀ:
//   - `pending_expired_at` đã qua, HOẶC
//   - `pending_expired_at` rỗng — giữ chỗ KHÔNG HẠN thì không bao giờ hết hạn để được nhả.
//     (Nguồn: `admin/slots.controller.js` cho phép sửa tay `status` mà không bắt set hạn.)
//
// KHÔNG đụng: `booked`, `locked`, `cancelled`, `expired`; và KHÔNG đụng LichHen/HoaDon/ThanhToan
// — nhả một chỗ ngồi bị bỏ quên, không phải hủy giao dịch.
//
// Xem thêm: docs/Phan tich truoc khi sua - Co che nha slot va mui gio (2026-07-25).md

/** Điều kiện lọc dùng chung cho cả quét lazy lẫn cron. */
function laGiuChoHong(slot, now) {
  if (slot.status !== 'pending_payment') return false
  return !slot.pending_expired_at || slot.pending_expired_at <= now
}

const CAC_TRUONG_NHA = {
  status: 'active',
  benh_nhan_id: null,
  benh_nhan_tam_giu_id: null,
  pending_expired_at: null,
}

/**
 * Nhả slot hỏng trong MỘT lịch làm việc. Gọi ngay trước khi đọc slot (quét lazy) để người
 * đang tìm chỗ thấy luôn chỗ vừa được giải phóng.
 *
 * Ghi bằng `updateOne` + `arrayFilters` nên an toàn khi nhiều request chạy song song:
 * `arrayFilters` kèm `status:'pending_payment'` bảo đảm không ghi đè slot vừa đổi trạng thái.
 *
 * @returns {Promise<number>} số slot đã nhả
 */
export async function nhaSlotQuaHanTrongLich(schedule, now = new Date()) {
  if (!schedule?.slots?.length) return 0
  const slotHong = schedule.slots.filter((s) => laGiuChoHong(s, now))
  if (slotHong.length === 0) return 0

  await LichLamViec.updateOne(
    { _id: schedule._id },
    { $set: Object.fromEntries(Object.entries(CAC_TRUONG_NHA).map(([k, v]) => [`slots.$[s].${k}`, v])) },
    { arrayFilters: [{ 's._id': { $in: slotHong.map((s) => s._id) }, 's.status': 'pending_payment' }] },
  )

  // Cập nhật luôn bản in-memory để hàm gọi dùng ngay, khỏi phải query lại.
  for (const slot of schedule.slots) {
    if (!laGiuChoHong(slot, now)) continue
    Object.assign(slot, CAC_TRUONG_NHA)
  }
  return slotHong.length
}

/**
 * Quét toàn hệ thống — lưới an toàn cho lịch KHÔNG ai đọc tới. Chạy định kỳ bằng cron.
 * @returns {Promise<{soLich: number, soSlot: number}>}
 */
export async function nhaSlotQuaHanToanHeThong(now = new Date()) {
  // Lọc thô ở tầng DB cho nhẹ, rồi lọc chính xác trong JS (Mongo không so được
  // "null HOẶC <= now" gọn gàng trên phần tử mảng).
  const schedules = await LichLamViec.find({ 'slots.status': 'pending_payment' })
  let soLich = 0
  let soSlot = 0
  for (const schedule of schedules) {
    const n = await nhaSlotQuaHanTrongLich(schedule, now)
    if (n > 0) {
      soLich += 1
      soSlot += n
    }
  }
  return { soLich, soSlot }
}

// ============================================================
// CUTOFF T-30' — slot online chưa bán TỰ CHUYỂN thành walk-in (rule mục 4 + 11)
// ============================================================
// Quota 70/30 là chính sách GIỮ CHỖ CÓ THỜI HẠN, không phải vách ngăn cứng. Tới `T-30'`
// mà chỗ online vẫn chưa ai mua thì phòng khám không có lý do gì để tiếp tục treo nó —
// khách đứng ở quầy phải được ngồi vào.
//
// Chảy MỘT CHIỀU: online -> walk-in, không bao giờ ngược lại. Trước cutoff, khách tới quầy
// KHÔNG được lấy chỗ online của khung hiện tại (rule mục 4).
//
// CHỈ đụng slot `status='active'`: slot `pending_payment` đang có người trả tiền, `booked`
// đã bán. Đổi `loai_slot` của chúng sẽ cướp chỗ của người đã vào luồng thanh toán.

function laSlotOnlineQuaCutoff(slot, ngay, now) {
  if (slot.status !== 'active') return false
  if (slot.loai_slot !== 'online') return false
  if (slot.bi_khoa_boi_nghi_phep) return false
  return daQuaCutoffOnline(ngay, slot.gio_bat_dau, now)
}

/**
 * Chuyển slot online quá cutoff trong MỘT lịch. Gọi lazy ngay trước khi đọc lịch.
 * @returns {Promise<number>} số slot đã chuyển
 */
export async function chuyenSlotOnlineQuaCutoffTrongLich(schedule, now = new Date(), { ghiNhatKy = true } = {}) {
  if (!schedule?.slots?.length) return 0
  const canChuyen = schedule.slots.filter((s) => laSlotOnlineQuaCutoff(s, schedule.ngay, now))
  if (canChuyen.length === 0) return 0

  await LichLamViec.updateOne(
    { _id: schedule._id },
    { $set: { 'slots.$[s].loai_slot': 'walk_in' } },
    {
      arrayFilters: [{
        's._id': { $in: canChuyen.map((s) => s._id) },
        // Lặp lại điều kiện lúc GHI: giữa lúc đọc và lúc ghi có thể có người vừa giữ chỗ.
        's.status': 'active',
        's.loai_slot': 'online',
      }],
    },
  )

  for (const slot of schedule.slots) {
    if (!laSlotOnlineQuaCutoff(slot, schedule.ngay, now)) continue
    slot.loai_slot = 'walk_in'
  }

  if (ghiNhatKy) {
    // Một bản ghi / lịch / lần quét — ghi từng slot sẽ làm ngập nhật ký vì cron chạy 5'.
    const gio = [...new Set(canChuyen.map((s) => s.gio_bat_dau))].sort().join(', ')
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: null,
      vai_tro: 'system',
      hanh_dong: 'CHUYEN_SLOT_ONLINE_SANG_WALK_IN',
      loai_doi_tuong: 'schedule',
      doi_tuong_id: schedule._id,
      ly_do: `Qua moc T-30': chuyen ${canChuyen.length} slot online chua ban sang walk-in (khung ${gio})`,
    })
  }

  return canChuyen.length
}

/**
 * Quét toàn hệ thống — lưới an toàn cho lịch không ai đọc tới.
 * CHỈ quét từ hôm nay trở đi: lịch quá khứ đã qua cutoff từ lâu, chuyển cũng vô nghĩa
 * mà lại ghi đè hàng nghìn bản ghi cũ.
 */
export async function chuyenSlotOnlineQuaCutoffToanHeThong(now = new Date()) {
  const schedules = await LichLamViec.find({
    ngay: { $gte: startOfDayUtc(now) },
    trang_thai_ngay: 'lam_viec',
    'slots.loai_slot': 'online',
    'slots.status': 'active',
  })

  let soLich = 0
  let soSlot = 0
  for (const schedule of schedules) {
    const n = await chuyenSlotOnlineQuaCutoffTrongLich(schedule, now)
    if (n > 0) {
      soLich += 1
      soSlot += n
    }
  }
  return { soLich, soSlot }
}

/**
 * Hai việc phải làm mỗi lần ĐỌC một lịch làm việc: nhả giữ chỗ quá hạn, rồi chuyển slot
 * online quá cutoff. Thứ tự quan trọng — nhả trước thì slot vừa được nhả cũng kịp xét
 * cutoff trong cùng một lượt, thay vì phải chờ lượt sau.
 */
export async function donDepSlotTruocKhiDoc(schedule, now = new Date()) {
  const daNha = await nhaSlotQuaHanTrongLich(schedule, now)
  const daChuyen = await chuyenSlotOnlineQuaCutoffTrongLich(schedule, now)
  return { daNha, daChuyen }
}
