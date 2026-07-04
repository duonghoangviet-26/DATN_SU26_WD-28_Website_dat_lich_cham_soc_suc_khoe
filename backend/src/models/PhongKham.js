import mongoose from 'mongoose'

// ============================================================
// PHONG KHAM — Danh sách phòng khám (quản lý qua C3)
// Không có trong SQL gốc (SQL chỉ track bệnh viện/cơ sở).
// Team thêm để quản lý phòng vật lý trong phòng khám tư 1 cơ sở.
// ============================================================
// Vai trò:
//   - Admin tạo/sửa/ẩn phòng qua C3 (bước "Bệnh viện & Chuyên khoa").
//   - Khi Admin duyệt bác sĩ (C2), gán BacSi.phong_kham_mac_dinh = PhongKham.full_name.
//   - Cron sinh slot: copy phong_kham_mac_dinh vào slot.phong_kham (String snapshot).
//   - LichLamViec.slots[].phong_kham và LichHen.phong_kham lưu full_name dạng String snapshot
//     → không ref ObjectId để tránh lịch cũ bị ảnh hưởng khi phòng bị đổi tên/xóa.
//
// full_name (virtual): "{ten}, Tầng {tang}, Tòa {toa}" — khớp với DoctorSlot.phong_kham frontend.
// Seed 8 phòng ban đầu qua script backend/src/seeds/phong-kham.seed.js.

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
      trim: true,
      uppercase: true,
      maxlength: 5,
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
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'phong_kham',
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Virtual: khớp với DoctorSlot.phong_kham và LichHen.phong_kham trong frontend
phongKhamSchema.virtual('full_name').get(function () {
  return `${this.ten}, Tầng ${this.tang}, Tòa ${this.toa}`
})

// Unique: mỗi tòa+tầng không có 2 phòng trùng tên
phongKhamSchema.index({ ten: 1, toa: 1 }, { unique: true })
phongKhamSchema.index({ trang_thai: 1 })
phongKhamSchema.index({ tang: 1, toa: 1 })

export default mongoose.model('PhongKham', phongKhamSchema)
