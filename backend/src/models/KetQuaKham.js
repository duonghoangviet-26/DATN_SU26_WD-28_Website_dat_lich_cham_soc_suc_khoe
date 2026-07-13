import mongoose from 'mongoose'

const lichSuSuaSchema = new mongoose.Schema(
  {
    nguoi_sua_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    thoi_diem_sua: {
      type: Date,
      default: Date.now,
    },
    noi_dung: {
      type: String,
      default: null,
    },
  },
  { _id: false }
)

const examinationResultSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LichHen',
      required: true,
      unique: true,
    },
    nguoi_nhap_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    bac_si_phu_trach_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      default: null,
    },
    nguoi_xac_nhan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
    thoi_diem_xac_nhan: {
      type: Date,
      default: null,
    },
    // Luồng xác nhận hồ sơ khám (B4): hồ sơ do Y TÁ nhập luôn bắt đầu 'ban_nhap' → gửi
    // 'cho_xac_nhan' → bác sĩ "Xác nhận hồ sơ" (→ da_xac_nhan) hoặc "Yêu cầu chỉnh sửa"
    // (→ yeu_cau_chinh_sua). Hồ sơ do chính BÁC SĨ tự nhập (createResult, không qua y tá)
    // vào thẳng 'da_xac_nhan' luôn — bác sĩ không cần tự xác nhận lại hồ sơ do chính mình
    // viết (quyết định 2026-07-11, xem docs/Bác sĩ/Kiem tra - Luong nghiep vu Ho so xac
    // nhan hien tai). Default schema 'cho_xac_nhan' chỉ áp dụng khi không truyền status rõ ràng.
    status: {
      type: String,
      enum: ['ban_nhap', 'cho_xac_nhan', 'da_xac_nhan', 'yeu_cau_chinh_sua'],
      default: 'cho_xac_nhan',
    },
    // Lý do bác sĩ yêu cầu chỉnh sửa (bản mới nhất) — tách riêng khỏi lich_su_sua để hiển thị
    // nhanh trên UI mà không phải đọc lại toàn bộ mảng lịch sử.
    doctor_revision_note: { type: String, default: null },
    // Thời điểm y tá/bác sĩ gửi hồ sơ cho bác sĩ xác nhận lần gần nhất.
    submitted_at: { type: Date, default: null },
    chan_doan: {
      type: String,
      required: [true, 'Chan doan la bat buoc'],
      trim: true,
    },
    huong_dan_dieu_tri: { type: String, default: null },
    ghi_chu: { type: String, default: null },
    // Phần y tá nhập khi tiếp nhận ban đầu (trước khi bác sĩ kết luận) — tách riêng khỏi
    // ghi_chu/huong_dan_dieu_tri (thuộc chuyên môn bác sĩ) để không lẫn 2 vai trò.
    trieu_chung_ban_dau: { type: String, default: null },
    ghi_chu_dieu_duong: { type: String, default: null },
    ngay_tai_kham: { type: Date, default: null },
    co_the_sua: { type: Boolean, default: true },
    dich_vu_phat_sinh: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    dich_vu_tu_choi: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    chi_dinh_tai_kham: {
      type: Boolean,
      default: false,
    },
    da_dat_lich_tai_kham: {
      type: Boolean,
      default: false,
    },
    da_gui_cho_benh_nhan: {
      type: Boolean,
      default: false,
    },
    lich_su_sua: {
      type: [lichSuSuaSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'ket_qua_kham',
  }
)

export default mongoose.model('KetQuaKham', examinationResultSchema)
