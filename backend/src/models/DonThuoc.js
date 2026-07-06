import mongoose from 'mongoose'

const MAX_ITEMS = 10
const MAX_NGAY = 90

const isHHMM = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const itemSchema = new mongoose.Schema(
  {
    ten_thuoc: {
      type: String,
      required: [true, 'Ten thuoc la bat buoc'],
      trim: true,
      maxlength: 255,
    },
    lieu_luong: { type: String, default: null, maxlength: 100 },
    tan_suat: { type: String, default: null, maxlength: 100 },
    gio_uong: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.every(isHHMM),
        message: 'gio_uong phai la mang gio dang HH:MM',
      },
    },
    ngay_bat_dau: { type: Date, required: true },
    ngay_ket_thuc: { type: Date, required: true },
    ghi_chu: { type: String, default: null, maxlength: 500 },
  },
  { _id: true }
)

itemSchema.pre('validate', function () {
  if (this.ngay_bat_dau && this.ngay_ket_thuc) {
    if (this.ngay_ket_thuc < this.ngay_bat_dau) {
      throw new Error('ngay_ket_thuc phai >= ngay_bat_dau')
    }

    const days = (this.ngay_ket_thuc - this.ngay_bat_dau) / (1000 * 60 * 60 * 24)
    if (days > MAX_NGAY) {
      throw new Error(`Moi thuoc toi da ${MAX_NGAY} ngay`)
    }
  }
})

const prescriptionSchema = new mongoose.Schema(
  {
    ket_qua_kham_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KetQuaKham',
      required: true,
    },
    medical_record_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HoSoYTe',
      default: null,
    },
    member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ThanhVien',
      default: null,
    },
    ten_khach: { type: String, default: null, maxlength: 255 },
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
    nguon: {
      type: String,
      enum: ['bac_si', 'tu_nhap'],
      default: 'tu_nhap',
    },
    ghi_chu: { type: String, default: null },
    items: {
      type: [itemSchema],
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= MAX_ITEMS,
        message: `Don thuoc phai co tu 1 den ${MAX_ITEMS} thuoc`,
      },
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'don_thuoc',
  }
)

prescriptionSchema.pre('validate', function () {
  if (this.nguon === 'tu_nhap' && !this.member_id) {
    throw new Error('Don thuoc tu nhap (tu_nhap) phai co member_id')
  }
})

prescriptionSchema.index({ member_id: 1 })
prescriptionSchema.index({ medical_record_id: 1 })
prescriptionSchema.index({ ket_qua_kham_id: 1 })

export default mongoose.model('DonThuoc', prescriptionSchema)
