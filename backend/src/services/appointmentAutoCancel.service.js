import { LichHen, LichLamViec, NhatKyThaoTac } from '../models/index.js'

// ============================================================
// AUTO-CANCEL — Lịch HOME confirmed+unpaid quá payment_deadline (B3)
// Dùng bởi cron 15 phút — xem docs/Bác sĩ/B3 - Lịch hẹn.md mục 7.
// KHÔNG áp dụng cho clinic — clinic auto-confirm+paid ngay khi tạo,
// không bao giờ ở trạng thái confirmed+unpaid (quyết định 2026-07-02).
// ============================================================

export async function autoCancelExpiredHomeAppointments() {
  const expired = await LichHen.find({
    status: 'confirmed',
    payment_status: 'unpaid',
    payment_deadline: { $lt: new Date() },
  })

  let count = 0
  for (const a of expired) {
    a.status = 'cancelled'
    a.ly_do_huy = 'Quá hạn thanh toán — hệ thống tự động hủy'
    a.payment_deadline = null
    await a.save()

    // Mở lại slot đã giữ chỗ — nếu không, slot bị kẹt vĩnh viễn ở trạng thái đã đặt
    // dù lịch hẹn đã hủy (không ai đặt lại được khung giờ đó nữa).
    if (a.schedule_id && a.slot_id) {
      await LichLamViec.findOneAndUpdate(
        { _id: a.schedule_id, 'slots._id': a.slot_id },
        { $set: { 'slots.$.status': 'active', 'slots.$.benh_nhan_id': null } },
      )
    }

    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: null,
      vai_tro:            'system',
      hanh_dong:           'AUTO_CANCEL_APPOINTMENT',
      loai_doi_tuong:      'appointment',
      doi_tuong_id:        a._id,
      ly_do:               a.ly_do_huy,
    })
    count += 1
  }

  return count
}
