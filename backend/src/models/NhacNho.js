import mongoose from 'mongoose'

// ============================================================
// REMINDER — Lịch nhắc uống thuốc (A4)
// SQL tương đương: reminders
// ============================================================
// Mỗi doc = 1 lần nhắc cụ thể (ngày + giờ).
// Cron 5': pending → sent (gửi email/FCM); sent quá 2h → missed.
// Bệnh nhân xác nhận: sent → taken.

const reminderSchema = new mongoose.Schema(
  {
    prescription_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DonThuoc',
      required: true, // cần để query "nhắc nhở của đơn thuốc này"
    },
    prescription_item_id: {
      type: mongoose.Schema.Types.ObjectId, // trỏ tới items._id trong prescriptions (subdoc)
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
    },
    gio_nhac: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'sent', 'taken', 'missed'],
      default: 'pending',
    },
    ngay_gui: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'nhac_nho',
  }
)

reminderSchema.index({ status: 1, gio_nhac: 1 }) // cron: pending sắp đến
reminderSchema.index({ status: 1, ngay_gui: 1 }) // cron: sent > 2h → missed
reminderSchema.index({ user_id: 1 })
reminderSchema.index({ prescription_id: 1 }) // query tất cả nhắc của 1 đơn thuốc
reminderSchema.index({ prescription_item_id: 1 })

export default mongoose.model('NhacNho', reminderSchema)
