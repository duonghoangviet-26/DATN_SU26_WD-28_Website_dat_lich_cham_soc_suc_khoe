import mongoose from 'mongoose'

const appointmentSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ThanhVien', default: null },
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
    schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichLamViec', default: null },
    slot_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DichVu', default: null },

    chi_nhanh_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChiNhanh', default: null },
    specialty_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChuyenKhoa', default: null },
    khach_vang_lai_id: { type: mongoose.Schema.Types.ObjectId, ref: 'KhachVangLai', default: null },
    loai_benh_nhan: { type: String, default: null },
    nguoi_tao_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    nguoi_dat_ho_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    dat_ho: { type: Boolean, default: false },
    hinh_thuc_dat_lich: { type: String, default: null },
    ma_lich_hen: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: null,
    },
    loai_lich_hen: { type: String, default: null },
    lich_hen_goc_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichHen', default: null },

    loai_kham: {
      type: String,
      enum: ['clinic', 'home'],
      required: [true, 'Loai kham la bat buoc'],
    },
    ngay_kham: { type: Date, required: true },
    gio_kham: { type: String, required: true },
    gio_ket_thuc: { type: String, default: null },
    ly_do_kham: { type: String, default: null, maxlength: 500 },
    phong_kham: { type: String, default: null },
    dia_chi_kham: { type: String, default: null },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'],
      default: 'pending',
    },
    payment_status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'refunded'],
      default: 'unpaid',
    },
    gia_kham: { type: Number, required: true, min: 0 },
    ten_dich_vu: { type: String, default: null, maxlength: 255 },
    thoi_diem_thanh_toan: { type: Date, default: null },
    trang_thai_den: { type: String, default: null },
    gio_den_thuc_te: { type: Date, default: null },
    ghi_chu_le_tan: { type: String, default: null },
    ghi_chu_tiep_nhan: { type: String, default: null },
    no_show_confirmed_at: { type: Date, default: null },

    ten_khach: { type: String, default: null, maxlength: 255 },
    gioi_tinh_khach: { type: String, enum: ['male', 'female'], default: null },
    so_dien_thoai_khach: { type: String, default: null, maxlength: 20 },
    email_khach: { type: String, default: null, maxlength: 255, lowercase: true, trim: true },
    nam_sinh_khach: { type: Number, default: null },
    tinh_thanh: { type: String, default: null, maxlength: 100 },
    phuong_xa: { type: String, default: null, maxlength: 100 },
    dia_chi_chi_tiet: { type: String, default: null, maxlength: 255 },

    nguoi_dat_ho_ten: { type: String, default: null, maxlength: 255 },
    nguoi_dat_sdt: { type: String, default: null, maxlength: 20 },

    ly_do_huy: { type: String, default: null },
    ly_do_doi_lich: { type: String, default: null },
    huy_boi: { type: String, default: null },
    nguoi_huy_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    thoi_diem_huy: { type: Date, default: null },
    expired_at: { type: Date, default: null },
    so_lan_thay_doi: { type: Number, default: 0, min: 0 },
    gio_dat_lich_id: { type: mongoose.Schema.Types.ObjectId, default: null },

    payment_deadline: { type: Date, default: null },
    pending_booking_id: { type: String, default: null },
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
appointmentSchema.index({ schedule_id: 1 })
appointmentSchema.index({ doctor_id: 1, status: 1, ngay_kham: 1 })

appointmentSchema.pre('validate', function () {
  if (this.loai_kham === 'home') {
    if (!this.dia_chi_kham) throw new Error('Kham tai nha (home) bat buoc co dia_chi_kham')
    if (!this.service_id) throw new Error('Kham tai nha (home) bat buoc co service_id')
    this.phong_kham = null
    this.schedule_id = null
    this.slot_id = null
  } else if (this.loai_kham === 'clinic') {
    if (!this.doctor_id) throw new Error('Kham tai phong kham (clinic) bat buoc co doctor_id')
    if (!this.schedule_id) throw new Error('Kham tai phong kham (clinic) bat buoc co schedule_id')
    if (!this.slot_id) throw new Error('Kham tai phong kham (clinic) bat buoc co slot_id')
    this.dia_chi_kham = null
    this.service_id = null
    this.ket_qua_url = null
  }

  if (!this.member_id && !this.ten_khach) {
    throw new Error('Lich khach (khong co member_id) phai co ten_khach')
  }
})

export default mongoose.model('LichHen', appointmentSchema)
