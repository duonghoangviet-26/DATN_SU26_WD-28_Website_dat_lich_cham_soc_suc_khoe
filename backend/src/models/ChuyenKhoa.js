import mongoose from 'mongoose'

// ============================================================
// SPECIALTY — Chuyên khoa y tế (C3)
// SQL tương đương: bảng specialties
// ============================================================
// slug auto-generate từ tên (URL-friendly), unique.
// status 'hidden' = ẩn khỏi tìm kiếm, không xóa để giữ dữ liệu cũ.

const specialtySchema = new mongoose.Schema(
  {
    ten: {
      type: String,
      required: [true, 'Tên chuyên khoa là bắt buộc'],
      trim: true,
      maxlength: 255,
    },
    mo_ta:    { type: String, default: null },
    icon_url: { type: String, default: null, maxlength: 500 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    thu_tu: { type: Number, default: 0 }, // thứ tự hiển thị
    status: {
      type: String,
      enum: ['active', 'hidden'],
      default: 'active',
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'chuyen_khoa',
  }
)

specialtySchema.index({ status: 1 })
specialtySchema.index({ thu_tu: 1 })

// Tự sinh slug từ tên nếu chưa có (bỏ dấu tiếng Việt + kebab-case)
function toSlug(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh tiếng Việt (Unicode combining marks U+0300–U+036F)
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

specialtySchema.pre('validate', function () {
  if (!this.slug && this.ten) this.slug = toSlug(this.ten)
})

export default mongoose.model('ChuyenKhoa', specialtySchema)
