import mongoose from 'mongoose'

// ============================================================
// DOCTOR SCHEDULE — Lịch làm việc theo ngày (B2)
// SQL tương đương: doctor_schedules + slots (embed)
// ============================================================
// Mỗi bác sĩ mỗi ngày chỉ có 1 lịch (unique doctor_id + ngay).
// 1 slot = 1 bệnh nhân (không dùng so_benh_nhan_toi_da/hien_tai).
// Đặt slot dùng atomic findOneAndUpdate thay SELECT FOR UPDATE:
//   { _id: schedule_id, 'slots._id': slot_id, 'slots.status': 'active', 'slots.benh_nhan_id': null }
//   { $set: { 'slots.$.status': 'booked', 'slots.$.benh_nhan_id': user_id } }
//
// API layer flatten để trả frontend:
//   schedules.flatMap(sch => sch.slots.map(s => ({ ...s, ngay: sch.ngay.toISOString().slice(0,10) })))
//   Cần populate benh_nhan_id → NguoiDung.ho_ten cho field benh_nhan (display name).

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
    // Bệnh nhân đã đặt slot này — null = chưa có ai
    // Khi đặt lịch: atomic set benh_nhan_id + status='booked'
    // Khi hủy lịch: reset benh_nhan_id=null + status='active'
    benh_nhan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    // Phòng khám cho slot — mặc định copy từ bac_si.phong_kham_mac_dinh khi tạo slot
    // Bác sĩ có thể sửa riêng từng slot.
    // Khi sửa → propagate sang lich_hen.phong_kham của các lịch pending/confirmed liên quan.
    phong_kham: { type: String, default: null },
    status: {
      type: String,
      // active: chưa có BN | booked: benh_nhan_id != null | locked: BS khóa | cancelled: hủy | expired: quá ngày
      enum: ['active', 'booked', 'locked', 'cancelled', 'expired'],
      default: 'active',
    },
  },
  { _id: true }
)

// gio_ket_thuc phải sau gio_bat_dau
slotSchema.pre('validate', function () {
  if (this.gio_bat_dau && this.gio_ket_thuc && this.gio_ket_thuc <= this.gio_bat_dau) {
    throw new Error('gio_ket_thuc phải sau gio_bat_dau')
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
