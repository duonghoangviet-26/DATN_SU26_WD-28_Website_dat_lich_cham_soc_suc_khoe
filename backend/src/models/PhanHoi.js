import mongoose from 'mongoose'

const phanHoiSchema = new mongoose.Schema(
  {
    ho_ten: {
      type: String,
      required: [true, 'Vui lòng cung cấp họ tên'],
      trim: true,
      maxlength: 255,
    },
    email_sdt: {
      type: String,
      required: [true, 'Vui lòng cung cấp email hoặc số điện thoại'],
      trim: true,
      maxlength: 255,
    },
    noi_dung: {
      type: String,
      required: [true, 'Vui lòng nhập nội dung phản hồi'],
    },
    hinh_anh: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'read'],
      default: 'pending',
    },
    ngay_tao: {
      type: Date,
      default: Date.now,
    },
    ngay_cap_nhat: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'phan_hoi',
  }
)

export default mongoose.model('PhanHoi', phanHoiSchema)
