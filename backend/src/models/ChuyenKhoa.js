import mongoose from 'mongoose'

import {
  DO_DAI_KHUNG_PHUT,
  MAC_DINH_THOI_GIAN_KHAM_PHUT,
  MAC_DINH_TY_LE_ONLINE,
  kiemTraCauHinhSlot,
} from '../utils/slotConfig.js'

// ============================================================
// SPECIALTY — Chuyên khoa y tế (C3)
// SQL tương đương: bảng specialties
// ============================================================
// slug auto-generate từ tên (URL-friendly), unique.
// status 'hidden' = ẩn khỏi tìm kiếm, không xóa để giữ dữ liệu cũ.
//
// Chuyên khoa còn là nơi CẤU HÌNH NĂNG LỰC KHÁM (rule mục 2): thêm chuyên khoa mới chỉ
// cần khai 5 giá trị dưới đây, KHÔNG sửa code logic. scheduleGenerator đọc thẳng từ đây.

const specialtySchema = new mongoose.Schema(
  {
    phong_kham_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ThongTinPhongKham',
      required: [true, 'ID Phòng khám là bắt buộc'],
    },
    ten: {
      type: String,
      required: [true, 'Tên chuyên khoa là bắt buộc'],
      trim: true,
      maxlength: 255,
    },
    mo_ta:    { type: String, default: null },
    icon_url: { type: String, default: null, maxlength: 500 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    thu_tu: { type: Number, default: 0 }, // thứ tự hiển thị
    status: {
      type: String,
      enum: ['active', 'hidden'],
      default: 'active',
    },

    // ── Cấu hình năng lực khám (rule mục 2 + 10.A/10.D) ──────────────────────
    // Thời gian khám trung bình 1 bệnh nhân. Quyết định số slot/khung 30'.
    thoi_gian_kham_trung_binh_phut: {
      type: Number,
      default: MAC_DINH_THOI_GIAN_KHAM_PHUT,
      min: [5, 'Thoi gian kham trung binh toi thieu 5 phut'],
      max: [DO_DAI_KHUNG_PHUT, `Thoi gian kham trung binh toi da ${DO_DAI_KHUNG_PHUT} phut`],
    },
    // null = tự tính floor(30 / thời gian khám). Admin chỉ được override XUỐNG thấp hơn
    // mức an toàn đó — enforce ở pre('validate') bên dưới và ở controller (findByIdAndUpdate
    // KHÔNG chạy document middleware).
    so_slot_moi_khung: {
      type: Number,
      default: null,
      min: [1, 'So slot moi khung toi thieu la 1'],
    },
    // Quota giữ chỗ cho khách đặt online; phần còn lại dành cho khách tới quầy (rule mục 4).
    ty_le_online_phan_tram: {
      type: Number,
      default: MAC_DINH_TY_LE_ONLINE,
      min: [0, 'Ty le online khong duoc am'],
      max: [100, 'Ty le online toi da 100'],
    },
    // MỘT giá duy nhất cho cả chuyên khoa (rule mục 12). Hệ thống tự gán bác sĩ nên giá
    // KHÔNG được nhảy theo từng bác sĩ — BacSi.gia_kham không dùng để tính tiền.
    gia_kham: {
      type: Number,
      default: 0,
      min: [0, 'Gia kham khong duoc am'],
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'chuyen_khoa',
  }
)

specialtySchema.index({ status: 1 })
specialtySchema.index({ thu_tu: 1 })
specialtySchema.index({ slug: 1, phong_kham_id: 1 }, { unique: true })

// Tự sinh slug từ tên nếu chưa có (bỏ dấu tiếng Việt + kebab-case)
function toSlug(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh tiếng Việt (Unicode combining marks U+0300–U+036F)
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const TRUONG_CAU_HINH_SLOT = [
  'thoi_gian_kham_trung_binh_phut',
  'so_slot_moi_khung',
  'ty_le_online_phan_tram',
  'gia_kham',
]

specialtySchema.pre('validate', function () {
  if (!this.slug && this.ten) this.slug = toSlug(this.ten)

  // CHỈ kiểm khi lần lưu này thực sự đụng tới cấu hình. Kiểm vô điều kiện sẽ làm một bản
  // ghi cũ lệch chuẩn chặn luôn các thao tác không liên quan (ẩn/hiện chuyên khoa, đổi tên).
  const coSuaCauHinh = this.isNew || TRUONG_CAU_HINH_SLOT.some((truong) => this.isModified(truong))
  if (!coSuaCauHinh) return

  const loi = kiemTraCauHinhSlot({
    thoi_gian_kham_trung_binh_phut: this.thoi_gian_kham_trung_binh_phut,
    so_slot_moi_khung: this.so_slot_moi_khung,
    ty_le_online_phan_tram: this.ty_le_online_phan_tram,
    gia_kham: this.gia_kham,
  })
  if (loi) throw new Error(loi)
})

export default mongoose.model('ChuyenKhoa', specialtySchema)
