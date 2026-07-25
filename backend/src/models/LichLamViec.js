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
    // ── Tầng KHUNG GIỜ (xem .claude/rules/lich-lam-viec-bac-si.md muc 10 / G1) ──
    // khung_index: vi tri khung 30' trong ngay (0..14, khop DEFAULT_SLOT_TIMES). NHIEU slot
    // co the chia se cung 1 khung_index (nhieu benh nhan/khung theo chuyen khoa).
    // null = slot tao TRUOC migration nay (tuong thich nguoc, xem patient/booking.controller.js
    // getSlots — loc "!== 'walk_in'" thay vi "=== 'online'" de khong loai bo slot cu thieu field).
    khung_index: {
      type: Number,
      default: null,
      min: [0, 'khung_index khong duoc am'],
    },
    loai_slot: {
      type: String,
      enum: ['online', 'walk_in'],
      default: 'online', // giu hanh vi cu: moi slot deu kha dung cho dat online
    },
    // Ten phong dang snapshot ("Phòng 101, Tầng 1, Tòa A") — giu de doi ten phong khong
    // lam vo lich cu. `phong_id` la khoa that, them 2026-07-26 cung `MauLichLamViec`:
    // phong gan voi CA chu khong gan voi NGAY (bac si co the sang phong 101, chieu 102),
    // nen no phai nam o cap SLOT, khong nam o cap lich.
    phong_kham: { type: String, default: null },
    phong_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PhongKham',
      default: null,
    },
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
  // Giu cho PHAI co han. Khong co han thi khong bao gio het han -> slot khoa vinh vien,
  // khach khong dat duoc du ghe trong (2026-07-25: 9 slot nhu vay tren DB that).
  //
  // ⚠️ CHI kiem tra slot BI DUNG TOI trong lan luu nay (`isModified`). Neu kiem tra moi slot,
  // mot slot xau con sot trong mang se lam VO TOAN BO cac luong khac cung goi save() tren lich
  // do — duyet nghi phep, admin sua slot khac, va nghiem trong nhat la releaseAppointmentSlot()
  // trong luong HUY LICH (khach se khong huy duoc lich hen). Da kiem chung bang thuc nghiem.
  //
  // Hook nay cung chi chan duong document.save() (vd admin/slots.controller.js). Duong dat lich
  // cua benh nhan dung findOneAndUpdate nen KHONG qua day — phong ve chinh nam o
  // services/slotRelease.service.js (coi giu cho khong han la hong -> nha khi doc lich).
  if (this.isModified() && this.status === 'pending_payment' && !this.pending_expired_at) {
    throw new Error('slot pending_payment bat buoc phai co pending_expired_at')
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
    trang_thai_xac_nhan: {
      type: String,
      enum: ['cho_xac_nhan', 'da_xac_nhan', 'tu_choi'],
      default: 'cho_xac_nhan',
    },
    ly_do_tu_choi_xac_nhan: {
      type: String,
      default: null,
      maxlength: 500,
    },
    thoi_diem_xac_nhan: {
      type: Date,
      default: null,
    },
    nguoi_xac_nhan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
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
doctorScheduleSchema.index({ trang_thai_xac_nhan: 1, ngay: 1 })

export default mongoose.model('LichLamViec', doctorScheduleSchema)
