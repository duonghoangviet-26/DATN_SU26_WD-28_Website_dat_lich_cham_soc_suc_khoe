import mongoose from 'mongoose'

// ============================================================
// TRANG THAI PHONG KHAM (DoctorRoomStatus) — trạng thái phòng/bác sĩ realtime
// 1 bản ghi / bác sĩ / ngày. Chỉ y tá (nurse_id) được đổi trạng thái — trừ dự phòng.
// Phòng = phòng riêng cố định của bác sĩ, snapshot String từ LichLamViec (quyết định 4).
// Ràng buộc flow (enforce ở controller, KHÔNG ở schema):
//   dang_kham → dang_don_phong → san_sang ⇄ tam_nghi
//   - không cho dang_kham → san_sang trực tiếp
//   - không cho tam_nghi khi benh_nhan_hien_tai_id != null
// ============================================================

const roomStatusSchema = new mongoose.Schema(
  {
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', required: true },
    ngay: { type: Date, required: true },
    schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichLamViec', default: null },
    phong_kham: { type: String, default: null },
    nurse_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    trang_thai: {
      type: String,
      enum: ['dang_kham', 'dang_don_phong', 'san_sang', 'tam_nghi'],
      default: 'san_sang',
    },
    benh_nhan_hien_tai_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HangDoi', default: null },
    thoi_diem_doi: { type: Date, default: Date.now },
    thoi_gian_kham_tb_phut: { type: Number, default: 20, min: 0 },
    // ── Dự phòng khi y tá vắng ──────────────────────────────────────────────
    // nurse_id = y tá ĐƯỢC PHÂN CÔNG; nguoi_dieu_khien_id = người THỰC TẾ đang bấm nút
    // (có thể là lễ tân/admin dự phòng khi y tá chưa tới).
    nguoi_dieu_khien_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    nguoi_dieu_khien_vai_tro: { type: String, default: null }, // 'nurse' | 'receptionist' | 'admin'
    y_ta_co_mat: { type: Boolean, default: false }, // y tá phụ trách đã tiếp quản chưa (cảnh báo đến muộn)
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'trang_thai_phong_kham',
  }
)

roomStatusSchema.index({ doctor_id: 1, ngay: 1 }, { unique: true })
roomStatusSchema.index({ ngay: 1, trang_thai: 1 })

export default mongoose.model('TrangThaiPhongKham', roomStatusSchema)
