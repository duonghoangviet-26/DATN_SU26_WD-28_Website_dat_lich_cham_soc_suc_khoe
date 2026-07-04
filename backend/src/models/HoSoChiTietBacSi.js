import mongoose from 'mongoose'

// ============================================================
// DOCTOR EXTENDED PROFILE — Hồ sơ chi tiết bác sĩ (trang chi tiết BN xem)
// Tách khỏi BacSi.js để giữ BacSi nhẹ cho các query danh sách/đặt lịch
// (booking, tìm bác sĩ...) — chỉ trang chi tiết bác sĩ mới cần load hồ sơ này.
// Quan hệ 1-1 qua doctor_id — cùng vòng đời với BacSi (xóa BacSi thì xóa theo).
// ============================================================

const quaTrinhCongTacSchema = new mongoose.Schema(
  {
    noi_cong_tac: { type: String, required: true, trim: true, maxlength: 255 },
    chuc_vu:      { type: String, default: null, trim: true, maxlength: 255 },
    tu_nam:       { type: Number, default: null },
    den_nam:      { type: Number, default: null }, // null = đang công tác
  },
  { _id: false }
)

const quaTrinhDaoTaoSchema = new mongoose.Schema(
  {
    ten_bang: { type: String, required: true, trim: true, maxlength: 255 },
    truong:   { type: String, default: null, trim: true, maxlength: 255 },
    tu_nam:   { type: Number, default: null },
    den_nam:  { type: Number, default: null },
  },
  { _id: false }
)

const giaiThuongSchema = new mongoose.Schema(
  {
    ten:  { type: String, required: true, trim: true, maxlength: 255 },
    nam:  { type: Number, default: null },
  },
  { _id: false }
)

const doctorExtendedProfileSchema = new mongoose.Schema(
  {
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      required: true,
      unique: true,
    },
    chuc_danh: { type: String, default: null, trim: true, maxlength: 255 }, // "PGS. TS. BSCKII"
    chuc_vu:   { type: String, default: null, trim: true, maxlength: 255 }, // "Phó chủ tịch hội..."

    // "Nhận khám và điều trị" — danh sách bệnh lý cụ thể (khác specialties chung chung)
    benh_ly_dieu_tri: { type: [String], default: [] },

    qua_trinh_cong_tac: { type: [quaTrinhCongTacSchema], default: [] },
    qua_trinh_dao_tao:  { type: [quaTrinhDaoTaoSchema],  default: [] },
    thanh_vien_hoi:     { type: [String], default: [] },
    giai_thuong:        { type: [giaiThuongSchema], default: [] },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'ho_so_chi_tiet_bac_si',
  }
)

export default mongoose.model('HoSoChiTietBacSi', doctorExtendedProfileSchema)
