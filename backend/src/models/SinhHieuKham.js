import mongoose from 'mongoose'

const lichSuCapNhatSchema = new mongoose.Schema(
  {
    nguoi_cap_nhat_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    thoi_diem_cap_nhat: {
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

const sinhHieuKhamSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      unique: true,
      required: true,
    },
    member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ThanhVien',
      default: null,
    },
    can_nang: {
      type: Number,
      default: null,
      min: 0,
    },
    chieu_cao: {
      type: Number,
      default: null,
      min: 0,
    },
    huyet_ap: {
      type: String,
      default: null,
    },
    nhiet_do: {
      type: Number,
      default: null,
      min: 0,
    },
    nhip_tim: {
      type: Number,
      default: null,
      min: 0,
    },
    nguoi_do_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    thoi_diem_do: {
      type: Date,
      default: Date.now,
    },
    co_the_sua: {
      type: Boolean,
      default: true,
    },
    lich_su_cap_nhat: {
      type: [lichSuCapNhatSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'sinh_hieu_kham',
  }
)

export default mongoose.model('SinhHieuKham', sinhHieuKhamSchema)
