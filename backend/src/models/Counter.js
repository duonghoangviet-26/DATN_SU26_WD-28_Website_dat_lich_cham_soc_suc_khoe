import mongoose from 'mongoose'

// Atomic sequence counter — tránh race condition khi 2 admin tạo đồng thời
// Dùng findByIdAndUpdate + $inc: MongoDB đảm bảo atomic, không cần transaction
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // tên counter, VD: 'dich_vu'
  seq: { type: Number, default: 0 },
})

counterSchema.statics.nextSeq = async function (name) {
  const doc = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )
  return doc.seq
}

export default mongoose.model('Counter', counterSchema)
