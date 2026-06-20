import mongoose from 'mongoose'

// ============================================================
// CHAT MESSAGE — Tin nhắn trong phiên chat AI (A6)
// SQL tương đương: chat_messages
// ============================================================
// vai_tro: 'user'=bệnh nhân gửi, 'ai'=Gemini trả lời. noi_dung tối đa 1000 ký tự.
// Không embed vào session vì số tin nhắn không giới hạn.

const chatMessageSchema = new mongoose.Schema(
  {
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PhienChat',
      required: true,
    },
    vai_tro: {
      type: String,
      enum: ['user', 'ai'],
      required: true,
    },
    noi_dung:  { type: String, required: true, maxlength: 5000 }, // Gemini response có thể dài
    thoi_diem: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'tin_nhan_chat',
  }
)

chatMessageSchema.index({ session_id: 1, thoi_diem: 1 })

export default mongoose.model('TinNhanChat', chatMessageSchema)
