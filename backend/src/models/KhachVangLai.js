import mongoose from 'mongoose'

const khachVangLaiSchema = new mongoose.Schema(
  {
    ho_ten: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    so_dien_thoai: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    ngay_sinh: {
      type: Date,
      default: null,
    },
    gioi_tinh: {
      type: String,
      enum: ['nam', 'nu', 'khac'],
      default: null,
    },
    dia_chi: {
      type: String,
      default: null,
      maxlength: 500,
    },
    ghi_chu: {
      type: String,
      default: null,
      maxlength: 500,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'khach_vang_lai',
  }
)

khachVangLaiSchema.index({ so_dien_thoai: 1 })

export default mongoose.model('KhachVangLai', khachVangLaiSchema)
