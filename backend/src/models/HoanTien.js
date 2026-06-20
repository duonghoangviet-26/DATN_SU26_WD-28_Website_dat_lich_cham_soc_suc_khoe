import mongoose from 'mongoose'

// ============================================================
// REFUND — Hoàn tiền sau khi hủy lịch (C8)
// SQL tương đương: refunds
// ============================================================
// 1 lịch hẹn 1 refund (appointment_id unique) → refund bị rejected KHÔNG tạo lại.
// phan_tram_hoan tính theo chính sách thời gian, lấy từ payment_settings.

const refundSchema = new mongoose.Schema(
  {
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ThanhToan',
      required: true,
    },
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
      unique: true,
    },
    so_tien_hoan: { type: Number, required: true, min: 0 },
    phan_tram_hoan: {
      type: Number,
      required: true,
      enum: [0, 50, 80, 100],
    },
    ly_do: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'completed', 'rejected'],
      default: 'pending',
    },
    ly_do_tu_choi: { type: String, default: null }, // bắt buộc khi rejected (tầng service)
    xu_ly_boi: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null }, // Admin
    ngay_yeu_cau: { type: Date, default: Date.now },
    ngay_xu_ly:   { type: Date, default: null },
  },
  {
    timestamps: false,
    collection: 'hoan_tien',
  }
)

refundSchema.index({ status: 1 })
refundSchema.index({ payment_id: 1 })

export default mongoose.model('HoanTien', refundSchema)
