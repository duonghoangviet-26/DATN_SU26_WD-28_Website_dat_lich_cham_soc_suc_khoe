import { BacSi, HangDoi, KetQuaKham, HoaDon, LichHen } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// C4 — "Bệnh nhân đã khám" (danh sách hồ sơ đã khám của bác sĩ)
// ============================================================
// Tách khỏi examQueue() (trang "Hồ sơ chờ khám"): bảng chờ khám chỉ nên còn người CẦN xử lý,
// bệnh nhân đã hoàn tất (da_xong) chuyển hẳn sang đây để không chiếm chỗ, đồng thời cho phép
// tra cứu qua nhiều ngày (chờ khám chỉ xem đúng 1 ngày).

async function getDocId(userId) {
  const d = await BacSi.findOne({ user_id: userId }).select('_id').lean()
  return d?._id ?? null
}

function clinicDayRange(value = new Date()) {
  const date = new Date(value)
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  start.setUTCHours(start.getUTCHours() - 7) // Chuyển 00:00 VN -> 17:00 UTC hôm trước
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

const SO_NGAY_TIM_KIEM_MAC_DINH = 90

function xacDinhKhoangNgay(query) {
  if (query.tu || query.den) {
    const tuDate = query.tu ? new Date(query.tu) : new Date()
    const denDate = query.den ? new Date(query.den) : tuDate
    const { start } = clinicDayRange(tuDate)
    const { end } = clinicDayRange(denDate)
    return { start, end }
  }
  const q = String(query.q ?? '').trim()
  if (q) {
    const { end } = clinicDayRange(new Date())
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - SO_NGAY_TIM_KIEM_MAC_DINH)
    return { start, end }
  }
  return clinicDayRange(query.date ?? new Date())
}

// ─── GET /api/doctor/exam-history?date=&tu=&den=&q= ──────────────────────────
export async function list(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { start, end } = xacDinhKhoangNgay(req.query)
    const q = String(req.query.q ?? '').trim().toLowerCase()

    // 1. Lấy HangDoi (offline & online đã checkin)
    const hangDoiEntries = await HangDoi.find({
      doctor_id: docId,
      trang_thai: 'hoan_thanh',
      $or: [
        { thoi_diem_ket_thuc: { $gte: start, $lt: end } },
        { checkin_time: { $gte: start, $lt: end } }
      ]
    })
      .select('ten_benh_nhan so_dien_thoai checkin_time thoi_diem_ket_thuc nguon ma_so_thu_tu appointment_id')
      .lean()

    // 2. Lấy LichHen đã hoàn thành của bác sĩ
    const lichHenEntries = await LichHen.find({
      doctor_id: docId,
      status: 'completed',
      ngay_kham: { $gte: start, $lt: end }
    })
      .select('_id ten_khach so_dien_thoai_khach ngay_kham ngay_cap_nhat nguon')
      .lean()

    const apptIdsFromHangDoi = new Set(hangDoiEntries.map(h => String(h.appointment_id)).filter(Boolean))
    
    // Ghép các LichHen chưa có record HangDoi tương ứng
    const extraEntries = lichHenEntries
      .filter(l => !apptIdsFromHangDoi.has(String(l._id)))
      .map(l => ({
        _id: l._id,
        appointment_id: l._id,
        ten_benh_nhan: l.ten_khach,
        so_dien_thoai: l.so_dien_thoai_khach ?? null,
        nguon: l.nguon || 'online',
        ma_so_thu_tu: null,
        checkin_time: l.ngay_kham,
        thoi_diem_ket_thuc: l.ngay_cap_nhat || l.ngay_kham,
      }))

    const allEntries = [...hangDoiEntries, ...extraEntries]

    if (allEntries.length === 0) return ok(res, [])

    const hangDoiIds = hangDoiEntries.map((e) => e._id)
    const apptIds = allEntries.map((e) => e.appointment_id).filter(Boolean)

    // 3. Tìm Kết quả khám & Hóa đơn
    const [results, invoices] = await Promise.all([
      KetQuaKham.find({
        $or: [
          { hang_doi_id: { $in: hangDoiIds } },
          { appointment_id: { $in: apptIds } },
          { bac_si_phu_trach_id: docId }
        ],
        status: { $in: ['da_xac_nhan', 'hoan_thanh'] }
      })
        .select('hang_doi_id appointment_id chan_doan ket_cuc thoi_diem_xac_nhan dich_vu_phat_sinh')
        .lean(),
      HoaDon.find({
        $or: [
          { hang_doi_id: { $in: hangDoiIds } },
          { appointment_id: { $in: apptIds } }
        ]
      })
        .select('hang_doi_id appointment_id tong_thanh_toan trang_thai_hoa_don')
        .lean(),
    ])

    const kqMap = new Map()
    results.forEach(r => {
      if (r.hang_doi_id) kqMap.set(`hd_${r.hang_doi_id}`, r)
      if (r.appointment_id) kqMap.set(`lh_${r.appointment_id}`, r)
    })

    const hoaDonMap = new Map()
    invoices.forEach(h => {
      if (h.hang_doi_id) hoaDonMap.set(`hd_${h.hang_doi_id}`, h)
      if (h.appointment_id) hoaDonMap.set(`lh_${h.appointment_id}`, h)
    })

    let rows = allEntries
      .map(e => {
        const kq = (e.appointment_id ? kqMap.get(`lh_${e.appointment_id}`) : null)
          || kqMap.get(`hd_${e._id}`)
        
        if (!kq) return null

        const hoaDon = (e.appointment_id ? hoaDonMap.get(`lh_${e.appointment_id}`) : null)
          || hoaDonMap.get(`hd_${e._id}`)

        return {
          queue_id: String(e._id),
          ten_benh_nhan: e.ten_benh_nhan,
          so_dien_thoai: e.so_dien_thoai ?? null,
          nguon: e.nguon,
          ma_so_thu_tu: e.ma_so_thu_tu ?? null,
          checkin_time: e.checkin_time,
          thoi_diem_xac_nhan: kq.thoi_diem_xac_nhan || e.thoi_diem_ket_thuc,
          chan_doan: kq.chan_doan,
          ket_cuc: kq.ket_cuc || 'dieu_tri_thuong',
          so_dich_vu_phat_sinh: Array.isArray(kq.dich_vu_phat_sinh) ? kq.dich_vu_phat_sinh.length : 0,
          tong_thanh_toan: hoaDon?.tong_thanh_toan ?? null,
          trang_thai_hoa_don: hoaDon?.trang_thai_hoa_don ?? null,
        }
      })
      .filter(Boolean)

    if (q) {
      rows = rows.filter((r) => r.ten_benh_nhan?.toLowerCase().includes(q) || (r.so_dien_thoai ?? '').includes(q))
    }

    rows.sort((a, b) => new Date(b.thoi_diem_xac_nhan || b.checkin_time).getTime() - new Date(a.thoi_diem_xac_nhan || a.checkin_time).getTime())

    return ok(res, rows)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
