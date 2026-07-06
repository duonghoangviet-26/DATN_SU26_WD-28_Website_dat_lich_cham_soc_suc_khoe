import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
    },
    tieu_de: { type: String, required: true, maxlength: 255 },
    noi_dung: { type: String, required: true },
    loai: {
      type: String,
      enum: ['appointment', 'medicine', 'system', 'reminder', 'payment', 'refund'],
      required: true,
    },
    related_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    related_type: { type: String, default: null, maxlength: 50 },
    da_doc: { type: Boolean, default: false },
    du_lieu_dinh_kem: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    kenh_gui: {
      type: String,
      enum: ['in_app', 'email', 'sms', 'zalo'],
      default: null,
    },
    da_gui: {
      type: Boolean,
      default: false,
    },
    thoi_diem_gui: {
      type: Date,
      default: null,
    },
    thoi_diem_doc: {
      type: Date,
      default: null,
    },
    ngay_gui_du_kien: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'thong_bao',
  }
)

notificationSchema.index({ user_id: 1, da_doc: 1 })
notificationSchema.index({ ngay_tao: 1 })

notificationSchema.pre('validate', function () {
  if (this.isNew && !this.ngay_gui_du_kien) {
    throw new Error('Thong bao moi bat buoc co ngay_gui_du_kien')
  }
})

export default mongoose.model('ThongBao', notificationSchema)
