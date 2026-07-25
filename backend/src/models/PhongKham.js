import mongoose from 'mongoose'

// ============================================================
// PHONG KHAM - Danh sách phòng khám nhỏ do Admin quản lý.
// ============================================================
// Vai trò:
//   - Admin tạo/sửa/ẩn phòng nhỏ.
//   - Gán bác sĩ/y tá phụ trách phòng.
//   - Lưu snapshot full_name vào lịch làm việc/lịch hẹn để không vỡ lịch cũ khi đổi tên phòng.
//
// full_name (virtual): "{ten}, Tầng {tang}, Tòa {toa}".

const phongKhamSchema = new mongoose.Schema(
  {
    ten: {
      type: String,
      required: [true, 'Tên phòng là bắt buộc'],
      trim: true,
      maxlength: 50,
    },
    tang: {
      type: Number,
      required: [true, 'Tầng là bắt buộc'],
      min: [1, 'Tầng tối thiểu là 1'],
    },
    toa: {
      type: String,
      required: [true, 'Tòa là bắt buộc'],
      default: 'ViteFamily',
      trim: true,
      maxlength: 50,
    },
    loai: {
      type: String,
      required: [true, 'Loại phòng là bắt buộc'],
      trim: true,
      maxlength: 100,
    },
    trang_thai: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    doctor_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      default: [],
    }],
    nurse_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: [],
    }],
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'phong_kham',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Virtual: khớp với snapshot phòng khám trong lịch làm việc và lịch hẹn.
phongKhamSchema.virtual('full_name').get(function () {
  return `${this.ten}, Tầng ${this.tang}, Tòa ${this.toa}`
})

// Unique: mỗi tòa+tầng không có 2 phòng trùng tên.
phongKhamSchema.index({ ten: 1, tang: 1, toa: 1 }, { unique: true })
phongKhamSchema.index({ trang_thai: 1 })
phongKhamSchema.index({ tang: 1, toa: 1 })

export default mongoose.model('PhongKham', phongKhamSchema)
