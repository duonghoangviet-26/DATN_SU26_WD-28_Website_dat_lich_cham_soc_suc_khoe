import mongoose from 'mongoose'

// ============================================================
// TRANG THAI PHONG KHAM (DoctorRoomStatus) — trạng thái phòng/bác sĩ realtime
// 1 bản ghi / bác sĩ / ngày. Bác sĩ tự đổi trạng thái phòng của chính mình.
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
    trang_thai: {
      type: String,
      enum: ['dang_kham', 'dang_don_phong', 'san_sang', 'tam_nghi'],
      default: 'san_sang',
    },
    benh_nhan_hien_tai_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HangDoi', default: null },
    thoi_diem_doi: { type: Date, default: Date.now },
    thoi_gian_kham_tb_phut: { type: Number, default: 20, min: 0 },
    // Người thực tế đang thao tác trên phòng này (thường là bác sĩ; có thể là lễ tân/admin dự phòng).
    nguoi_dieu_khien_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    nguoi_dieu_khien_vai_tro: { type: String, default: null }, // 'doctor' | 'receptionist' | 'admin'
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'trang_thai_phong_kham',
  }
)

roomStatusSchema.index({ doctor_id: 1, ngay: 1 }, { unique: true })
roomStatusSchema.index({ ngay: 1, trang_thai: 1 })

export default mongoose.model('TrangThaiPhongKham', roomStatusSchema)
