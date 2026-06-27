import mongoose from 'mongoose'

// ============================================================
// USER — Tài khoản người dùng (benh nhan / bac si / admin)
// SQL tương đương: bảng users
// ============================================================
// Role chỉ đổi sang 'doctor' SAU KHI Admin duyệt hồ sơ bác sĩ (C2)
// password hash bằng bcrypt 10 rounds — không lưu plaintext

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
      // Không đổi sau khi đăng ký
    },
    mat_khau: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc'],
      maxlength: 255,
      select: false, // Không trả về trong query thông thường
    },
    ho_ten: {
      type: String,
      required: [true, 'Họ tên là bắt buộc'],
      trim: true,
      maxlength: 255,
    },
    so_dien_thoai: { type: String, default: null, maxlength: 20 },
    anh_dai_dien:  { type: String, default: null, maxlength: 500 },
    role: {
      type: String,
      enum: ['user', 'doctor', 'admin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'locked'],
      default: 'active',
    },
    ngay_xoa: { type: Date, default: null }, // Hỗ trợ Soft Delete
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'nguoi_dung',
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        ret.id = ret._id.toString()
        delete ret._id
        delete ret.__v
        delete ret.mat_khau
      }
    }
  }
)

userSchema.index({ role: 1 })
userSchema.index({ status: 1 })

export default mongoose.model('NguoiDung', userSchema)
