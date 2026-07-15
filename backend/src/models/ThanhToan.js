import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      unique: true,
      sparse: true,
    },
    hoa_don_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HoaDon',
      index: true,
      default: null,
    },
    benh_nhan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    ma_giao_dich: {
      type: String,
      unique: true,
      sparse: true,
      maxlength: 20,
    },
    so_tien: {
      type: Number,
      required: true,
      min: [0, 'So tien khong duoc am'],
    },
    loai_thanh_toan: {
      type: String,
      enum: ['phi_dat_lich', 'dat_coc', 'thanh_toan_bo_sung'],
      required: true,
    },
    phuong_thuc: {
      type: String,
      enum: ['tien_mat', 'chuyen_khoan', 'vi_dien_tu', 'the_ngan_hang'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    ngay_thanh_toan: { type: Date, default: null },
    ngay_hoan_tien: { type: Date, default: null },
    nguoi_thu_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    thoi_diem_thanh_toan: {
      type: Date,
      default: null,
    },
    gateway_transaction_id: {
      type: String,
      default: null,
      maxlength: 100,
    },
    gateway_response: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'thanh_toan',
  }
)

paymentSchema.index({ benh_nhan_id: 1 })
paymentSchema.index({ status: 1 })

paymentSchema.pre('validate', async function () {
  if (!this.ma_giao_dich) {
    const last = await this.constructor
      .findOne({ ma_giao_dich: /^TXN\d+$/ })
      .sort({ ma_giao_dich: -1 })
      .select('ma_giao_dich')
      .lean()

    const lastNum = last ? parseInt(last.ma_giao_dich.slice(3), 10) : 0
    this.ma_giao_dich = 'TXN' + String(lastNum + 1).padStart(4, '0')
  }
})

export default mongoose.model('ThanhToan', paymentSchema)
