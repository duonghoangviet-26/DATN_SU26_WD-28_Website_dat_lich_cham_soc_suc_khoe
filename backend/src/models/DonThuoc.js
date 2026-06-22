import mongoose from 'mongoose'

// ============================================================
// PRESCRIPTION — Đơn thuốc (A4, B4)
// SQL tương đương: prescriptions + prescription_items (embed)
// ============================================================
// nguon='bac_si': bệnh nhân KHÔNG được xóa | nguon='tu_nhap': bệnh nhân tự quản lý.
// items: tối đa 10 thuốc/đơn; mỗi thuốc tối đa 90 ngày.

const MAX_ITEMS = 10
const MAX_NGAY = 90

// "HH:MM" hợp lệ
const isHHMM = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

const itemSchema = new mongoose.Schema(
  {
    ten_thuoc: {
      type: String,
      required: [true, 'Tên thuốc là bắt buộc'],
      trim: true,
      maxlength: 255,
    },
    lieu_luong: { type: String, default: null, maxlength: 100 }, // "1 viên"
    tan_suat:   { type: String, default: null, maxlength: 100 }, // "2 lần/ngày"
    gio_uong: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.every(isHHMM),
        message: 'gio_uong phải là mảng giờ dạng HH:MM',
      },
    },
    ngay_bat_dau:  { type: Date, required: true },
    ngay_ket_thuc: { type: Date, required: true },
    ghi_chu: { type: String, default: null, maxlength: 500 }, // ghi chú riêng cho từng thuốc
  },
  { _id: true }
)

// ngay_ket_thuc >= ngay_bat_dau và không quá 90 ngày
itemSchema.pre('validate', function () {
  if (this.ngay_bat_dau && this.ngay_ket_thuc) {
    if (this.ngay_ket_thuc < this.ngay_bat_dau) {
      throw new Error('ngay_ket_thuc phải >= ngay_bat_dau')
    }
    const days = (this.ngay_ket_thuc - this.ngay_bat_dau) / (1000 * 60 * 60 * 24)
    if (days > MAX_NGAY) {
      throw new Error(`Mỗi thuốc tối đa ${MAX_NGAY} ngày`)
    }
  }
})

const prescriptionSchema = new mongoose.Schema(
  {
    medical_record_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HoSoYTe', default: null },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ThanhVien', default: null }, // null khi bác sĩ kê cho khách (guest)
    ten_khach: { type: String, default: null, maxlength: 255 }, // điền khi member_id=null
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
        message: `Đơn thuốc phải có từ 1 đến ${MAX_ITEMS} thuốc`,
      },
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'don_thuoc',
  }
)

// nguon='tu_nhap': member_id bắt buộc (bệnh nhân tự quản lý hồ sơ gia đình)
// nguon='bac_si' + khách: phải có medical_record_id để trace ngược về appointment
prescriptionSchema.pre('validate', function () {
  if (this.nguon === 'tu_nhap' && !this.member_id) {
    throw new Error('Đơn thuốc tự nhập (tu_nhap) phải có member_id')
  }
  if (this.nguon === 'bac_si' && !this.member_id && !this.medical_record_id) {
    throw new Error('Đơn thuốc bác sĩ phải có member_id hoặc medical_record_id')
  }
})

prescriptionSchema.index({ member_id: 1 })
prescriptionSchema.index({ medical_record_id: 1 })

export default mongoose.model('DonThuoc', prescriptionSchema)
