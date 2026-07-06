import mongoose from 'mongoose'

const refundPolicySchema = new mongoose.Schema(
  {
    thoi_gian_toi_thieu_gio: { type: Number, default: 24, min: 0 },
    ti_le_hoan: { type: Number, default: 100, min: 0 },
    phi_huy_co_dinh: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
)

const reminderConfigSchema = new mongoose.Schema(
  {
    bat_cho_nhac: { type: Boolean, default: true },
    so_gio_truoc_kham: { type: Number, default: 24, min: 0 },
    kenh_gui_mac_dinh: { type: [String], default: ['in_app'] },
  },
  { _id: false }
)

const reExamReminderSchema = new mongoose.Schema(
  {
    bat_cho_nhac: { type: Boolean, default: true },
    so_ngay_nhac_truoc: { type: Number, default: 3, min: 0 },
  },
  { _id: false }
)

const clinicConfigSchema = new mongoose.Schema(
  {
    singleton_key: {
      type: String,
      default: 'CAU_HINH_PHONG_KHAM',
      unique: true,
    },
    thoi_gian_giu_slot_phut: {
      type: Number,
      default: 15,
      min: 0,
    },
    so_lan_doi_lich_toi_da: {
      type: Number,
      default: 3,
      min: 0,
    },
    thoi_gian_toi_thieu_truoc_kham_de_doi_lich_gio: {
      type: Number,
      default: 24,
      min: 0,
    },
    nguong_huy_lich_trong_thang: {
      type: Number,
      default: 3,
      min: 0,
    },
    chinh_sach_hoan_tien: {
      type: [refundPolicySchema],
      default: [{ thoi_gian_toi_thieu_gio: 24, ti_le_hoan: 100, phi_huy_co_dinh: 0 }],
    },
    cau_hinh_nhac_lich: {
      type: reminderConfigSchema,
      default: () => ({}),
    },
    cau_hinh_nhac_tai_kham: {
      type: reExamReminderSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'cau_hinh_phong_kham',
  }
)

export default mongoose.model('CauHinhPhongKham', clinicConfigSchema)
