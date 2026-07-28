import mongoose from 'mongoose'

const userSessionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true, index: true },
    refresh_token_hash: { type: String, required: true, index: true },
    user_agent: { type: String, default: null },
    ip_address: { type: String, default: null },
    is_revoked: { type: Boolean, default: false },
    expires_at: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, collection: 'user_sessions' }
)

export default mongoose.model('UserSession', userSessionSchema)
