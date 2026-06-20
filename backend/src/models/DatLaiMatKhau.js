import mongoose from 'mongoose'

// ============================================================
// PASSWORD RESET — OTP quên mật khẩu
// SQL tương đương: bảng password_resets
// ============================================================
// OTP 6 chữ số, hết hạn 15 phút
// Mỗi lần gửi mới: đánh dấu da_su_dung=true tất cả OTP cũ trước khi tạo mới

const passwordResetSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
    },
    ma_otp:    { type: String, required: true, length: 6 },
    het_han:   { type: Date,   required: true }, // now + 15 phút
    da_su_dung:{ type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'dat_lai_mat_khau',
  }
)

passwordResetSchema.index({ user_id: 1 })
passwordResetSchema.index({ ma_otp: 1 })
// TTL index: tự động xóa document hết hạn sau 1 giờ (dọn rác)
passwordResetSchema.index({ het_han: 1 }, { expireAfterSeconds: 3600 })

export default mongoose.model('DatLaiMatKhau', passwordResetSchema)
