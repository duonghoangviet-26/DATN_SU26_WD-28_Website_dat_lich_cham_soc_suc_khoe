import mongoose from 'mongoose'

// ============================================================
// CLINIC INFO — Thông tin phòng khám (1 cơ sở duy nhất)
// ============================================================
// Thay thế collection `hospitals` cũ (mô hình nhiều bệnh viện liên kết).
// Đây là phòng khám tư 1 cơ sở → chỉ tồn tại DUY NHẤT 1 document.
// Ràng buộc singleton: field `ma` cố định = 'MAIN' + unique index.

const clinicInfoSchema = new mongoose.Schema(
  {
    ten: {
      type: String,
      required: [true, 'Tên chi nhánh/phòng khám là bắt buộc'],
      trim: true,
      maxlength: 255,
    },
    trang_thai: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    dia_chi:       { type: String, default: null },
    so_dien_thoai: { type: String, default: null, maxlength: 20 },
    email:         { type: String, default: null, maxlength: 255, lowercase: true, trim: true },
    gio_lam_viec:  { type: String, default: null, maxlength: 255 }, // "8:00-17:00 Thứ2-Thứ7"
    mo_ta:         { type: String, default: null },
    logo_url:      { type: String, default: null, maxlength: 500 },
    ban_do_url:    { type: String, default: null, maxlength: 500 }, // embed Google Maps
    bao_hiem: {
      nha_nuoc: { type: Boolean, default: false }, // Bảo hiểm y tế nhà nước
      bao_lanh: { type: Boolean, default: false }, // Bảo hiểm bảo lãnh
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'thong_tin_phong_kham',
  }
)

export default mongoose.model('ThongTinPhongKham', clinicInfoSchema)
