import mongoose from 'mongoose'

// ============================================================
// DOCTOR — Hồ sơ chuyên môn bác sĩ (B1, C2)
// SQL tương đương: doctors + doctor_specialties + doctor_services (embed)
// ============================================================
// Phòng khám tư 1 cơ sở → ĐÃ BỎ mảng hospitals[] (mọi bác sĩ thuộc cùng phòng khám).
// trang_thai_duyet: pending → approved (Admin duyệt, đổi users.role='doctor' cùng transaction)
//                   pending → rejected (nộp lại tối đa 5 lần) | approved → suspended (đình chỉ)
// diem_danh_gia / tong_danh_gia: tự cập nhật khi review bị ẩn/hiện (tầng service).

const MAX_SO_LAN_NOP = 5

const doctorSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
      unique: true,
    },
    tieu_su:     { type: String, default: null },
    bang_cap:    { type: String, default: null },
    kinh_nghiem: { type: String, default: null },
    so_nam_kinh_nghiem: { type: Number, default: 0, min: 0 },
    phi_tu_van: {
      type: Number,
      default: 0,
      min: [0, 'Phí tư vấn không được âm'],
    }, // thông tin trên profile, KHÔNG dùng để tính tiền (tiền lấy từ service.gia)
    trang_thai_duyet: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
    },
    ly_do_tu_choi: { type: String, default: null },
    so_lan_nop: {
      type: Number,
      default: 1,
      min: 1,
      max: [MAX_SO_LAN_NOP, `Chỉ được nộp lại tối đa ${MAX_SO_LAN_NOP} lần`],
    },
    la_hien: { type: Boolean, default: true },
    diem_danh_gia: {
      type: Number,
      default: 0,
      min: [0, 'Điểm đánh giá tối thiểu 0'],
      max: [5, 'Điểm đánh giá tối đa 5'],
    },
    tong_danh_gia: { type: Number, default: 0, min: 0 },

    // === EMBED thay 2 bảng join SQL ===
    specialties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChuyenKhoa' }],
    services:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'DichVu' }],
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

export default mongoose.model('BacSi', doctorSchema)
