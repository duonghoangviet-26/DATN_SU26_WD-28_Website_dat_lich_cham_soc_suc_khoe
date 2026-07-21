import mongoose from 'mongoose'

// ============================================================
// SYSTEM NOTIFICATION — Thông báo hệ thống Admin gửi hàng loạt (C7)
// SQL tương đương: system_notifications
// ============================================================
// Gửi ngay, không thu hồi. Batch insert 100 records/lần vào notifications (tầng service).

const systemNotificationSchema = new mongoose.Schema(
  {
    tieu_de:  { type: String, required: true, maxlength: 60 },
    noi_dung: { type: String, required: true },
    url:      { type: String, default: null, maxlength: 500 },
    doi_tuong: {
      type: String,
      enum: ['tat_ca', 'benh_nhan', 'bac_si', 'le_tan', 'y_ta'],
      required: true,
    },
    tao_boi: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true }, // Admin
    ngay_gui: { type: Date, default: null },
    so_nguoi_nhan: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['da_gui'],
      default: 'da_gui',
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'thong_bao_he_thong',
  }
)

systemNotificationSchema.index({ tao_boi: 1 })
systemNotificationSchema.index({ ngay_gui: -1 })

export default mongoose.model('ThongBaoHeThong', systemNotificationSchema)
