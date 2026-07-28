import mongoose from 'mongoose'

const loginHistorySchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true, index: true },
    provider: { type: String, enum: ['local', 'google'], required: true },
    ip_address: { type: String, default: null },
    user_agent: { type: String, default: null },
    trang_thai: { type: String, enum: ['success', 'failed'], default: 'success' },
    ly_do_that_bai: { type: String, default: null },
    thoi_gian: { type: Date, default: Date.now, index: true },
  },
  { collection: 'lich_su_dang_nhap' }
)

export default mongoose.model('LichSuDangNhap', loginHistorySchema)
