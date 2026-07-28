import mongoose from 'mongoose'

const tinTucSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tiêu đề là bắt buộc'],
      trim: true,
      maxlength: [200, 'Tiêu đề không vượt quá 200 ký tự'],
    },
    slug: {
      type: String,
      required: [true, 'Tiêu đề ngắn là bắt buộc'],
      trim: true,
    },
    url_slug: {
      type: String,
      required: [true, 'Đường dẫn hệ thống là bắt buộc'],
      lowercase: true,
      trim: true,
      maxlength: [220, 'Đường dẫn hệ thống không vượt quá 220 ký tự'],
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Đường dẫn hệ thống chỉ gồm chữ thường, số và dấu gạch ngang'],
    },
    image: {
      type: String,
      required: [true, 'Ảnh đại diện là bắt buộc'],
      trim: true,
      maxlength: [1000, 'URL ảnh không vượt quá 1000 ký tự'],
    },
    content: {
      type: String,
      required: [true, 'Nội dung là bắt buộc'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'hidden'],
      default: 'published',
    },
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    author_name: {
      type: String,
      default: null,
      trim: true,
      maxlength: 255,
    },
    view_count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'tin_tuc',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

tinTucSchema.index({ url_slug: 1 }, { unique: true })
tinTucSchema.index({ status: 1, created_at: -1 })
tinTucSchema.index({ title: 'text', slug: 'text', content: 'text' })

export default mongoose.model('TinTuc', tinTucSchema)
