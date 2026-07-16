import mongoose from 'mongoose'

const isHHMM = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

// ============================================================
// NGHI PHEP Y TA — y tá tự xin nghỉ → admin duyệt.
// KHÁC NghiPhepBacSi: nghỉ y tá KHÔNG khóa ca (bác sĩ vẫn khám) mà admin
// gán y_ta_thay_id lúc duyệt → cập nhật LichLamViec.nurse_id (làm ở plan sau).
// y_ta_id ref 'NguoiDung' (role='nurse') — hệ thống không có model YTa riêng.
// ============================================================

const nghiPhepYTaSchema = new mongoose.Schema(
  {
    y_ta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
    tu_ngay: { type: Date, required: true },
    den_ngay: { type: Date, required: true },
    gio_bat_dau: { type: String, default: null, validate: { validator: isHHMM, message: 'gio_bat_dau phai dang HH:MM' } },
    gio_ket_thuc: { type: String, default: null, validate: { validator: isHHMM, message: 'gio_ket_thuc phai dang HH:MM' } },
    ly_do: { type: String, default: null, maxlength: 500 },
    trang_thai: {
      type: String,
      enum: ['cho_duyet', 'da_duyet', 'tu_choi', 'da_huy'],
      default: 'cho_duyet',
    },
    nguoi_duyet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    thoi_diem_duyet: { type: Date, default: null },
    ghi_chu: { type: String, default: null, maxlength: 500 },
    y_ta_thay_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'nghi_phep_y_ta',
  }
)

nghiPhepYTaSchema.pre('validate', function () {
  if (this.tu_ngay && this.den_ngay && this.den_ngay < this.tu_ngay) {
    throw new Error('den_ngay phai >= tu_ngay')
  }
})

nghiPhepYTaSchema.index({ y_ta_id: 1, tu_ngay: 1, den_ngay: 1 })
nghiPhepYTaSchema.index({ trang_thai: 1 })

export default mongoose.model('NghiPhepYTa', nghiPhepYTaSchema)
