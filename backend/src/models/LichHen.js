import mongoose from 'mongoose'

// ============================================================
// APPOINTMENT — Lịch hẹn khám (A5, B3, C5) — bảng trung tâm
// SQL tương đương: appointments
// ============================================================
// Phòng khám tư 1 cơ sở → ĐÃ BỎ hospital_id và loại 'video'.
//   loai_kham='clinic' → khám tại phòng khám, phong_kham = snapshot slots[].phong_kham
//   loai_kham='home'   → bác sĩ đến nhà, dia_chi_kham BẮT BUỘC, phong_kham=null
// gia_kham: clinic → snapshot BacSi.gia_kham | home → snapshot DichVu.gia (không đổi sau khi đặt).
// ten_dich_vu: clinic → snapshot ChuyenKhoa.ten | home → snapshot DichVu.ten (hiển thị trên UI).
// member_id=null → là khách (guest): dùng ten_khach / so_dien_thoai_khach / nam_sinh_khach.
// schedule_id + slot_id: chỉ có khi clinic — trỏ tới slot embed, atomic update.
//   home: schedule_id=null, slot_id=null — BS confirm thủ công, không chiếm slot.
// Cron 15': unpaid quá timeout → tự hủy. Home: luôn pending, bác sĩ confirm thủ công.
// phong_kham: khi bác sĩ đổi slot.phong_kham trong lịch làm việc →
//             phải propagate sang lich_hen.phong_kham của các lịch pending/confirmed liên quan.

const appointmentSchema = new mongoose.Schema(
  {
    user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ThanhVien', default: null },
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', required: true },
    // clinic: required (validate hook) | home: null — không dùng slot system
    schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichLamViec', default: null },
    slot_id:     { type: mongoose.Schema.Types.ObjectId, default: null },
    // null khi clinic | ref DichVu loai='home' khi home
    service_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'DichVu', default: null },

    loai_kham: {
      type: String,
      enum: ['clinic', 'home'],
      required: [true, 'Loại khám là bắt buộc'],
    },
    ngay_kham: { type: Date, required: true },
    gio_kham:  { type: String, required: true }, // "08:30"
    ly_do_kham:   { type: String, default: null, maxlength: 500 },
    // clinic: snapshot từ slots[].phong_kham lúc đặt lịch — null khi home
    // Khi bác sĩ đổi slot.phong_kham trong B2, cần propagate sang các lich_hen pending/confirmed liên quan
    phong_kham:   { type: String, default: null },
    dia_chi_kham: { type: String, default: null }, // bắt buộc khi home

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    payment_status: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    gia_kham:    { type: Number, required: true, min: 0 }, // snapshot (nguồn: xem comment trên)
    ten_dich_vu: { type: String, default: null, maxlength: 255 }, // snapshot tên để hiển thị

    // Thông tin khách (member_id = null)
    ten_khach:           { type: String, default: null, maxlength: 255 },
    so_dien_thoai_khach: { type: String, default: null, maxlength: 20 },
    nam_sinh_khach:      { type: Number, default: null },

    ly_do_huy: { type: String, default: null },

    // Luồng C — BS confirm trước, BN thanh toán sau
    // Set = thời điểm BS confirm + X giờ (config) khi payment_status='unpaid'
    // null khi: chưa confirm | đã thanh toán | đã hủy
    // Cron: { status:'confirmed', payment_status:'unpaid', payment_deadline:{ $lt: new Date() } } → auto-cancel
    payment_deadline: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'lich_hen',
  }
)

appointmentSchema.index({ user_id: 1 })
appointmentSchema.index({ doctor_id: 1 })
appointmentSchema.index({ status: 1 })
appointmentSchema.index({ payment_status: 1 })
appointmentSchema.index({ ngay_kham: 1 })
appointmentSchema.index({ schedule_id: 1 }) // atomic slot update
appointmentSchema.index({ doctor_id: 1, status: 1, ngay_kham: 1 }) // màn hình bác sĩ

// Ràng buộc clinic/home + khách
appointmentSchema.pre('validate', function () {
  if (this.loai_kham === 'home') {
    if (!this.dia_chi_kham) throw new Error('Khám tại nhà (home) bắt buộc có dia_chi_kham')
    if (!this.service_id)    throw new Error('Khám tại nhà (home) bắt buộc có service_id')
    this.phong_kham  = null
    this.schedule_id = null
    this.slot_id     = null
  } else if (this.loai_kham === 'clinic') {
    if (!this.schedule_id) throw new Error('Khám tại phòng khám (clinic) bắt buộc có schedule_id')
    if (!this.slot_id)     throw new Error('Khám tại phòng khám (clinic) bắt buộc có slot_id')
    this.dia_chi_kham = null
    this.service_id   = null
  }
  if (!this.member_id && !this.ten_khach) {
    throw new Error('Lịch khách (không có member_id) phải có ten_khach')
  }
})

export default mongoose.model('LichHen', appointmentSchema)
