import mongoose from 'mongoose'

const lichSuSuaSchema = new mongoose.Schema(
  {
    nguoi_sua_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    thoi_diem_sua: {
      type: Date,
      default: Date.now,
    },
    noi_dung: {
      type: String,
      default: null,
    },
  },
  { _id: false }
)

const examinationResultSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
      unique: true,
    },
    nguoi_nhap_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    bac_si_phu_trach_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      default: null,
    },
    nguoi_xac_nhan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    thoi_diem_xac_nhan: {
      type: Date,
      default: null,
    },
    chan_doan: {
      type: String,
      required: [true, 'Chan doan la bat buoc'],
      trim: true,
    },
    huong_dan_dieu_tri: { type: String, default: null },
    ghi_chu: { type: String, default: null },
    ngay_tai_kham: { type: Date, default: null },
    co_the_sua: { type: Boolean, default: true },
    dich_vu_phat_sinh: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    dich_vu_tu_choi: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    chi_dinh_tai_kham: {
      type: Boolean,
      default: false,
    },
    da_dat_lich_tai_kham: {
      type: Boolean,
      default: false,
    },
    da_gui_cho_benh_nhan: {
      type: Boolean,
      default: false,
    },
    lich_su_sua: {
      type: [lichSuSuaSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'ket_qua_kham',
  }
)

export default mongoose.model('KetQuaKham', examinationResultSchema)
