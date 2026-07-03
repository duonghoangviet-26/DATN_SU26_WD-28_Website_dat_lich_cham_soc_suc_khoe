import mongoose from 'mongoose'

// ============================================================
// PAYMENT — Thanh toán VitaPay (A5, C8)
// SQL tương đương: payments
// ============================================================
// 1 lịch hẹn 1 payment (appointment_id unique).
// Phòng khám tư: số tiền là DOANH THU TRỰC TIẾP của phòng khám (không chia hoa hồng).
// ma_giao_dich: backend tự sinh "TXN001", "TXN002"... — frontend dùng để hiển thị và tra cứu.
// status (transaction): pending → paid/failed; paid → refunded (hoàn tiền khi hủy lịch).
//   KHÔNG nhầm với LichHen.payment_status (unpaid/paid/refunded) — đây là trạng thái giao dịch.
//
// Luồng mới (Phương án C):
//   ThanhToan được tạo ĐỒNG THỜI với LichHen — cả 2 trong cùng 1 transaction sau gateway callback.
//   gateway_transaction_id: ID từ VNPay/MoMo để tra cứu & verify webhook signature.
//   gateway_response: raw response lưu để audit nếu có dispute thanh toán.
//   Hoàn tiền (refunded): Admin/System trigger → gọi gateway refund API → cập nhật status='refunded'.

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
      default: null,
    },
    // Mã giao dịch hiển thị — auto-gen "TXNxxx" (xem pre-validate hook)
    ma_giao_dich: { type: String, unique: true, sparse: true, maxlength: 20 },
    so_tien: { type: Number, required: true, min: [0, 'Số tiền không được âm'] },
    phuong_thuc: {
      type: String,
      enum: ['momo', 'vnpay', 'cash', 'bank', 'mock'],
      default: 'mock', // 'mock' dùng trong dev — đổi thành phuong_thuc thực khi go-live
    },
    status: {
      type: String,
      // pending: đang xử lý | paid: thành công | failed: thất bại | refunded: đã hoàn tiền
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    ngay_thanh_toan: { type: Date, default: null },
    ngay_hoan_tien:  { type: Date, default: null }, // set khi status → refunded

    // Gateway integration (VNPay / MoMo / mock)
    // ID giao dịch phía gateway — dùng để gọi refund API và verify webhook
    gateway_transaction_id: { type: String, default: null, maxlength: 100 },
    // Raw response từ gateway — lưu để audit dispute, không dùng trong logic
    gateway_response: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'thanh_toan',
  }
)

paymentSchema.index({ benh_nhan_id: 1 })
paymentSchema.index({ status: 1 })

// Tự sinh ma_giao_dich "TXNxxx" nếu chưa có
paymentSchema.pre('validate', async function () {
  if (!this.ma_giao_dich) {
    const last = await this.constructor
      .findOne({ ma_giao_dich: /^TXN\d+$/ })
      .sort({ ma_giao_dich: -1 })
      .select('ma_giao_dich')
      .lean()
    const lastNum = last ? parseInt(last.ma_giao_dich.slice(3), 10) : 0
    this.ma_giao_dich = 'TXN' + String(lastNum + 1).padStart(4, '0')
  }
})

export default mongoose.model('ThanhToan', paymentSchema)
