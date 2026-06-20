import mongoose from 'mongoose'

// ============================================================
// CHAT SESSION — Phiên hội thoại AI (A6)
// SQL tương đương: chat_sessions
// ============================================================
// ngay_ket_thuc: null=đang mở; có giá trị=đã đóng. Cron đóng sau 24h không hoạt động.

const chatSessionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
    },
    ngay_bat_dau:  { type: Date, default: Date.now },
    ngay_ket_thuc: { type: Date, default: null },
  },
  {
    timestamps: false,
    collection: 'phien_chat',
  }
)

chatSessionSchema.index({ user_id: 1 })

export default mongoose.model('PhienChat', chatSessionSchema)
