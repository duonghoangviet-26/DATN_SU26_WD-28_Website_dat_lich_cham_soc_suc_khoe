import mongoose from 'mongoose'
import Counter from './Counter.js'

// ============================================================
// SERVICE — Dịch vụ y tế (C4)
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
      maxlength: [255, 'Tên dịch vụ không vượt quá 255 ký tự'],
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
      min:      [1, 'Giá phải lớn hơn 0'],
      max:      [100_000_000, 'Giá không vượt quá 100 triệu'],
      validate: {
        validator: (v) => Number.isInteger(v),
        message:   'Giá phải là số nguyên (VNĐ)',
      },
    },
    // Cố định theo loại: related=30ph | home=60ph — hook set, controller không nhận từ body
    thoi_gian_phut: {
      type: Number,
      default: null,
      min: [10, 'Thời gian tối thiểu 10 phút'],
      max: [480, 'Thời gian tối đa 480 phút'],
    },
    // home only — validate range trong controller (1–48)
    gio_dat_truoc_toi_thieu: {
      type: Number,
      default: 4,
      min: [1,  'Đặt trước tối thiểu 1 giờ'],
      max: [48, 'Đặt trước tối đa 48 giờ'],
    },
    // Lịch cố định T2–T7 08:00–17:00, set bởi hook nếu chưa có
    ngay_ap_dung: { type: String, default: null, maxlength: 100 },
    gio_bat_dau:  { type: String, default: null },
    gio_ket_thuc: { type: String, default: null },
    // related only — hướng dẫn chuẩn bị cho bệnh nhân trước khi thực hiện dịch vụ
    chuan_bi_truoc: { type: String, default: null, maxlength: 1000 },
    // related: required (validate controller) | home: không dùng
    specialty_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChuyenKhoa', default: null },
    khu_vuc:      { type: [String], default: [] }, // home only
    nguoi_tao_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    // inactive mặc định — Admin review nội dung trước khi công khai (tránh BN thấy giá/mô tả sai)
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'inactive',
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

// Tự sinh ma_dich_vu dùng atomic counter — tránh race condition khi tạo đồng thời
// Chú ý: validation nghiệp vụ (specialty_id required cho related) được xử lý ở controller
//        để trả 400 thay vì 500
serviceSchema.pre('validate', async function () {
  if (!this.ma_dich_vu) {
    const seq = await Counter.nextSeq('dich_vu')
    this.ma_dich_vu = 'DV' + String(seq).padStart(3, '0')
  }
  if (this.loai === 'home') {
    // Đặt lịch cố định T2–T7 08:00–17:00 — có ý nghĩa vì home đặt lịch riêng (chọn BS + slot)
    if (!this.ngay_ap_dung) this.ngay_ap_dung = 'T2–T7'
    if (!this.gio_bat_dau)  this.gio_bat_dau  = '08:00'
    if (!this.gio_ket_thuc) this.gio_ket_thuc = '17:00'
    if (!this.thoi_gian_phut) this.thoi_gian_phut = 60
    this.chuan_bi_truoc = null // home không dùng chuan_bi_truoc
  }
  if (this.loai === 'related') {
    // related không đặt lịch riêng (đi kèm khám clinic, BS chỉ định) → thời lượng/lịch áp dụng
    // vô nghĩa, để null thay vì giá trị giả (tránh hiển thị nhầm như 1 dịch vụ đặt lịch được).
    this.thoi_gian_phut = null
    this.ngay_ap_dung    = null
    this.gio_bat_dau     = null
    this.gio_ket_thuc    = null
    this.khu_vuc         = []
    // specialty_id required for related — validated in controller trả 400, không throw ở đây
  }
})

export default mongoose.model('DichVu', serviceSchema)
