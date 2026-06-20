import mongoose from 'mongoose'

// ============================================================
// FAMILY — Nhóm gia đình (A2)
// SQL tương đương: bảng families
// ============================================================
// 1 tài khoản chỉ có 1 nhóm gia đình (user_id unique).

const familySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
      unique: true,
    },
    ten_nhom: {
      type: String,
      required: [true, 'Tên nhóm gia đình là bắt buộc'],
      trim: true,
      maxlength: 255,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'gia_dinh',
  }
)

export default mongoose.model('GiaDinh', familySchema)
