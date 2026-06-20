import mongoose from 'mongoose'

// ============================================================
// PAYMENT — Thanh toán mock VitaPay (A5, C8)
// SQL tương đương: payments
// ============================================================
// 1 lịch hẹn 1 payment (appointment_id unique).
// Phòng khám tư: số tiền là DOANH THU TRỰC TIẾP của phòng khám (không chia hoa hồng).

const paymentSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
      unique: true,
    },
    benh_nhan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
    },
    so_tien: { type: Number, required: true, min: [0, 'Số tiền không được âm'] },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    phuong_thuc: { type: String, default: 'mock', maxlength: 50 }, // VitaPay
    ngay_thanh_toan: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' }, // track thay đổi status: pending→paid/failed/refunded
    collection: 'thanh_toan',
  }
)

paymentSchema.index({ benh_nhan_id: 1 })
paymentSchema.index({ status: 1 })

export default mongoose.model('ThanhToan', paymentSchema)
