import mongoose from 'mongoose'

const hinhAnhNoiSoiSchema = new mongoose.Schema(
  {
    url: { type: String, default: null },
    mo_ta: { type: String, default: null },
    uploaded_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const ketQuaKhamMuiSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
    },
    ket_qua_kham_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KetQuaKham',
      required: true,
    },
    la_ket_qua_chinh: {
      type: Boolean,
      default: true,
    },
    hinh_anh_noi_soi: {
      type: [hinhAnhNoiSoiSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'ket_qua_kham_mui',
  }
)

ketQuaKhamMuiSchema.index({ appointment_id: 1 })
ketQuaKhamMuiSchema.index({ ket_qua_kham_id: 1 })

export default mongoose.model('KetQuaKhamMui', ketQuaKhamMuiSchema)
