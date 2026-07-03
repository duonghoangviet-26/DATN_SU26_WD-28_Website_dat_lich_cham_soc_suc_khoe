import mongoose from 'mongoose'

// ============================================================
// REVIEW — Đánh giá bác sĩ sau khám (B5, C6)
// SQL tương đương: reviews
// ============================================================
// 1 lịch hẹn 1 đánh giá (appointment_id unique), không sửa lại.
// Khi status đổi (visible/hidden): tầng service cập nhật doctors.diem_danh_gia & tong_danh_gia.
// Bác sĩ KHÔNG thấy review status='hidden'.

const reviewSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
      unique: true,
    },
    user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', required: true },
    so_sao: {
      type: Number,
      required: true,
      min: [1, 'Số sao tối thiểu 1'],
      max: [5, 'Số sao tối đa 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Số sao phải là số nguyên 1-5',
      },
    },
    noi_dung: { type: String, default: null, maxlength: 500 },
    status: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
    },
    ngay_xoa: {
      type: Date,
      default: null,
    },
    nguoi_xoa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'danh_gia',
  }
)

reviewSchema.index({ doctor_id: 1, status: 1, so_sao: 1 })
reviewSchema.index({ user_id: 1 }) // query "đánh giá của tôi"
reviewSchema.index({ status: 1 })
reviewSchema.index({ ngay_xoa: 1 })

export default mongoose.model('DanhGia', reviewSchema)
