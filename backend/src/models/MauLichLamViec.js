import mongoose from 'mongoose'

// ============================================================
// MAU LICH LAM VIEC — Bac si dang ky lam viec THEO CA, theo thu trong tuan
// Rule: .claude/rules/lich-lam-viec-bac-si.md muc 3 + 10.B
// ============================================================
// Truoc day `scheduleGenerator` sinh lich FULL-DAY cho MOI bac si dang hoat dong, moi
// ngay trong tuan. Sai nghiep vu: bac si cua VitaFamily KHONG full-time — ho dang ky
// theo CA. Bang nay la nguon de generator biet ca nao that su co nguoi truc.
//
// ⚠️ HAI RANG BUOC BAT BIEN cua muc 3 duoc dat O DAY, khong dat o `LichLamViec`:
//     1 phong = 1 bac si / ca      2. 1 bac si = 1 phong / ca
// Ly do: mau la NGUON dang ky, lich lam viec chi la HE QUA duoc sinh ra. Chan o nguon
// thi lich sinh ra khong bao gio vi pham; chan o lich thi phai tach moi ban ghi ngay
// thanh 2 ban ghi ca — dai phau cham toi ~9 cho dang gia dinh "1 lich / bac si / ngay"
// (rule muc 7 dan khoan: KHONG dai phau tru khi duoc yeu cau).

export const CA_SANG = 'sang'
export const CA_CHIEU = 'chieu'
export const CA_TOI = 'toi'
export const CAC_CA = [CA_SANG, CA_CHIEU]

// Khung gio (30') thuoc ve ca nao — khop DEFAULT_SLOT_TIMES trong scheduleGenerator.
// Ca sang = khung 0..6 (08:00–11:30), ca chieu = khung 7..14 (13:30–17:30).
export const KHUNG_DAU_CA_CHIEU = 7

export function caCuaKhung(khungIndex) {
  return Number(khungIndex) >= KHUNG_DAU_CA_CHIEU ? CA_CHIEU : CA_SANG
}

// Nghỉ trưa 11:30–13:30, nên mọi khung từ 12:00 trở đi thuộc ca chiều.
const GIO_BAT_DAU_CA_CHIEU = '12:00'
const GIO_BAT_DAU_CA_TOI = '18:00'

/**
 * Ca của một khung, suy từ GIỜ thay vì `khung_index`.
 *
 * `khung_index` được thêm sau (migration 2026-07-23) nên slot cũ có thể thiếu — khi đó
 * `Number(null) === 0` khiến khung 13:30 bị xếp vào ca sáng. Giờ bắt đầu thì luôn tồn tại
 * và luôn đúng, nên đây là nguồn đáng tin hơn khi hiển thị cho bệnh nhân.
 */
export function caTheoGio(gioBatDau) {
  if (!gioBatDau) return CA_SANG
  if (String(gioBatDau) >= GIO_BAT_DAU_CA_TOI) return CA_TOI
  return String(gioBatDau) >= GIO_BAT_DAU_CA_CHIEU ? CA_CHIEU : CA_SANG
}

const mauLichLamViecSchema = new mongoose.Schema(
  {
    bac_si_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BacSi',
      required: [true, 'bac_si_id la bat buoc'],
    },
    // 0 = Chu nhat ... 6 = Thu bay, khop Date.getUTCDay().
    thu_trong_tuan: {
      type: Number,
      required: [true, 'thu_trong_tuan la bat buoc'],
      min: [0, 'thu_trong_tuan tu 0 (Chu nhat) den 6 (Thu bay)'],
      max: [6, 'thu_trong_tuan tu 0 (Chu nhat) den 6 (Thu bay)'],
    },
    ca: {
      type: String,
      required: [true, 'ca la bat buoc'],
      enum: { values: CAC_CA, message: 'ca chi nhan "sang" hoac "chieu"' },
    },
    phong_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PhongKham',
      required: [true, 'phong_id la bat buoc — 1 bac si phai co dung 1 phong moi ca'],
    },
    chuyen_khoa_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChuyenKhoa',
      default: null,
    },
    trang_thai: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    // Khoang hieu luc. `hieu_luc_den = null` nghia la con hieu luc vo thoi han.
    hieu_luc_tu: {
      type: Date,
      required: [true, 'hieu_luc_tu la bat buoc'],
    },
    hieu_luc_den: {
      type: Date,
      default: null,
    },
    ghi_chu: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'mau_lich_lam_viec',
  }
)

mauLichLamViecSchema.index({ bac_si_id: 1, trang_thai: 1 })
mauLichLamViecSchema.index({ thu_trong_tuan: 1, ca: 1, trang_thai: 1 })
mauLichLamViecSchema.index({ phong_id: 1, thu_trong_tuan: 1, ca: 1, trang_thai: 1 })

mauLichLamViecSchema.pre('validate', function () {
  if (this.hieu_luc_den && this.hieu_luc_tu && this.hieu_luc_den < this.hieu_luc_tu) {
    throw new Error('hieu_luc_den phai sau hoac bang hieu_luc_tu')
  }
})

// ── Kiem tra chong lan hieu luc ──────────────────────────────────────────────
// Unique index KHONG dien ta duoc "trung khoa NHUNG khac khoang hieu luc" — hai mau
// cung (thu, ca, phong) ma khoang thoi gian roi nhau la HOP LE (vd doi phong tu thang
// sau). Nen rang buoc phai kiem o service, giong cach `NghiPhepBacSi` chan trung don.
export function haiKhoangGiaoNhau(aTu, aDen, bTu, bDen) {
  const ketA = aDen ? aDen.getTime() : Infinity
  const ketB = bDen ? bDen.getTime() : Infinity
  return aTu.getTime() <= ketB && bTu.getTime() <= ketA
}

const MauLichLamViec = mongoose.model('MauLichLamViec', mauLichLamViecSchema)

// Tra ve mang mau ACTIVE dang xung dot voi mau du kien. Rong = hop le.
// `boQuaId` dung khi cap nhat chinh ban ghi do.
export async function timMauXungDot(
  { bac_si_id, thu_trong_tuan, ca, phong_id, hieu_luc_tu, hieu_luc_den = null },
  boQuaId = null,
) {
  const filter = {
    trang_thai: 'active',
    thu_trong_tuan,
    ca,
    // Hai chieu cua cung mot luat: cung phong (phong bi hai bac si gianh) HOAC
    // cung bac si (bac si bi xep 2 phong cung ca).
    $or: [{ phong_id }, { bac_si_id }],
  }
  if (boQuaId) filter._id = { $ne: boQuaId }

  const ungVien = await MauLichLamViec.find(filter).lean()
  const tu = new Date(hieu_luc_tu)
  const den = hieu_luc_den ? new Date(hieu_luc_den) : null

  return ungVien.filter((m) =>
    haiKhoangGiaoNhau(tu, den, new Date(m.hieu_luc_tu), m.hieu_luc_den ? new Date(m.hieu_luc_den) : null)
  )
}

export default MauLichLamViec
