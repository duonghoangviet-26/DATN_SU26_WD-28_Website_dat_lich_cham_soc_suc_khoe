import mongoose from 'mongoose'

const hoSoBenhNhanSchema = new mongoose.Schema(
  {
    ho_ten: { type: String, required: true, trim: true, maxlength: 255 },
    so_dien_thoai: { type: String, default: null, trim: true, maxlength: 20 },
    so_dien_thoai_tim_kiem: { type: String, default: null, trim: true, maxlength: 20 },
    ngay_sinh: { type: Date, default: null },
    gioi_tinh: { type: String, enum: ['nam', 'nu', 'khac'], default: null },
    nhom_mau: { type: String, enum: ['A', 'B', 'AB', 'O', null], default: null },
    di_ung: { type: String, default: null, maxlength: 1000 },
    benh_nen: { type: String, default: null, maxlength: 1000 },
    dia_chi: { type: String, default: null, maxlength: 500 },
    ghi_chu: { type: String, default: null, maxlength: 1000 },
    tai_khoan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    nguoi_giam_ho_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ThanhVien', default: null },
    khach_vang_lai_id: { type: mongoose.Schema.Types.ObjectId, ref: 'KhachVangLai', default: null },
    nguon_tao: { type: String, enum: ['online', 'tai_quay', 'backfill'], default: 'tai_quay' },
    trang_thai: { type: String, enum: ['active', 'merged', 'archived'], default: 'active' },
    // D81 — hồ sơ tạm cho bệnh nhân không có/không nhớ số điện thoại. `ma_tam` là khóa tra
    // cứu THAY THẾ so_dien_thoai_tim_kiem cho các hồ sơ này (xem searchPatientProfileByTempCode
    // trong patient-intake.controller.js) — không có nó, hồ sơ tạo ra sẽ không tìm lại được.
    la_ho_so_tam: { type: Boolean, default: false },
    ma_tam: { type: String, default: null, trim: true, maxlength: 40 },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'ho_so_benh_nhan',
  }
)

hoSoBenhNhanSchema.index({ so_dien_thoai_tim_kiem: 1 })
hoSoBenhNhanSchema.index(
  { ma_tam: 1 },
  { unique: true, name: 'uniq_ho_so_benh_nhan_ma_tam', partialFilterExpression: { ma_tam: { $type: 'string' } } },
)
hoSoBenhNhanSchema.index(
  { member_id: 1 },
  { unique: true, name: 'uniq_ho_so_benh_nhan_member', partialFilterExpression: { member_id: { $type: 'objectId' } } },
)
hoSoBenhNhanSchema.index(
  { khach_vang_lai_id: 1 },
  { unique: true, name: 'uniq_ho_so_benh_nhan_guest', partialFilterExpression: { khach_vang_lai_id: { $type: 'objectId' } } },
)

export default mongoose.model('HoSoBenhNhan', hoSoBenhNhanSchema)
