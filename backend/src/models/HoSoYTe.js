import mongoose from 'mongoose'

// ============================================================
// MEDICAL RECORD — Hồ sơ khám bệnh (A3, B4)
// SQL tương đương: medical_records
// ============================================================
// nguon='tu_kham': tự tạo từ appointment khi bác sĩ ghi kết quả (B4) → bệnh nhân KHÔNG sửa/xóa.
// nguon='thu_cong': bệnh nhân tự nhập (vd: lần khám ở nơi khác) → có thể sửa/xóa.
// member_id=null khi là lịch khách → dùng ten_khach.

const medicalRecordSchema = new mongoose.Schema(
  {
    member_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'ThanhVien', default: null },
    appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichHen', default: null },
    ten_khach: { type: String, default: null, maxlength: 255 },
    ngay_kham: {
      type: Date,
      required: true,
      validate: {
        validator: (v) => v instanceof Date && v.getTime() <= Date.now(),
        message: 'Ngày khám không được là ngày tương lai',
      },
    },
    ten_benh_vien: { type: String, default: null, maxlength: 255 },
    ten_bac_si:    { type: String, default: null, maxlength: 255 },
    ly_do_kham: { type: String, default: null },
    chan_doan:  { type: String, default: null },
    ghi_chu:    { type: String, default: null },
    nguon: {
      type: String,
      enum: ['tu_kham', 'thu_cong'],
      default: 'tu_kham',
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'ho_so_y_te',
  }
)

// nguon='tu_kham': phải có appointment_id (tạo từ lịch khám)
// mọi hồ sơ: phải có member_id hoặc ten_khach (biết của ai)
medicalRecordSchema.pre('validate', function () {
  if (this.nguon === 'tu_kham' && !this.appointment_id) {
    throw new Error('Hồ sơ từ lịch khám (tu_kham) phải có appointment_id')
  }
  if (!this.member_id && !this.ten_khach) {
    throw new Error('Hồ sơ y tế phải có member_id hoặc ten_khach')
  }
})

medicalRecordSchema.index({ member_id: 1 })
medicalRecordSchema.index({ appointment_id: 1 })
medicalRecordSchema.index({ ngay_kham: -1 })

export default mongoose.model('HoSoYTe', medicalRecordSchema)
