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
    so_ngay: {
      type: Number,
      required: [true, 'So ngay uong la bat buoc'],
      min: [1, 'So ngay uong toi thieu la 1'],
      max: [MAX_NGAY, `So ngay uong toi da ${MAX_NGAY} ngay`],
    },
    ghi_chu: { type: String, default: null, maxlength: 500 },
  },
  { _id: true }
)

const prescriptionSchema = new mongoose.Schema(
  {
    ket_qua_kham_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KetQuaKham',
      required: true,
    },
    // Dù tên field gợi ý 'HoSoYTe', toàn bộ code ghi/đọc thực tế đều gán _id của KetQuaKham vào
    // đây (xem doctor/appointments.controller.js createResult/updateResult) — ref khai đúng
    // theo dữ liệu thật để .populate() hoạt động (trước đây khai nhầm 'HoSoYTe', khiến admin
    // xem đơn thuốc luôn ra null — xem docs/Bác sĩ/Audit tong the, GAP-006).
    medical_record_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KetQuaKham',
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
      enum: ['bac_si', 'tu_nhap', 'y_ta'],
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
