import mongoose from 'mongoose'

const isHHMM = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const nghiPhepBacSiSchema = new mongoose.Schema(
  {
    bac_si_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      required: true,
    },
    tu_ngay: {
      type: Date,
      required: true,
    },
    den_ngay: {
      type: Date,
      required: true,
    },
    // Khung giờ nghỉ trong ngày (vd nghỉ đúng 1 ca) — để trống nghĩa là nghỉ cả ngày.
    gio_bat_dau: {
      type: String,
      default: null,
      validate: { validator: isHHMM, message: 'gio_bat_dau phai dang HH:MM' },
    },
    gio_ket_thuc: {
      type: String,
      default: null,
      validate: { validator: isHHMM, message: 'gio_ket_thuc phai dang HH:MM' },
    },
    ly_do: {
      type: String,
      default: null,
      maxlength: 500,
    },
    trang_thai: {
      type: String,
      enum: ['cho_duyet', 'da_duyet', 'tu_choi', 'da_huy'],
      default: 'cho_duyet',
    },
    nguoi_duyet_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    thoi_diem_duyet: {
      type: Date,
      default: null,
    },
    // AI TAO don — khac voi nguoi DUYET. Truoc day khong luu, nen chi suy duoc tu trang_thai
    // luc moi tao (cho_duyet = bac si tu gui, da_duyet ngay = le tan ghi nhan ho). Suy kieu do
    // MAT DAU VET ngay khi le tan duyet don cua bac si: ca hai deu thanh da_duyet voi
    // nguoi_duyet_id = le tan. UI can phan biet "Bac si xin nghi" vs "Le tan ghi nhan".
    nguoi_tao_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    // Denormalize de khoi join NguoiDung moi lan render danh sach don nghi.
    nguon_tao: {
      type: String,
      enum: ['bac_si_tu_gui', 'le_tan_ghi_nhan', 'admin_tao'],
      default: 'bac_si_tu_gui',
    },
    ghi_chu: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'nghi_phep_bac_si',
  }
)

nghiPhepBacSiSchema.pre('validate', function () {
  if (this.tu_ngay && this.den_ngay && this.den_ngay < this.tu_ngay) {
    throw new Error('den_ngay phai >= tu_ngay')
  }
})

nghiPhepBacSiSchema.index({ bac_si_id: 1, tu_ngay: 1, den_ngay: 1 })
nghiPhepBacSiSchema.index({ trang_thai: 1 })

// Chan 2 le tan cung bam "bao nghi" tao ra 2 don trung. Kiem tra `overlappingLeave` trong
// controller doc o snapshot cua transaction, nen khi ca do KHONG co lich hen nao thi hai
// transaction khong ghi de len nhau -> ca hai cung tao duoc. Chan that o tang DB.
// Chi rang buoc don CON HIEU LUC; don tu_choi/da_huy duoc phep trung.
nghiPhepBacSiSchema.index(
  { bac_si_id: 1, tu_ngay: 1, den_ngay: 1, gio_bat_dau: 1 },
  {
    unique: true,
    name: 'uniq_don_nghi_dang_hieu_luc',
    partialFilterExpression: { trang_thai: { $in: ['cho_duyet', 'da_duyet'] } },
  },
)

export default mongoose.model('NghiPhepBacSi', nghiPhepBacSiSchema)
