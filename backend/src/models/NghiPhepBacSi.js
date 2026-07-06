import mongoose from 'mongoose'

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
    ly_do: {
      type: String,
      default: null,
      maxlength: 500,
    },
    trang_thai: {
      type: String,
      enum: ['cho_duyet', 'da_duyet', 'tu_choi'],
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
