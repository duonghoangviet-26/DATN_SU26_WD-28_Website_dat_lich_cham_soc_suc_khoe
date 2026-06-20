import mongoose from 'mongoose'

// ============================================================
// SERVICE — Gói dịch vụ khám (C4)
// SQL tương đương: bảng services (+ mở rộng C4 V4)
// ============================================================
// loai: 'clinic' (tại phòng khám) | 'home' (bác sĩ đến nhà) — KHÔNG có 'video'.
// gia: được snapshot vào appointment.gia_kham lúc đặt → đổi giá sau không ảnh hưởng lịch cũ.
// ma_dich_vu: backend tự sinh "DV001", "DV002"... (client KHÔNG truyền vào).
// khu_vuc[]: chỉ có ý nghĩa khi loai='home'; clinic → mảng rỗng.

const serviceSchema = new mongoose.Schema(
  {
    ma_dich_vu: { type: String, unique: true, trim: true }, // auto-gen, xem pre-validate
    ten: {
      type: String,
      required: [true, 'Tên dịch vụ là bắt buộc'],
      trim: true,
      maxlength: 255,
    },
    loai: {
      type: String,
      enum: ['clinic', 'home'],
      required: [true, 'Loại dịch vụ là bắt buộc'],
    },
    mo_ta_ngan: { type: String, default: null, maxlength: 500 },
    mo_ta:      { type: String, default: null, maxlength: 5000 },
    gia: {
      type: Number,
      required: [true, 'Giá dịch vụ là bắt buộc'],
      min: [0, 'Giá không được âm'],
    },
    thoi_gian_phut: {
      type: Number,
      required: [true, 'Thời gian thực hiện là bắt buộc'],
      min: [10, 'Thời gian tối thiểu 10 phút'],
      max: [480, 'Thời gian tối đa 480 phút'],
    },
    gio_dat_truoc_toi_thieu: { type: Number, default: 2 }, // giờ
    ngay_ap_dung: { type: String, default: null, maxlength: 100 }, // "T2-T7"
    gio_bat_dau:  { type: String, default: null }, // "08:00"
    gio_ket_thuc: { type: String, default: null }, // "17:00"
    specialty_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChuyenKhoa', default: null },
    khu_vuc:      { type: [String], default: [] }, // home only
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'dich_vu',
  }
)

// Cùng tên được phép nếu khác chuyên khoa
serviceSchema.index({ ten: 1, specialty_id: 1 }, { unique: true })
serviceSchema.index({ status: 1, loai: 1 })

// Tự sinh ma_dich_vu "DVxxx" nếu chưa có (lấy số lớn nhất hiện có + 1)
// Mongoose 9: hook async KHÔNG nhận next → throw để báo lỗi.
serviceSchema.pre('validate', async function () {
  if (!this.ma_dich_vu) {
    const last = await this.constructor
      .findOne({ ma_dich_vu: /^DV\d+$/ })
      .sort({ ma_dich_vu: -1 })
      .select('ma_dich_vu')
      .lean()
    const lastNum = last ? parseInt(last.ma_dich_vu.slice(2), 10) : 0
    this.ma_dich_vu = 'DV' + String(lastNum + 1).padStart(3, '0')
  }
  // clinic không có khu vực
  if (this.loai === 'clinic') this.khu_vuc = []
})

export default mongoose.model('DichVu', serviceSchema)
