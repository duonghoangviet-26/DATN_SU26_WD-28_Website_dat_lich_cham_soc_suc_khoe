import mongoose from 'mongoose'

const isHHMM = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const slotSchema = new mongoose.Schema(
  {
    gio_bat_dau: {
      type: String,
      required: true,
      validate: { validator: isHHMM, message: 'gio_bat_dau phai dang HH:MM' },
    },
    gio_ket_thuc: {
      type: String,
      required: true,
      validate: { validator: isHHMM, message: 'gio_ket_thuc phai dang HH:MM' },
    },
    benh_nhan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    benh_nhan_tam_giu_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    specialty_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChuyenKhoa',
      default: null,
    },
    phong_kham: { type: String, default: null },
    status: {
      type: String,
      enum: ['active', 'pending_payment', 'booked', 'locked', 'cancelled', 'expired'],
      default: 'active',
    },
    lock_expires_at: { type: Date, default: null },
    pending_expired_at: { type: Date, default: null },
    cancel_requested: { type: Boolean, default: false },
    cancel_reason: { type: String, default: null },
    bi_khoa_boi_nghi_phep: {
      type: Boolean,
      default: false,
    },
    nghi_phep_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NghiPhepBacSi',
      default: null,
    },
  },
  { _id: true }
)

slotSchema.pre('validate', function () {
  if (this.gio_bat_dau && this.gio_ket_thuc && this.gio_ket_thuc <= this.gio_bat_dau) {
    throw new Error('gio_ket_thuc phai sau gio_bat_dau')
  }
})

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      required: true,
    },
    chi_nhanh_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ThongTinPhongKham',
      default: null,
    },
    ngay: { type: Date, required: true },
    trang_thai_ngay: {
      type: String,
      enum: ['lam_viec', 'nghi', 'nghi_phep'],
      default: 'lam_viec',
    },
    ghi_chu_ngay: {
      type: String,
      default: null,
    },
    slots: { type: [slotSchema], default: [] },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'lich_lam_viec',
  }
)

doctorScheduleSchema.index({ doctor_id: 1, ngay: 1 }, { unique: true })
doctorScheduleSchema.index({ ngay: 1 })
doctorScheduleSchema.index({ 'slots._id': 1, 'slots.status': 1 })
doctorScheduleSchema.index({ chi_nhanh_id: 1, ngay: 1 })
doctorScheduleSchema.index({ 'slots.specialty_id': 1, 'slots.status': 1 })

export default mongoose.model('LichLamViec', doctorScheduleSchema)
