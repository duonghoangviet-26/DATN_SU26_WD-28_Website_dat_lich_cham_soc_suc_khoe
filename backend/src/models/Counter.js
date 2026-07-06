import mongoose from 'mongoose'

const counterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    collection: 'counters',
  }
)

counterSchema.statics.nextSeq = async function (name) {
  const doc = await this.findOneAndUpdate(
    { key: name },
    {
      $inc: { seq: 1 },
      $setOnInsert: { key: name },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  )

  return doc.seq
}

export default mongoose.model('Counter', counterSchema)
