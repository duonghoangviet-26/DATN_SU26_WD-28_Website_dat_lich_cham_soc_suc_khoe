import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email la bat buoc'],
      lowercase: true,
      trim: true,
      maxlength: 255,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email khong dung dinh dang'],
    },
    mat_khau: {
      type: String,
      default: null,
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
    anh_dai_dien_google: { type: String, default: null, maxlength: 500 },
    google_id: {
      type: String,
      default: null,
      sparse: true,
    },
    providers: {
      type: [String],
      enum: ['local', 'google'],
      default: ['local'],
    },
    email_verified: {
      type: Boolean,
      default: false,
    },
    last_login_at: { type: Date, default: null },
    last_login_provider: { type: String, default: null },
    requires_onboarding: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ['user', 'patient', 'doctor', 'admin', 'receptionist'],
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
    totp_secret: { type: String, default: null, select: false },
    is_2fa_enabled: { type: Boolean, default: false },
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
userSchema.index(
  { google_id: 1 },
  {
    sparse: true,
    partialFilterExpression: { ngay_xoa: null },
  }
)
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { ngay_xoa: null },
  }
)

export default mongoose.model('NguoiDung', userSchema)
