import mongoose from 'mongoose'

const appointmentSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ThanhVien', default: null },
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
    schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichLamViec', default: null },
    slot_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DichVu', default: null },

    chi_nhanh_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ThongTinPhongKham', default: null },
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
      enum: ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm', 'completed', 'cancelled', 'no_show', 'skipped'],
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

    // ── Dời lịch & điều khoản (rule mục 5, 10.D, 14, 15) ─────────────────────
    // Nguồn của lượt khám. `hinh_thuc_dat_lich` là kênh tạo (patient/receptionist/admin),
    // còn đây là bản chất nghiệp vụ: đặt trước qua mạng hay tới quầy.
    nguon: {
      type: String,
      enum: ['online', 'tai_cho'],
      default: null,
    },
    // BẮT BUỘC khi dời. Hai loại đếm hạn mức RIÊNG: khách tự xin dời chỉ được 1 lần,
    // còn lỗi phòng khám thì dời bao nhiêu lần cũng không tính vào hạn mức của khách.
    ly_do_doi: {
      type: String,
      enum: ['khach_yeu_cau', 'phong_kham'],
      default: null,
    },
    so_lan_doi_khach_yeu_cau: { type: Number, default: 0, min: 0 },

    // Bằng chứng khách đồng ý điều khoản KHÔNG HOÀN TIỀN. Không có thì KHÔNG được thu tiền
    // (rule mục 5) — thu rồi mới tranh cãi là phòng khám thua.
    dieu_khoan_version: { type: String, default: null, maxlength: 50 },
    dieu_khoan_dong_y_luc: { type: Date, default: null },

    // Đề xuất dời do PHÒNG KHÁM khởi xướng (bác sĩ nghỉ / bận một khung — mục 14, 15).
    // Nhúng vào lịch hẹn thay vì tạo bảng mới: mỗi lịch hẹn có tối đa một đề xuất đang mở,
    // và đề xuất chết theo lịch hẹn.
    de_xuat_doi: {
      type: new mongoose.Schema({
        nghi_phep_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NghiPhepBacSi', default: null },
        trang_thai: {
          type: String,
          enum: ['cho_khach_chon', 'cho_admin_duyet', 'da_ap_dung', 'da_huy'],
          default: 'cho_khach_chon',
        },
        han_phan_hoi: { type: Date, default: null },
        // Phương án đầu tiên luôn là phương án đã GIỮ SẴN chỗ: quá hạn không phản hồi thì
        // áp dụng nó, khách không bao giờ mất chỗ (rule mục 15).
        phuong_an: [{
          loai: { type: String, enum: ['doi_bac_si', 'doi_khung'], required: true },
          doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi' },
          schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichLamViec' },
          slot_id: { type: mongoose.Schema.Types.ObjectId },
          ngay: Date,
          gio_bat_dau: String,
          bac_si_ten: String,
          mo_ta: String,
          da_giu_cho: { type: Boolean, default: false },
          lan_walk_in: { type: Boolean, default: false },
        }],
        phuong_an_khach_chon: { type: Number, default: null },
        nguoi_duyet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
        thoi_diem_duyet: { type: Date, default: null },
        ghi_chu: { type: String, default: null, maxlength: 500 },
      }, { _id: false }),
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'lich_hen',
  }
)

appointmentSchema.index({ user_id: 1 })
appointmentSchema.index({ doctor_id: 1 })
appointmentSchema.index({ specialty_id: 1 })
appointmentSchema.index({ status: 1 })
appointmentSchema.index({ payment_status: 1 })
appointmentSchema.index({ ngay_kham: 1 })
appointmentSchema.index({ schedule_id: 1 })
appointmentSchema.index({ doctor_id: 1, status: 1, ngay_kham: 1 })
appointmentSchema.index({ ngay_kham: 1, status: 1 })
appointmentSchema.index({ ngay_kham: 1, payment_status: 1 })
appointmentSchema.index({ ngay_kham: 1, doctor_id: 1 })

// ── Rang buoc BAT BIEN: 1 slot <-> toi da 1 LichHen (rule muc 7) ─────────────
// Truoc day rang buoc nay CHI ton tai trong code (check + findOneAndUpdate), nen moi lo
// hong claim slot deu de lai du lieu trung ma khong ai phat hien. Day la luoi cuoi cung
// o tang DB: du controller co sai, Mongo van tu choi ban ghi thu hai.
//
// $type: 'objectId' thay vi $ne: null — partialFilterExpression KHONG ho tro $ne, va lich
// kham tai nha cu co schedule_id/slot_id = null se dung chung khoa (null, null) neu khong loc.
// `cancelled` co y KHONG nam trong danh sach: lich da huy nha slot ra, cho phep ban lai.
//
// ⚠️ Index nay chi build duoc khi du lieu da sach. Chay truoc:
//    node src/scripts/dedupe-slot-appointments.js --apply
appointmentSchema.index(
  { schedule_id: 1, slot_id: 1 },
  {
    unique: true,
    name: 'uniq_lich_hen_theo_slot',
    partialFilterExpression: {
      schedule_id: { $type: 'objectId' },
      slot_id: { $type: 'objectId' },
      status: {
        $in: [
          'pending', 'confirmed', 'checked_in', 'in_progress',
          'waiting_record', 'waiting_doctor_confirm', 'completed', 'no_show', 'skipped',
        ],
      },
    },
  }
)

appointmentSchema.pre('validate', function () {
  if (this.loai_kham === 'home') {
    if (!this.dia_chi_kham) throw new Error('Kham tai nha (home) bat buoc co dia_chi_kham')
    if (!this.service_id) throw new Error('Kham tai nha (home) bat buoc co service_id')
    if (!this.doctor_id) throw new Error('Kham tai nha (home) bat buoc co doctor_id')
    if (!this.schedule_id) throw new Error('Kham tai nha (home) bat buoc co schedule_id')
    if (!this.slot_id) throw new Error('Kham tai nha (home) bat buoc co slot_id')
    this.phong_kham = null
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
