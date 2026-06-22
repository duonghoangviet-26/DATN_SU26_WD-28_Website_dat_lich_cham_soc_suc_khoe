import mongoose from 'mongoose'

// ============================================================
// DOCTOR SCHEDULE — Lịch làm việc theo ngày (B2)
// SQL tương đương: doctor_schedules + slots (embed)
// ============================================================
// Mỗi bác sĩ mỗi ngày chỉ có 1 lịch (unique doctor_id + ngay).
// Đặt slot dùng atomic update (findOneAndUpdate + $inc) thay SELECT FOR UPDATE.
// Home service: slot.so_benh_nhan_toi_da luôn = 1 (ép ở tầng service).

// So sánh "HH:MM" dạng chuỗi zero-padded là hợp lệ về thứ tự thời gian.
const isHHMM = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

const slotSchema = new mongoose.Schema(
  {
    gio_bat_dau: {
      type: String,
      required: true,
      validate: { validator: isHHMM, message: 'gio_bat_dau phải dạng HH:MM' },
    },
    gio_ket_thuc: {
      type: String,
      required: true,
      validate: { validator: isHHMM, message: 'gio_ket_thuc phải dạng HH:MM' },
    },
    so_benh_nhan_toi_da: {
      type: Number,
      required: true,
      min: [1, 'Số bệnh nhân tối đa tối thiểu là 1'],
    },
    so_benh_nhan_hien_tai: { type: Number, default: 0, min: 0 },
    // Phòng khám cho slot này — mặc định copy từ bac_si.phong_kham_mac_dinh khi bác sĩ tạo slot (B2)
    // Bác sĩ có thể sửa riêng từng slot. Khi sửa → propagate sang lich_hen.phong_kham của lịch liên quan.
    phong_kham: { type: String, default: null },
    status: {
      type: String,
      // active: còn chỗ | booked: đã đầy (so_hien_tai >= toi_da) | locked: bác sĩ khóa | cancelled: hủy | expired: quá ngày
      enum: ['active', 'booked', 'locked', 'cancelled', 'expired'],
      default: 'active',
    },
  },
  { _id: true }
)

// gio_ket_thuc phải sau gio_bat_dau & không vượt sức chứa
slotSchema.pre('validate', function () {
  if (this.gio_bat_dau && this.gio_ket_thuc && this.gio_ket_thuc <= this.gio_bat_dau) {
    throw new Error('gio_ket_thuc phải sau gio_bat_dau')
  }
  if (this.so_benh_nhan_hien_tai > this.so_benh_nhan_toi_da) {
    throw new Error('Số bệnh nhân hiện tại không được vượt số tối đa')
  }
})

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      required: true,
    },
    ngay: { type: Date, required: true }, // chỉ lưu ngày làm việc
    slots: { type: [slotSchema], default: [] },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' }, // cần biết lần cuối lịch thay đổi
    collection: 'lich_lam_viec',
  }
)

doctorScheduleSchema.index({ doctor_id: 1, ngay: 1 }, { unique: true })
doctorScheduleSchema.index({ ngay: 1 })

export default mongoose.model('LichLamViec', doctorScheduleSchema)
