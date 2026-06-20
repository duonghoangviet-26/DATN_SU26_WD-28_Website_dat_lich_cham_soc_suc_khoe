import mongoose from 'mongoose'

// ============================================================
// EXAMINATION RESULT — Kết quả khám bác sĩ ghi (B4)
// SQL tương đương: examination_results
// ============================================================
// 1 lịch hẹn 1 kết quả (appointment_id unique).
// co_the_sua: bác sĩ sửa được trong 24h đầu; sau 24h → false (khóa) qua cron/check.

const examinationResultSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
      unique: true,
    },
    chan_doan: {
      type: String,
      required: [true, 'Chẩn đoán là bắt buộc'],
      trim: true,
    },
    huong_dan_dieu_tri: { type: String, default: null },
    ghi_chu:            { type: String, default: null },
    ngay_tai_kham:      { type: Date, default: null },
    co_the_sua:         { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'ket_qua_kham',
  }
)

export default mongoose.model('KetQuaKham', examinationResultSchema)
