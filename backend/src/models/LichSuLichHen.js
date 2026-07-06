import mongoose from 'mongoose'

const appointmentHistorySchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
    },

    tu_trang_thai: { type: String, default: null },
    den_trang_thai: { type: String, required: true },
    tu_payment_status: { type: String, default: null },
    den_payment_status: { type: String, default: null },

    loai_thay_doi: { type: String, default: null },
    ly_do_thay_doi: { type: String, default: null },

    bac_si_cu_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      default: null,
    },
    bac_si_moi_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      default: null,
    },
    specialty_cu_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChuyenKhoa',
      default: null,
    },
    specialty_moi_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChuyenKhoa',
      default: null,
    },
    schedule_cu_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichLamViec',
      default: null,
    },
    schedule_moi_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichLamViec',
      default: null,
    },
    slot_cu_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    slot_moi_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    ngay_kham_cu: { type: Date, default: null },
    ngay_kham_moi: { type: Date, default: null },
    gio_kham_cu: { type: String, default: null },
    gio_kham_moi: { type: String, default: null },

    nguoi_thay_doi_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      required: true,
    },
    thoi_diem_thay_doi: {
      type: Date,
      default: Date.now,
    },
    kenh_thay_doi: {
      type: String,
      required: true,
    },

    nguoi_thuc_hien_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    vai_tro: {
      type: String,
      enum: ['admin', 'doctor', 'user', 'system'],
      required: true,
    },
    ly_do: { type: String, default: null },
    thoi_diem: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'lich_su_lich_hen',
  }
)

appointmentHistorySchema.index({ appointment_id: 1, thoi_diem: 1 })
appointmentHistorySchema.index({ nguoi_thuc_hien_id: 1 })
appointmentHistorySchema.index({ vai_tro: 1, thoi_diem: -1 })

export default mongoose.model('LichSuLichHen', appointmentHistorySchema)
