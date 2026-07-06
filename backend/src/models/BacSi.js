import mongoose from 'mongoose'

const MAX_SO_LAN_NOP = 5

const doctorSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
      unique: true,
    },
    chi_nhanh_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChiNhanh',
      default: null,
    },
    tieu_su: { type: String, default: null },
    bang_cap: { type: String, default: null },
    kinh_nghiem: { type: String, default: null },
    so_nam_kinh_nghiem: { type: Number, default: 0, min: 0 },
    gia_kham: {
      type: Number,
      default: 0,
      min: [0, 'Gia kham khong duoc am'],
    },
    phi_kham: {
      type: Number,
      required: true,
      min: 0,
    },
    tuoi_nhan_kham_tu: { type: Number, default: 0, min: 0 },
    trang_thai_duyet: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
    },
    trang_thai: {
      type: String,
      enum: ['active', 'nghi_phep', 'nghi_viec'],
      default: 'active',
    },
    ly_do_tu_choi: { type: String, default: null },
    so_lan_nop: {
      type: Number,
      default: 1,
      min: 1,
      max: [MAX_SO_LAN_NOP, `Chi duoc nop lai toi da ${MAX_SO_LAN_NOP} lan`],
    },
    la_hien: { type: Boolean, default: true },
    diem_danh_gia: {
      type: Number,
      default: 0,
      min: [0, 'Diem danh gia toi thieu 0'],
      max: [5, 'Diem danh gia toi da 5'],
    },
    tong_danh_gia: { type: Number, default: 0, min: 0 },
    phong_kham_mac_dinh: { type: String, default: null },
    specialties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChuyenKhoa' }],
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DichVu' }],
    bao_hiem: {
      nha_nuoc: { type: Boolean, default: false },
      bao_lanh: { type: Boolean, default: false },
    },
    related_services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DichVu' }],
    loai: {
      type: String,
      enum: ['specialist', 'home_staff'],
      default: 'specialist',
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'bac_si',
  }
)

doctorSchema.index({ trang_thai_duyet: 1 })
doctorSchema.index({ la_hien: 1 })
doctorSchema.index({ specialties: 1 })
doctorSchema.index({ services: 1 })
doctorSchema.index({ related_services: 1 })
doctorSchema.index({ 'bao_hiem.nha_nuoc': 1 })

export default mongoose.model('BacSi', doctorSchema)
