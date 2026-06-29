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
//
// --- Người đặt vs Bệnh nhân ---
// member_id != null → BN là ThanhVien đã lưu trong nhóm gia đình.
// member_id = null  → BN là "khách": dùng ten_khach / gioi_tinh_khach / so_dien_thoai_khach...
//   "Đặt cho mình":        member_id=null, nguoi_dat_ho_ten=null  (BN = người đăng nhập).
//   "Đặt cho người thân (GĐ)": member_id=ThanhVien._id, nguoi_dat_* = người đăng nhập.
//   "Đặt cho người thân (nhập tay)": member_id=null, nguoi_dat_* = người đăng nhập, khach_* = BN.
//
// --- Luồng CLINIC (Phương án C — Admin confirm) ---
//   Slot CHỈ bị lock sau khi payment gateway xác nhận thành công (không lock trước).
//   LichHen tạo ra với payment_status='paid' ngay lập tức (không qua unpaid với clinic).
//   Admin xem danh sách pending+paid → xác nhận → status: pending → confirmed.
//   confirmed_by lưu Admin._id đã thực hiện confirm.
//   confirm_deadline = ngay_kham + gio_kham − 30 phút (auto-set trong pre-save).
//   Cron 15': { status:'pending', loai_kham:'clinic', confirm_deadline < now } → auto-cancel + refund.
//   admin_missed=true khi cron auto-cancel (audit SLA Admin).
//
// --- Luồng HOME (giữ nguyên) ---
//   payment_deadline: BS confirm → BN thanh toán trong X giờ → nếu không: auto-cancel.
//   Cron 15': { status:'confirmed', payment_status:'unpaid', payment_deadline < now } → auto-cancel.
//
// phong_kham: khi bác sĩ đổi slot.phong_kham trong B2 →
//             propagate sang lich_hen.phong_kham của các lịch pending/confirmed liên quan.

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

    // --- Thông tin bệnh nhân khách (member_id = null) ---
    ten_khach:           { type: String, default: null, maxlength: 255 },
    gioi_tinh_khach:     { type: String, enum: ['male', 'female'], default: null },
    so_dien_thoai_khach: { type: String, default: null, maxlength: 20 },
    email_khach:         { type: String, default: null, maxlength: 255, lowercase: true, trim: true },
    nam_sinh_khach:      { type: Number, default: null },
    tinh_thanh:          { type: String, default: null, maxlength: 100 }, // tỉnh/thành phố BN
    phuong_xa:           { type: String, default: null, maxlength: 100 }, // phường/xã BN
    dia_chi_chi_tiet:    { type: String, default: null, maxlength: 255 }, // số nhà, đường (BN)

    // Người đặt lịch thay (chỉ có khi mode "Đặt cho người thân")
    // null khi BN tự đặt cho mình (nguoi_dat = user đang đăng nhập)
    nguoi_dat_ho_ten: { type: String, default: null, maxlength: 255 },
    nguoi_dat_sdt:    { type: String, default: null, maxlength: 20 },

    ly_do_huy: { type: String, default: null },

    // --- Luồng Admin confirm (clinic) ---
    // confirmed_by: Admin._id đã xác nhận lịch hẹn này (null = chưa confirm)
    confirmed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    // confirm_deadline: Admin phải confirm trước thời điểm này (= ngay_kham + gio_kham − 30 phút).
    // Auto-set trong pre-save hook khi loai_kham='clinic'. null với home.
    // Cron: { status:'pending', loai_kham:'clinic', confirm_deadline:{ $lt: new Date() } } → auto-cancel
    confirm_deadline: { type: Date, default: null },
    // admin_missed: true khi cron auto-cancel vì Admin không confirm kịp → audit SLA
    admin_missed: { type: Boolean, default: false },

    // --- Luồng home (giữ nguyên) ---
    // payment_deadline: BS confirm → set deadline BN thanh toán. null với clinic (đã paid từ đầu).
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
appointmentSchema.index({ schedule_id: 1 })                          // atomic slot update
appointmentSchema.index({ doctor_id: 1, status: 1, ngay_kham: 1 })  // màn hình bác sĩ
appointmentSchema.index({ status: 1, loai_kham: 1, confirm_deadline: 1 }) // cron auto-cancel clinic
appointmentSchema.index({ confirmed_by: 1 })                         // Admin: "tôi đã confirm những lịch nào"
appointmentSchema.index({ admin_missed: 1 })                         // audit SLA

// Auto-set confirm_deadline khi tạo lịch clinic mới
// confirm_deadline = ngay_kham + gio_kham − 30 phút
appointmentSchema.pre('save', function () {
  if (this.isNew && this.loai_kham === 'clinic' && this.ngay_kham && this.gio_kham) {
    const [h, m] = this.gio_kham.split(':').map(Number)
    const deadline = new Date(this.ngay_kham)
    deadline.setHours(h, m - 30, 0, 0)
    this.confirm_deadline = deadline
  }
})

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
