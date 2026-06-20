import mongoose from 'mongoose'

// ============================================================
// PAYMENT SETTING — Cấu hình chính sách thanh toán / hoàn tiền (C8)
// SQL tương đương: bảng payment_settings
// ============================================================
// Lưu dạng key-value (string), convert khi dùng. KHÔNG hardcode tỉ lệ trong code.
// Phòng khám tư 1 cơ sở: ĐÃ BỎ key hoa_hong_phan_tram (không chia tiền cho bệnh viện).

const paymentSettingSchema = new mongoose.Schema(
  {
    ten_cai_dat: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    gia_tri: { type: String, required: true, maxlength: 255 },
    mo_ta:   { type: String, default: null, maxlength: 500 },
  },
  {
    timestamps: { createdAt: false, updatedAt: 'ngay_cap_nhat' },
    collection: 'cai_dat_thanh_toan',
  }
)

export default mongoose.model('CaiDatThanhToan', paymentSettingSchema)
