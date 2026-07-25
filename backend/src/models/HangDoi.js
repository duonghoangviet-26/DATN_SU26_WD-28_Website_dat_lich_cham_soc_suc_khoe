import mongoose from 'mongoose'

// ============================================================
// HANG DOI (QueueEntry) — hàng đợi động, online + offline ĐỒNG NHẤT.
// Chỉ khác nhau ở nhánh tính muc_uu_tien (online xét cửa sổ ±30' so giờ hẹn).
// Bảng riêng để chứa cả offline (chưa có LichHen) + audit gọi bệnh nhân + no-show.
// Actor-agnostic: nguoi_tiep_nhan_id + vai_tro_tiep_nhan (lễ tân làm sau, không đổi schema).
// KHÔNG lưu thu_tu — thứ tự đổi liên tục, tính động lúc query (sort muc_uu_tien → checkin_time).
// ============================================================

import { PHUT_GRACE } from '../utils/clinicTime.js'

const CUA_SO_UU_TIEN_PHUT = 30

// Chờ quá 2 khung (60') mà chưa tới lượt → nâng 1 bậc. Chống bỏ đói khách vãng lai:
// không có nó, khách online check-in liên tục sẽ chèn lên trên mãi và khách tới quầy
// buổi sáng có thể ngồi tới trưa (rule mục 6).
export const NGUONG_AGING_PHUT = Number(process.env.QUEUE_AGING_PHUT || 60)

export const THU_TU_UU_TIEN = { online_uu_tien: 0, online_thuong: 1, offline: 2 }

/**
 * @deprecated Chỉ còn dùng làm SNAPSHOT lúc check-in để đối chiếu về sau.
 * KHÔNG dùng để sắp xếp hàng đợi — xem `tinhBacUuTienDong()`.
 *
 * Cách tính cũ dựa trên cửa sổ `±30'` quanh giờ hẹn và LƯU CỨNG kết quả. Nó **phạt oan
 * người đến sớm**: khách check-in sớm hơn 30 phút bị xếp `online_thuong` vĩnh viễn, đứng
 * sau cả người check-in muộn hơn — dù khung của họ tới trước. Rule mục 6 chốt: đến sớm
 * KHÔNG bị phạt, và bậc ưu tiên phải tính ĐỘNG lúc query.
 */
export function tinhMucUuTien(nguon, checkinTime, gioHenGoc) {
  if (nguon === 'offline' || !gioHenGoc) return 'offline'
  const lech = Math.abs(new Date(checkinTime) - new Date(gioHenGoc)) / 60000 // phút
  const treHon = (new Date(checkinTime) - new Date(gioHenGoc)) / 60000
  if (treHon > CUA_SO_UU_TIEN_PHUT) return 'offline'
  if (lech <= CUA_SO_UU_TIEN_PHUT) return 'online_uu_tien'
  return 'online_thuong'
}

/**
 * Bậc ưu tiên THẬT của một lượt, tính tại thời điểm `now` (rule mục 6).
 *
 *   online_uu_tien — online, ĐÃ tới khung của mình (`now ≥ T`) và check-in ≤ `T+15'`
 *   online_thuong  — online, đã check-in nhưng CHƯA tới khung (đến sớm).
 *                    Tới `T` thì tự động lên `online_uu_tien` — không cần ghi lại gì.
 *   offline        — khách tới quầy, HOẶC online check-in sau `T+15'`
 *
 * Thuần tính toán, không chạm DB — gọi được ở mọi tầng.
 *
 * @param {object} entry - cần `nguon`, `gio_hen_goc`, `checkin_time`, `trang_thai`
 */
export function tinhBacUuTienDong(entry, now = new Date()) {
  const bacGoc = bacTruocAging(entry, now)

  // Aging CHỈ nâng offline -> online_thuong. Không nâng `online_thuong` lên
  // `online_uu_tien`: người đến sớm mà được nâng sẽ được gọi TRƯỚC đầu khung của mình,
  // trái ràng buộc ở mục 6. Họ tự lên bậc khi `now` chạm `T`.
  if (bacGoc !== 'offline') return bacGoc
  if (entry.trang_thai && entry.trang_thai !== 'dang_cho') return bacGoc

  const phutCho = (now.getTime() - new Date(entry.checkin_time).getTime()) / 60000
  return phutCho >= NGUONG_AGING_PHUT ? 'online_thuong' : 'offline'
}

function bacTruocAging(entry, now) {
  if (entry.nguon === 'offline' || !entry.gio_hen_goc) return 'offline'

  const T = new Date(entry.gio_hen_goc).getTime()
  const checkin = new Date(entry.checkin_time).getTime()

  // Check-in sau grace `T+15'` -> tụt xuống mức offline. Vẫn được khám, KHÔNG mất tiền
  // (rule mục 5) — chỉ mất quyền chen lên trước.
  if (checkin > T + PHUT_GRACE * 60_000) return 'offline'

  // Chưa tới khung của mình -> đến sớm. Chờ tới lượt khung của mình, không bị phạt.
  if (now.getTime() < T) return 'online_thuong'

  return 'online_uu_tien'
}

/** Đã tới khung của mình chưa — dùng để chặn gọi người đến sớm trước đầu khung. */
export function daToiKhungCuaMinh(entry, now = new Date()) {
  if (!entry.gio_hen_goc) return true // khách vãng lai không có khung, luôn sẵn sàng
  return now.getTime() >= new Date(entry.gio_hen_goc).getTime()
}

/** So sánh 2 lượt theo đúng thứ tự gọi: bậc ưu tiên động -> ai check-in trước. */
export function soSanhThuTuHangDoi(a, b, now = new Date()) {
  const w = THU_TU_UU_TIEN[tinhBacUuTienDong(a, now)] - THU_TU_UU_TIEN[tinhBacUuTienDong(b, now)]
  if (w !== 0) return w
  return new Date(a.checkin_time) - new Date(b.checkin_time)
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

    // ⚠️ SNAPSHOT lúc check-in, KHÔNG phải bậc ưu tiên đang có hiệu lực.
    // Bậc thật tính động lúc query bằng `tinhBacUuTienDong()` — lưu cứng sẽ phạt oan
    // người đến sớm (rule mục 6). Giữ field để đối chiếu/audit và để không phá dữ liệu cũ.
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
