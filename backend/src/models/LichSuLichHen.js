import mongoose from 'mongoose'

// ============================================================
// APPOINTMENT HISTORY — Lịch sử thay đổi trạng thái lịch hẹn
// ============================================================
// Ghi mỗi khi appointment.status HOẶC payment_status thay đổi.
// Tách riêng khỏi AuditLog vì:
//   - Nhiều actor (bệnh nhân / bác sĩ / admin / cron)
//   - Volume cao (mỗi lịch ít nhất 2–4 dòng lịch sử)
//   - Cần query độc lập: "timeline của lịch hẹn #X"
//
// Luồng trạng thái appointment.status:
//   pending → confirmed (bác sĩ confirm, hoặc auto khi clinic+đã thanh toán)
//   pending → cancelled  (bệnh nhân hủy / admin hủy / cron timeout)
//   confirmed → completed (bác sĩ/admin đánh dấu hoàn thành)
//   confirmed → cancelled  (bác sĩ/admin hủy)
//
// Luồng payment_status:
//   unpaid → paid      (bệnh nhân thanh toán)
//   unpaid → (deleted) (hủy lịch trước khi thanh toán)
//   paid   → refunded  (hoàn tiền sau khi hủy)
//
// nguoi_thuc_hien_id=null khi vai_tro='system' (cron auto-cancel)

const appointmentHistorySchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
    },

    // Thay đổi appointment.status (null = không đổi trong sự kiện này)
    tu_trang_thai:  { type: String, default: null }, // null khi mới tạo lịch
    den_trang_thai: { type: String, required: true },

    // Thay đổi payment_status (null = không đổi trong sự kiện này)
    tu_payment_status:  { type: String, default: null },
    den_payment_status: { type: String, default: null },

    nguoi_thuc_hien_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null, // null khi vai_tro='system'
    },
    vai_tro: {
      type: String,
      enum: ['admin', 'doctor', 'user', 'system'],
      required: true,
    },
    ly_do: { type: String, default: null },
    thoi_diem: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'lich_su_lich_hen',
  }
)

appointmentHistorySchema.index({ appointment_id: 1, thoi_diem: 1 }) // timeline của 1 lịch
appointmentHistorySchema.index({ nguoi_thuc_hien_id: 1 })            // "ai đã làm gì"
appointmentHistorySchema.index({ vai_tro: 1, thoi_diem: -1 })        // lọc theo role + thời gian

export default mongoose.model('LichSuLichHen', appointmentHistorySchema)
