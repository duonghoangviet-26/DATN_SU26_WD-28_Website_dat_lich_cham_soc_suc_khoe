import mongoose from 'mongoose'

// ============================================================
// MEMBER — Thành viên gia đình (A2)
// SQL tương đương: bảng members
// ============================================================
// - Tối đa 10 thành viên còn sống / nhóm (enforce qua pre-validate hook).
// - la_chu_ho=true → KHÔNG được xóa (kiểm tra ở tầng service).
// - Xóa = soft delete (ngay_xoa) để giữ lại hồ sơ y tế liên quan.

const MAX_MEMBERS = 10

const memberSchema = new mongoose.Schema(
  {
    family_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GiaDinh',
      required: true,
    },
    ho_ten: {
      type: String,
      required: [true, 'Họ tên thành viên là bắt buộc'],
      trim: true,
      maxlength: 255,
    },
    ngay_sinh: {
      type: Date,
      required: [true, 'Ngày sinh là bắt buộc'],
      validate: {
        validator: (v) => v instanceof Date && v.getTime() < Date.now(),
        message: 'Ngày sinh phải là ngày trong quá khứ',
      },
    },
    gioi_tinh: {
      type: String,
      enum: ['nam', 'nu', 'khac'],
      required: [true, 'Giới tính là bắt buộc'],
    },
    nhom_mau: {
      type: String,
      enum: ['A', 'B', 'AB', 'O', null],
      default: null,
    },
    di_ung:    { type: String, default: null }, // bác sĩ đọc trước khi khám
    benh_nen:  { type: String, default: null },
    la_chu_ho: { type: Boolean, default: false },
    ngay_xoa:  { type: Date, default: null }, // soft delete
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'thanh_vien',
  }
)

memberSchema.index({ family_id: 1 })
memberSchema.index({ ngay_xoa: 1 })
memberSchema.index({ la_chu_ho: 1 })

// Chặn vượt quá 10 thành viên còn sống / nhóm (chỉ khi thêm thành viên còn sống mới)
// Mongoose 9: hook async KHÔNG nhận next → throw để báo lỗi.
memberSchema.pre('validate', async function () {
  if (this.isNew && !this.ngay_xoa) {
    const count = await this.constructor.countDocuments({
      family_id: this.family_id,
      ngay_xoa: null,
    })
    if (count >= MAX_MEMBERS) {
      throw new Error(`Mỗi nhóm gia đình tối đa ${MAX_MEMBERS} thành viên`)
    }
  }
})

export default mongoose.model('ThanhVien', memberSchema)
