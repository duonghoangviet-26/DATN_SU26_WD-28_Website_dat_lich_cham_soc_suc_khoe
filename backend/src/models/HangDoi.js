import mongoose from 'mongoose'

// ============================================================
// HANG DOI (QueueEntry) — hàng đợi động, online + offline ĐỒNG NHẤT.
// Chỉ khác nhau ở nhánh tính muc_uu_tien (online xét cửa sổ ±30' so giờ hẹn).
// Bảng riêng để chứa cả offline (chưa có LichHen) + audit gọi bệnh nhân + no-show.
// Actor-agnostic: nguoi_tiep_nhan_id + vai_tro_tiep_nhan (lễ tân làm sau, không đổi schema).
// KHÔNG lưu thu_tu — thứ tự đổi liên tục, tính động lúc query (sort muc_uu_tien → checkin_time).
// ============================================================

const CUA_SO_UU_TIEN_PHUT = 30

// Tính mức ưu tiên tại thời điểm check-in (đặc tả TH1–TH6).
export function tinhMucUuTien(nguon, checkinTime, gioHenGoc) {
  if (nguon === 'offline' || !gioHenGoc) return 'offline'
  const lech = Math.abs(new Date(checkinTime) - new Date(gioHenGoc)) / 60000 // phút
  const treHon = (new Date(checkinTime) - new Date(gioHenGoc)) / 60000
  if (treHon > CUA_SO_UU_TIEN_PHUT) return 'offline' // đến trễ > 30' → mất ưu tiên
  if (lech <= CUA_SO_UU_TIEN_PHUT) return 'online_uu_tien' // trong cửa sổ ±30'
  return 'online_thuong'
}

const queueSchema = new mongoose.Schema(
  {
    // Nguồn & định danh bệnh nhân (đồng nhất 2 nguồn)
    nguon: { type: String, enum: ['online', 'offline'], required: true },
    // KHÔNG đặt default:null — field phải THIẾU HẲN (undefined) ở entry offline để sparse unique
    // index hoạt động đúng (Mongo sparse chỉ bỏ qua field thiếu, không bỏ qua giá trị null tường minh).
    appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichHen' },
    khach_vang_lai_id: { type: mongoose.Schema.Types.ObjectId, ref: 'KhachVangLai', default: null },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ThanhVien', default: null },
    ten_benh_nhan: { type: String, required: true, trim: true, maxlength: 255 },
    so_dien_thoai: { type: String, default: null, maxlength: 20 },
    tuoi: { type: Number, default: null, min: 0 },
    gioi_tinh: { type: String, enum: ['nam', 'nu', 'khac'], default: null },

    // Điều phối — KHÔNG lưu thu_tu (thứ tự đổi liên tục, tính động lúc query)
    specialty_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChuyenKhoa', required: true },
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
    phong_kham: { type: String, default: null },

    // Ưu tiên
    muc_uu_tien: {
      type: String,
      enum: ['online_uu_tien', 'online_thuong', 'offline'],
      required: true,
    },
    gio_hen_goc: { type: Date, default: null },

    // Vòng đời
    // cho_dich_vu: benh nhan di lam dich vu bo sung (noi soi, xet nghiem...) roi quay lai hang doi
    // (xem .claude/rules/lich-lam-viec-bac-si.md muc 8/G6). CHUA co endpoint nao chuyen trang thai
    // nay — chi mo enum truoc, wiring workflow la tinh nang rieng, ngoai pham vi plan nay.
    trang_thai: {
      type: String,
      enum: ['dang_cho', 'da_goi', 'trong_phong', 'cho_dich_vu', 'skipped', 'cancelled', 'hoan_thanh'],
      default: 'dang_cho',
    },
    checkin_time: { type: Date, required: true },
    so_lan_goi: { type: Number, default: 0, min: 0 },
    thoi_diem_goi: { type: Date, default: null },
    thoi_diem_vao_phong: { type: Date, default: null },
    thoi_diem_ket_thuc: { type: Date, default: null },
    thoi_gian_cho_uoc_tinh_phut: { type: Number, default: null, min: 0 },

    // Actor tiếp nhận (actor-agnostic)
    nguoi_tiep_nhan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    vai_tro_tiep_nhan: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'hang_doi',
  }
)

// Online phải có appointment_id; offline phải có SĐT (ten_benh_nhan đã required sẵn).
queueSchema.pre('validate', function () {
  if (this.nguon === 'online' && !this.appointment_id) {
    throw new Error('Hang doi online bat buoc co appointment_id')
  }
  if (this.nguon === 'offline' && !this.so_dien_thoai) {
    throw new Error('Hang doi offline bat buoc co so_dien_thoai')
  }
})

queueSchema.index({ doctor_id: 1, trang_thai: 1 })
queueSchema.index({ specialty_id: 1, trang_thai: 1 })
queueSchema.index({ appointment_id: 1 }, { unique: true, sparse: true })
queueSchema.index({ trang_thai: 1, thoi_diem_goi: 1 })

export default mongoose.model('HangDoi', queueSchema)
