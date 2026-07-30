import mongoose from 'mongoose'

const chiTietThuPhiSchema = new mongoose.Schema(
  {
    loai: {
      type: String,
      enum: ['phi_kham', 'dich_vu', 'thu_thuat', 'giam_tru_bao_hiem'],
      required: true,
    },
    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DichVu',
      default: null,
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
    },
    hang_doi_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HangDoi',
    },
    ho_so_benh_nhan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HoSoBenhNhan',
      default: null,
    },
    so_hoa_don: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    chi_nhanh_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ThongTinPhongKham',
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
    // Trạng thái tài chính và trạng thái quy trình thu ngân là hai việc khác nhau:
    // lịch online có thể đã thu phí khám, nhưng vẫn phải chờ lễ tân đối chiếu
    // dịch vụ phát sinh sau khi bác sĩ hoàn tất hồ sơ.
    da_xac_nhan_thu_ngan: { type: Boolean, default: false },
    nguoi_xac_nhan_thu_ngan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    thoi_diem_xac_nhan_thu_ngan: { type: Date, default: null },
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

hoaDonSchema.index(
  { appointment_id: 1 },
  { unique: true, name: 'uniq_hoa_don_theo_appointment', partialFilterExpression: { appointment_id: { $type: 'objectId' } } },
)
hoaDonSchema.index(
  { hang_doi_id: 1 },
  { unique: true, name: 'uniq_hoa_don_theo_hang_doi', partialFilterExpression: { hang_doi_id: { $type: 'objectId' } } },
)

hoaDonSchema.pre('validate', function () {
  if (!this.appointment_id && !this.hang_doi_id) {
    throw new Error('Hoa don phai gan appointment_id hoac hang_doi_id')
  }
})

export default mongoose.model('HoaDon', hoaDonSchema)
