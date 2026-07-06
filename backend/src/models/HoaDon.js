import mongoose from 'mongoose'

const chiTietThuPhiSchema = new mongoose.Schema(
  {
    loai: {
      type: String,
      enum: ['phi_kham', 'dich_vu', 'thu_thuat', 'giam_tru_bao_hiem'],
      required: true,
    },
    ten: { type: String, default: null },
    so_tien: {
      type: Number,
      required: true,
      min: 0,
    },
    so_luong: {
      type: Number,
      default: 1,
      min: 0,
    },
    thanh_tien: {
      type: Number,
      required: true,
      min: 0,
    },
    ghi_chu: { type: String, default: null },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const hoaDonSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      unique: true,
      required: true,
    },
    so_hoa_don: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    chi_nhanh_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChiNhanh',
      default: null,
    },
    specialty_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChuyenKhoa',
      default: null,
    },
    tong_tien_kham: {
      type: Number,
      default: 0,
      min: 0,
    },
    chi_tiet_thu_phi: {
      type: [chiTietThuPhiSchema],
      default: [],
    },
    tong_tien_phat_sinh: {
      type: Number,
      default: 0,
      min: 0,
    },
    tong_thanh_toan: {
      type: Number,
      default: 0,
      min: 0,
    },
    trang_thai_hoa_don: {
      type: String,
      enum: ['chua_thanh_toan', 'da_dat_coc', 'da_thanh_toan_du', 'qua_han'],
      default: 'chua_thanh_toan',
    },
    ghi_chu_ke_toan: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'hoa_don',
  }
)

export default mongoose.model('HoaDon', hoaDonSchema)
