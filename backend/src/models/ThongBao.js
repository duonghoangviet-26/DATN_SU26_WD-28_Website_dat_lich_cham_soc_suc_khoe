import mongoose from 'mongoose'

// ============================================================
// NOTIFICATION — Thông báo cá nhân (A7)
// SQL tương đương: notifications
// ============================================================
// related_id + related_type: điều hướng đến đúng trang khi click.
// KHÔNG dùng TTL index (sẽ xóa nhầm thông báo chưa đọc).
// Thay vào đó: cron hàng tuần xóa da_doc=true quá 90 ngày.

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
    },
    tieu_de:  { type: String, required: true, maxlength: 255 },
    noi_dung: { type: String, required: true },
    loai: {
      type: String,
      enum: ['appointment', 'medicine', 'system'],
      required: true,
    },
    related_id:   { type: mongoose.Schema.Types.ObjectId, default: null },
    related_type: { type: String, default: null, maxlength: 50 }, // 'appointment' | 'medical_record' | 'reminder'
    da_doc:       { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'thong_bao',
  }
)

notificationSchema.index({ user_id: 1, da_doc: 1 }) // unread count
notificationSchema.index({ ngay_tao: 1 }) // cron cleanup (KHÔNG phải TTL)

export default mongoose.model('ThongBao', notificationSchema)
