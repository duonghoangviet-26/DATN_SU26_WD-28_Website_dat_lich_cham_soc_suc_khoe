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
// --- Luồng CLINIC (Auto-confirm khi thanh toán — quyết định 2026-07-02) ---
//   Slot CHỈ bị lock sau khi payment gateway xác nhận thành công (không lock trước).
//   LichHen tạo ra với status='confirmed', payment_status='paid' NGAY LẬP TỨC.
//   Không còn bước "Admin xác nhận" cho clinic — slot đã atomic-lock lúc thanh toán là đủ,
//   Admin/BS chỉ can thiệp khi có ngoại lệ (hủy khẩn cấp / hủy có lý do / dời lịch).
//   Xem docs/superpowers/specs/2026-07-02-clinic-auto-confirm-decision.md
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
    // clinic: required — validate trong pre('validate') | home: null ban đầu, CSKH gán sau
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
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

    // --- Luồng home (giữ nguyên) ---
    // payment_deadline: BS confirm → set deadline BN thanh toán. null với clinic (đã paid từ đầu).
    // Cron: { status:'confirmed', payment_status:'unpaid', payment_deadline:{ $lt: new Date() } } → auto-cancel
    payment_deadline: { type: Date, default: null },

    // --- Soft-lock / VNPay audit ---
    // UUID token tạo tại POST /prepare — dùng để match IPN callback VNPay với đúng LichHen.
    // Giữ lại sau khi LichHen tạo xong để audit dispute thanh toán.
    pending_booking_id: { type: String, default: null },

    // --- Kết quả xét nghiệm tại nhà ---
    // CSKH upload PDF kết quả lab → paste URL vào đây. null cho đến khi lab trả kết quả.
    // Chỉ dùng khi loai_kham='home'. Clinic dùng model KetQuaKham riêng.
    ket_qua_url: { type: String, default: null, maxlength: 2000 },
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

// Ràng buộc clinic/home + khách
appointmentSchema.pre('validate', function () {
  if (this.loai_kham === 'home') {
    if (!this.dia_chi_kham) throw new Error('Khám tại nhà (home) bắt buộc có dia_chi_kham')
    if (!this.service_id)    throw new Error('Khám tại nhà (home) bắt buộc có service_id')
    // doctor_id = null ban đầu — CSKH gán home_staff sau khi xác nhận
    this.phong_kham  = null
    this.schedule_id = null
    this.slot_id     = null
  } else if (this.loai_kham === 'clinic') {
    if (!this.doctor_id)   throw new Error('Khám tại phòng khám (clinic) bắt buộc có doctor_id')
    if (!this.schedule_id) throw new Error('Khám tại phòng khám (clinic) bắt buộc có schedule_id')
    if (!this.slot_id)     throw new Error('Khám tại phòng khám (clinic) bắt buộc có slot_id')
    this.dia_chi_kham = null
    this.service_id   = null
    this.ket_qua_url  = null // ket_qua_url chỉ dùng cho home
  }
  if (!this.member_id && !this.ten_khach) {
    throw new Error('Lịch khách (không có member_id) phải có ten_khach')
  }
})

export default mongoose.model('LichHen', appointmentSchema)
