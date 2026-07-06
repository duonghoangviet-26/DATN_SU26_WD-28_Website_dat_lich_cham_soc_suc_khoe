import mongoose from 'mongoose'

const MAX_MEMBERS = 10

const memberSchema = new mongoose.Schema(
  {
    family_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GiaDinh',
      required: true,
    },
    tai_khoan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    ho_ten: {
      type: String,
      required: [true, 'Ho ten thanh vien la bat buoc'],
      trim: true,
      maxlength: 255,
    },
    ngay_sinh: {
      type: Date,
      required: [true, 'Ngay sinh la bat buoc'],
      validate: {
        validator: (value) => value instanceof Date && value.getTime() < Date.now(),
        message: 'Ngay sinh phai la ngay trong qua khu',
      },
    },
    gioi_tinh: {
      type: String,
      enum: ['nam', 'nu', 'khac'],
      required: [true, 'Gioi tinh la bat buoc'],
    },
    quan_he: {
      type: String,
      enum: ['ban_than', 'cha', 'me', 'con', 'vo', 'chong', 'anh_chi_em', 'khac'],
      default: null,
    },
    nhom_mau: {
      type: String,
      enum: ['A', 'B', 'AB', 'O', null],
      default: null,
    },
    di_ung: { type: String, default: null },
    benh_nen: { type: String, default: null },
    la_chu_ho: { type: Boolean, default: false },
    ngay_xoa: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'thanh_vien',
  }
)

memberSchema.index({ family_id: 1 })
memberSchema.index({ ngay_xoa: 1 })
memberSchema.index({ la_chu_ho: 1 })

memberSchema.pre('validate', async function () {
  if (this.isNew && !this.ngay_xoa) {
    const count = await this.constructor.countDocuments({
      family_id: this.family_id,
      ngay_xoa: null,
    })

    if (count >= MAX_MEMBERS) {
      throw new Error(`Moi nhom gia dinh toi da ${MAX_MEMBERS} thanh vien`)
    }
  }
})

export default mongoose.model('ThanhVien', memberSchema)
