import mongoose from 'mongoose'

const isHHMM = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const nghiPhepBacSiSchema = new mongoose.Schema(
  {
    bac_si_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      required: true,
    },
    tu_ngay: {
      type: Date,
      required: true,
    },
    den_ngay: {
      type: Date,
      required: true,
    },
    // Khung giờ nghỉ trong ngày (vd nghỉ đúng 1 ca) — để trống nghĩa là nghỉ cả ngày.
    gio_bat_dau: {
      type: String,
      default: null,
      validate: { validator: isHHMM, message: 'gio_bat_dau phai dang HH:MM' },
    },
    gio_ket_thuc: {
      type: String,
      default: null,
      validate: { validator: isHHMM, message: 'gio_ket_thuc phai dang HH:MM' },
    },
    ly_do: {
      type: String,
      default: null,
      maxlength: 500,
    },
    trang_thai: {
      type: String,
      enum: ['cho_duyet', 'da_duyet', 'tu_choi', 'da_huy'],
      default: 'cho_duyet',
    },
    nguoi_duyet_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    thoi_diem_duyet: {
      type: Date,
      default: null,
    },
    ghi_chu: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'nghi_phep_bac_si',
  }
)

nghiPhepBacSiSchema.pre('validate', function () {
  if (this.tu_ngay && this.den_ngay && this.den_ngay < this.tu_ngay) {
    throw new Error('den_ngay phai >= tu_ngay')
  }
})

nghiPhepBacSiSchema.index({ bac_si_id: 1, tu_ngay: 1, den_ngay: 1 })
nghiPhepBacSiSchema.index({ trang_thai: 1 })

export default mongoose.model('NghiPhepBacSi', nghiPhepBacSiSchema)
