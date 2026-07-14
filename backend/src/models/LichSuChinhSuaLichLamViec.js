import mongoose from 'mongoose'

const scheduleAuditLogSchema = new mongoose.Schema(
  {
    schedule_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichLamViec',
      default: null,
      index: true,
    },
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      default: null,
      index: true,
    },
    ngay: {
      type: Date,
      default: null,
      index: true,
    },
    slot_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    nguoi_thuc_hien_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    vai_tro: {
      type: String,
      enum: ['admin', 'doctor', 'system'],
      required: true,
    },
    hanh_dong: {
      type: String,
      enum: [
        'auto_generate',
        'manual_create',
        'update_workday',
        'update_slot',
        'doctor_confirm',
        'doctor_reject',
        'doctor_request_cancel_slot',
      ],
      required: true,
    },
    du_lieu_cu: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    du_lieu_moi: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ghi_chu: {
      type: String,
      default: null,
      maxlength: 1000,
    },
  },
  {
    timestamps: { createdAt: 'thoi_diem', updatedAt: false },
    collection: 'lich_su_chinh_sua_lich_lam_viec',
  }
)

scheduleAuditLogSchema.index({ schedule_id: 1, thoi_diem: -1 })
scheduleAuditLogSchema.index({ doctor_id: 1, ngay: 1, thoi_diem: -1 })
scheduleAuditLogSchema.index({ vai_tro: 1, hanh_dong: 1, thoi_diem: -1 })

export default mongoose.model('LichSuChinhSuaLichLamViec', scheduleAuditLogSchema)
