import mongoose from 'mongoose'

const refundSchema = new mongoose.Schema(
  {
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ThanhToan',
      required: true,
    },
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
      unique: true,
    },
    so_tien_hoan: { type: Number, required: true, min: 0 },
    so_tien_da_thu: { type: Number, default: 0, min: 0 },
    phi_huy: { type: Number, default: 0, min: 0 },
    chinh_sach_hoan: { type: String, default: null },
    phan_tram_hoan: {
      type: Number,
      required: true,
      enum: [0, 50, 80, 100],
    },
    ly_do: { type: String, default: null },
    ly_do_hoan: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'completed', 'rejected'],
      default: 'pending',
    },
    ly_do_tu_choi: { type: String, default: null },
    xu_ly_boi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    nguoi_xu_ly_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    nguoi_duyet_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    phuong_thuc_hoan: { type: String, default: null },
    ngay_yeu_cau: { type: Date, default: Date.now },
    ngay_xu_ly: { type: Date, default: null },
    thoi_diem_hoan_thanh: { type: Date, default: null },
  },
  {
    timestamps: false,
    collection: 'hoan_tien',
  }
)

refundSchema.index({ status: 1 })
refundSchema.index({ payment_id: 1 })

export default mongoose.model('HoanTien', refundSchema)
