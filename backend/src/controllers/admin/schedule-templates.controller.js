import mongoose from 'mongoose'

import { BacSi, ChuyenKhoa, NhatKyThaoTac, PhongKham } from '../../models/index.js'
import MauLichLamViec, { CAC_CA, timMauXungDot } from '../../models/MauLichLamViec.js'
import { ok, created, fail } from '../../utils/response.js'

// ============================================================
// C — Mau dang ky ca lam viec cua bac si (rule muc 3 + 10.B)
// Routes: /api/admin/schedule-templates
// ============================================================
// Bac si VitaFamily KHONG full-time. Bang nay la NGUON de generator biet ca nao that su
// co nguoi truc; truoc day generator tu sinh full-day cho moi bac si, sai nghiep vu.
//
// Hai rang buoc bat bien duoc gac O DAY (khong gac o `LichLamViec`):
//   1 phong = 1 bac si / ca      2. 1 bac si = 1 phong / ca
// Chan o nguon thi lich sinh ra khong bao gio vi pham.

const TEN_THU = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const TEN_CA = { sang: 'Ca sáng', chieu: 'Ca chiều' }

function tenPhongDayDu(room) {
  if (!room) return null
  return `${room.ten}, Tầng ${room.tang}, Tòa ${room.toa}`
}

function fmt(mau) {
  return {
    id: mau._id,
    bac_si_id: mau.bac_si_id?._id ?? mau.bac_si_id,
    bac_si_ten: mau.bac_si_id?.user_id?.ho_ten ?? null,
    thu_trong_tuan: mau.thu_trong_tuan,
    thu_ten: TEN_THU[mau.thu_trong_tuan] ?? null,
    ca: mau.ca,
    ca_ten: TEN_CA[mau.ca] ?? mau.ca,
    phong_id: mau.phong_id?._id ?? mau.phong_id,
    phong_ten: tenPhongDayDu(mau.phong_id),
    chuyen_khoa_id: mau.chuyen_khoa_id?._id ?? mau.chuyen_khoa_id,
    chuyen_khoa_ten: mau.chuyen_khoa_id?.ten ?? null,
    trang_thai: mau.trang_thai,
    hieu_luc_tu: mau.hieu_luc_tu,
    hieu_luc_den: mau.hieu_luc_den,
    ghi_chu: mau.ghi_chu,
  }
}

function napQuanHe(query) {
  return query
    .populate({ path: 'bac_si_id', select: 'user_id', populate: { path: 'user_id', select: 'ho_ten' } })
    .populate('phong_id', 'ten tang toa')
    .populate('chuyen_khoa_id', 'ten')
}

async function ghiNhatKy(req, hanhDong, doiTuongId, lyDo) {
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: req.user?.id ?? null,
    vai_tro: 'admin',
    hanh_dong: hanhDong,
    loai_doi_tuong: 'schedule_template',
    doi_tuong_id: doiTuongId,
    ly_do: lyDo,
  })
}

// Doc + kiem payload. Tra { du_lieu, loi }.
function docPayload(body) {
  const { bac_si_id, thu_trong_tuan, ca, phong_id, chuyen_khoa_id, hieu_luc_tu, hieu_luc_den, ghi_chu } = body

  if (!mongoose.Types.ObjectId.isValid(bac_si_id)) return { loi: 'bac_si_id khong hop le' }
  if (!mongoose.Types.ObjectId.isValid(phong_id)) return { loi: 'phong_id khong hop le' }

  const thu = Number(thu_trong_tuan)
  if (!Number.isInteger(thu) || thu < 0 || thu > 6) {
    return { loi: 'thu_trong_tuan phai la so nguyen tu 0 (Chu nhat) den 6 (Thu bay)' }
  }
  if (!CAC_CA.includes(ca)) return { loi: 'ca chi nhan "sang" hoac "chieu"' }

  const tu = hieu_luc_tu ? new Date(hieu_luc_tu) : new Date()
  if (Number.isNaN(tu.getTime())) return { loi: 'hieu_luc_tu khong hop le' }
  tu.setUTCHours(0, 0, 0, 0)

  let den = null
  if (hieu_luc_den) {
    den = new Date(hieu_luc_den)
    if (Number.isNaN(den.getTime())) return { loi: 'hieu_luc_den khong hop le' }
    den.setUTCHours(0, 0, 0, 0)
    if (den < tu) return { loi: 'hieu_luc_den phai sau hoac bang hieu_luc_tu' }
  }

  return {
    du_lieu: {
      bac_si_id,
      thu_trong_tuan: thu,
      ca,
      phong_id,
      chuyen_khoa_id: mongoose.Types.ObjectId.isValid(chuyen_khoa_id) ? chuyen_khoa_id : null,
      hieu_luc_tu: tu,
      hieu_luc_den: den,
      ghi_chu: ghi_chu?.trim() || null,
    },
  }
}

// Dien giai xung dot thanh cau nguoi doc hieu duoc, thay vi bao "trung khoa".
async function moTaXungDot(danhSach, bacSiDangXet) {
  const ids = danhSach.map((m) => m.bac_si_id)
  const bacSi = await BacSi.find({ _id: { $in: ids } })
    .populate('user_id', 'ho_ten').select('user_id').lean()
  const tenTheoId = new Map(bacSi.map((b) => [String(b._id), b.user_id?.ho_ten ?? 'bác sĩ khác']))

  return danhSach.map((m) => {
    const cungBacSi = String(m.bac_si_id) === String(bacSiDangXet)
    return cungBacSi
      ? `${TEN_THU[m.thu_trong_tuan]} ${TEN_CA[m.ca]}: bác sĩ này đã được xếp một phòng khác`
      : `${TEN_THU[m.thu_trong_tuan]} ${TEN_CA[m.ca]}: phòng đã do ${tenTheoId.get(String(m.bac_si_id)) ?? 'bác sĩ khác'} trực`
  })
}

// ─── GET /api/admin/schedule-templates?bac_si_id=&phong_id=&trang_thai= ──────
export async function list(req, res) {
  try {
    const { bac_si_id, phong_id, trang_thai } = req.query
    const filter = {}
    if (mongoose.Types.ObjectId.isValid(bac_si_id)) filter.bac_si_id = bac_si_id
    if (mongoose.Types.ObjectId.isValid(phong_id)) filter.phong_id = phong_id
    if (trang_thai) filter.trang_thai = trang_thai

    const mau = await napQuanHe(MauLichLamViec.find(filter))
      .sort({ thu_trong_tuan: 1, ca: 1 })
      .lean()

    return ok(res, mau.map(fmt))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/admin/schedule-templates/grid ──────────────────────────────────
// Luoi 7 thu x 2 ca — cach admin thuc su nhin lich truc, thay vi danh sach phang.
export async function grid(req, res) {
  try {
    const mau = await napQuanHe(MauLichLamViec.find({ trang_thai: 'active' })).lean()

    const luoi = TEN_THU.map((ten, thu) => ({
      thu_trong_tuan: thu,
      thu_ten: ten,
      sang: mau.filter((m) => m.thu_trong_tuan === thu && m.ca === 'sang').map(fmt),
      chieu: mau.filter((m) => m.thu_trong_tuan === thu && m.ca === 'chieu').map(fmt),
    }))

    const [doctors, rooms] = await Promise.all([
      BacSi.find({ trang_thai_duyet: 'approved', trang_thai: 'active', la_hien: true })
        .populate('user_id', 'ho_ten').select('user_id specialties').lean(),
      PhongKham.find({ trang_thai: 'active' }).lean(),
    ])

    // Bac si chua duoc xep ca nao — day chinh la nhung nguoi se KHONG co lich lam viec.
    const coMau = new Set(mau.map((m) => String(m.bac_si_id?._id ?? m.bac_si_id)))
    const chuaXepCa = doctors
      .filter((d) => !coMau.has(String(d._id)))
      .map((d) => ({ id: d._id, ho_ten: d.user_id?.ho_ten ?? null }))

    return ok(res, {
      luoi,
      chua_xep_ca: chuaXepCa,
      bac_si: doctors.map((d) => ({ id: d._id, ho_ten: d.user_id?.ho_ten ?? null })),
      phong: rooms.map((r) => ({ id: r._id, ten: tenPhongDayDu(r) })),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/admin/schedule-templates ──────────────────────────────────────
export async function create(req, res) {
  try {
    const { du_lieu, loi } = docPayload(req.body)
    if (loi) return fail(res, 400, loi)

    const [bacSi, phong] = await Promise.all([
      BacSi.findById(du_lieu.bac_si_id).select('_id specialties').lean(),
      PhongKham.findById(du_lieu.phong_id).select('_id trang_thai').lean(),
    ])
    if (!bacSi) return fail(res, 404, 'Khong tim thay bac si')
    if (!phong) return fail(res, 404, 'Khong tim thay phong kham')
    if (phong.trang_thai !== 'active') return fail(res, 400, 'Phong kham dang ngung hoat dong')

    if (du_lieu.chuyen_khoa_id) {
      const ck = await ChuyenKhoa.findById(du_lieu.chuyen_khoa_id).select('_id').lean()
      if (!ck) return fail(res, 404, 'Khong tim thay chuyen khoa')
    }

    const xungDot = await timMauXungDot(du_lieu)
    if (xungDot.length > 0) {
      const moTa = await moTaXungDot(xungDot, du_lieu.bac_si_id)
      return fail(res, 409, `Không xếp được ca này. ${moTa.join('; ')}.`)
    }

    const mau = await MauLichLamViec.create({
      ...du_lieu,
      chuyen_khoa_id: du_lieu.chuyen_khoa_id ?? bacSi.specialties?.[0] ?? null,
    })

    await ghiNhatKy(req, 'CREATE_SCHEDULE_TEMPLATE', mau._id,
      `Xep ${TEN_THU[mau.thu_trong_tuan]} ${TEN_CA[mau.ca]} cho bac si ${mau.bac_si_id}`)

    const daNap = await napQuanHe(MauLichLamViec.findById(mau._id)).lean()
    return created(res, fmt(daNap), 'Da xep ca lam viec')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PUT /api/admin/schedule-templates/:id ───────────────────────────────────
export async function update(req, res) {
  try {
    const mau = await MauLichLamViec.findById(req.params.id)
    if (!mau) return fail(res, 404, 'Khong tim thay mau lich lam viec')

    const { du_lieu, loi } = docPayload({
      bac_si_id: req.body.bac_si_id ?? String(mau.bac_si_id),
      thu_trong_tuan: req.body.thu_trong_tuan ?? mau.thu_trong_tuan,
      ca: req.body.ca ?? mau.ca,
      phong_id: req.body.phong_id ?? String(mau.phong_id),
      chuyen_khoa_id: req.body.chuyen_khoa_id ?? (mau.chuyen_khoa_id ? String(mau.chuyen_khoa_id) : null),
      hieu_luc_tu: req.body.hieu_luc_tu ?? mau.hieu_luc_tu,
      hieu_luc_den: req.body.hieu_luc_den !== undefined ? req.body.hieu_luc_den : mau.hieu_luc_den,
      ghi_chu: req.body.ghi_chu ?? mau.ghi_chu,
    })
    if (loi) return fail(res, 400, loi)

    // Chi kiem xung dot khi mau van dang active — mau inactive khong chiem phong.
    const trangThaiMoi = req.body.trang_thai ?? mau.trang_thai
    if (trangThaiMoi === 'active') {
      const xungDot = await timMauXungDot(du_lieu, mau._id)
      if (xungDot.length > 0) {
        const moTa = await moTaXungDot(xungDot, du_lieu.bac_si_id)
        return fail(res, 409, `Không xếp được ca này. ${moTa.join('; ')}.`)
      }
    }

    Object.assign(mau, du_lieu, { trang_thai: trangThaiMoi })
    await mau.save()

    await ghiNhatKy(req, 'UPDATE_SCHEDULE_TEMPLATE', mau._id,
      `Cap nhat ${TEN_THU[mau.thu_trong_tuan]} ${TEN_CA[mau.ca]}`)

    const daNap = await napQuanHe(MauLichLamViec.findById(mau._id)).lean()
    return ok(res, fmt(daNap), 'Da cap nhat ca lam viec')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── DELETE /api/admin/schedule-templates/:id ────────────────────────────────
// Xoa MEM (trang_thai='inactive'): lich da sinh ra tu mau nay van con, nen xoa cung se
// lam mat dau vet vi sao ngay do co lich.
export async function remove(req, res) {
  try {
    const mau = await MauLichLamViec.findById(req.params.id)
    if (!mau) return fail(res, 404, 'Khong tim thay mau lich lam viec')

    mau.trang_thai = 'inactive'
    await mau.save()

    await ghiNhatKy(req, 'DISABLE_SCHEDULE_TEMPLATE', mau._id,
      `Bo ${TEN_THU[mau.thu_trong_tuan]} ${TEN_CA[mau.ca]} cua bac si ${mau.bac_si_id}`)

    return ok(res, { id: mau._id, trang_thai: mau.trang_thai },
      'Da bo ca khoi lich truc. Lich da sinh truoc do khong bi xoa.')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/admin/schedule-templates/bulk ─────────────────────────────────
// Xep nhieu ca cung luc cho 1 bac si (vd "sang thu 2-6"). Tat ca hoac khong —
// xep duoc mot nua roi bao loi la trang thai kho hieu nhat cho admin.
export async function bulkCreate(req, res) {
  try {
    const { bac_si_id, phong_id, chuyen_khoa_id, hieu_luc_tu, hieu_luc_den, cac_ca } = req.body
    if (!Array.isArray(cac_ca) || cac_ca.length === 0) {
      return fail(res, 400, 'cac_ca phai la mang [{ thu_trong_tuan, ca }] khong rong')
    }

    const dinhNghia = []
    for (const item of cac_ca) {
      const { du_lieu, loi } = docPayload({
        bac_si_id, phong_id, chuyen_khoa_id, hieu_luc_tu, hieu_luc_den,
        thu_trong_tuan: item.thu_trong_tuan, ca: item.ca,
      })
      if (loi) return fail(res, 400, loi)
      dinhNghia.push(du_lieu)
    }

    // Kiem TOAN BO truoc khi ghi bat ky ban ghi nao.
    for (const du_lieu of dinhNghia) {
      const xungDot = await timMauXungDot(du_lieu)
      if (xungDot.length > 0) {
        const moTa = await moTaXungDot(xungDot, du_lieu.bac_si_id)
        return fail(res, 409, `Không xếp được ${TEN_THU[du_lieu.thu_trong_tuan]} ${TEN_CA[du_lieu.ca]}. ${moTa.join('; ')}.`)
      }
    }
    // Trung nhau ngay trong chinh payload (vd gui 2 lan cung thu + ca).
    const khoa = new Set()
    for (const d of dinhNghia) {
      const k = `${d.thu_trong_tuan}|${d.ca}`
      if (khoa.has(k)) return fail(res, 400, `Trung ${TEN_THU[d.thu_trong_tuan]} ${TEN_CA[d.ca]} trong cung mot yeu cau`)
      khoa.add(k)
    }

    const daTao = await MauLichLamViec.insertMany(dinhNghia)
    await ghiNhatKy(req, 'CREATE_SCHEDULE_TEMPLATE', daTao[0]._id,
      `Xep ${daTao.length} ca cho bac si ${bac_si_id}`)

    const daNap = await napQuanHe(MauLichLamViec.find({ _id: { $in: daTao.map((m) => m._id) } })).lean()
    return created(res, daNap.map(fmt), `Da xep ${daTao.length} ca lam viec`)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
