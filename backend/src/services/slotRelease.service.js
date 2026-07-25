import { LichLamViec } from '../models/index.js'

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
