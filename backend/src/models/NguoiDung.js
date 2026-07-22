import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email la bat buoc'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    mat_khau: {
      type: String,
      required: [true, 'Mat khau la bat buoc'],
      maxlength: 255,
      select: false,
    },
    ho_ten: {
      type: String,
      required: [true, 'Ho ten la bat buoc'],
      trim: true,
      maxlength: 255,
    },
    so_dien_thoai: { type: String, default: null, maxlength: 20 },
    anh_dai_dien: { type: String, default: null, maxlength: 500 },
    role: {
      type: String,
      enum: ['user', 'patient', 'doctor', 'admin', 'receptionist', 'nurse'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'locked'],
      default: 'active',
    },
    so_lan_huy_trong_thang: {
      type: Number,
      default: 0,
      min: 0,
    },
    thang_dem_huy: {
      type: String,
      default: null,
    },
    bi_han_che_dat_lich: {
      type: Boolean,
      default: false,
    },
    han_che_den_ngay: {
      type: Date,
      default: null,
    },
    tong_so_lan_huy_lich_su: {
      type: Number,
      default: 0,
      min: 0,
    },
    ngay_xoa: { type: Date, default: null },
    reset_password_token: { type: String, default: null },
    reset_password_expire: { type: Date, default: null },
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
      },
    },
  }
)

userSchema.index({ role: 1 })
userSchema.index({ status: 1 })

export default mongoose.model('NguoiDung', userSchema)
