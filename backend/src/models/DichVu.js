import mongoose from 'mongoose'

// ============================================================
// SERVICE — Dịch vụ y tế (C4)
// SQL tương đương: bảng services (+ mở rộng C4 V4)
// ============================================================
// loai: 'home'    → bác sĩ đến nhà — đặt được, có thoi_gian_phut, khu_vuc[].
//        'related' → dịch vụ liên quan theo chuyên khoa (X-quang, MRI, xét nghiệm...)
//                    CHỈ hiển thị thông tin "Theo chỉ định bác sĩ", KHÔNG đặt lịch riêng.
//                    Bắt buộc có specialty_id. Không cần thoi_gian_phut.
// gia: 'home' → snapshot vào LichHen.gia_kham lúc đặt.
//      'related' → chỉ hiển thị tham khảo.
// ma_dich_vu: backend tự sinh "DV001", "DV002"... (client KHÔNG truyền vào).
// Giá khám clinic (30 phút/slot) lưu trực tiếp ở BacSi.gia_kham — KHÔNG phải DichVu.

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
      enum: ['home', 'related'],
      required: [true, 'Loại dịch vụ là bắt buộc'],
    },
    mo_ta_ngan: { type: String, default: null, maxlength: 500 },
    mo_ta:      { type: String, default: null, maxlength: 5000 },
    gia: {
      type: Number,
      required: [true, 'Giá dịch vụ là bắt buộc'],
      min: [0, 'Giá không được âm'],
    },
    // home: required (validate trong hook) | related: null — không đặt lịch
    thoi_gian_phut: {
      type: Number,
      default: null,
      min: [10, 'Thời gian tối thiểu 10 phút'],
      max: [480, 'Thời gian tối đa 480 phút'],
    },
    gio_dat_truoc_toi_thieu: { type: Number, default: 2 }, // giờ — home only
    ngay_ap_dung: { type: String, default: null, maxlength: 100 }, // "T2-T7" — home only
    gio_bat_dau:  { type: String, default: null }, // "08:00" — home only
    gio_ket_thuc: { type: String, default: null }, // "17:00" — home only
    // related: required | home: optional (phục vụ lọc theo khoa)
    specialty_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChuyenKhoa', default: null },
    khu_vuc:      { type: [String], default: [] }, // home only — khu vực phục vụ tại nhà
    nguoi_tao_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
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
  if (this.loai === 'home') {
    if (!this.thoi_gian_phut) throw new Error('Dịch vụ tại nhà (home) bắt buộc có thoi_gian_phut')
    if (this.thoi_gian_phut > 480) throw new Error('Thời gian tối đa 480 phút')
  }
  if (this.loai === 'related') {
    if (!this.specialty_id) throw new Error('Dịch vụ liên quan (related) bắt buộc có specialty_id')
    this.thoi_gian_phut = null
    this.khu_vuc = []
  }
})

export default mongoose.model('DichVu', serviceSchema)
