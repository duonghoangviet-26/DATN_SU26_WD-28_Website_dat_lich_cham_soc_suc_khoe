import { BacSi, HangDoi, KetQuaKham, HoaDon } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { startOfDayUtc } from '../../utils/clinicTime.js'

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
  const start = startOfDayUtc(value)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

// Tìm theo tên/SĐT mà không truyền khoảng ngày -> nới ra 90 ngày gần nhất thay vì chỉ hôm nay,
// nếu không ô tìm kiếm gần như vô dụng (bác sĩ thường nhớ tên bệnh nhân, không nhớ đúng ngày khám).
const SO_NGAY_TIM_KIEM_MAC_DINH = 90

function xacDinhKhoangNgay(query) {
  if (query.tu || query.den) {
    const start = startOfDayUtc(query.tu ? new Date(query.tu) : new Date())
    const denGoc = query.den ? new Date(query.den) : (query.tu ? new Date(query.tu) : new Date())
    const end = startOfDayUtc(denGoc)
    end.setUTCDate(end.getUTCDate() + 1)
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

    const entries = await HangDoi.find({
      doctor_id: docId,
      trang_thai: 'hoan_thanh',
      checkin_time: { $gte: start, $lt: end },
    })
      .select('ten_benh_nhan so_dien_thoai checkin_time thoi_diem_ket_thuc nguon ma_so_thu_tu appointment_id')
      .sort({ checkin_time: -1 })
      .limit(500)
      .lean()
    if (entries.length === 0) return ok(res, [])

    const hangDoiIds = entries.map((e) => e._id)
    const apptIds = entries.filter((e) => e.appointment_id).map((e) => e.appointment_id)

    const [results, invoices] = await Promise.all([
      KetQuaKham.find({ hang_doi_id: { $in: hangDoiIds }, status: 'da_xac_nhan' })
        .select('hang_doi_id chan_doan ket_cuc thoi_diem_xac_nhan dich_vu_phat_sinh')
        .lean(),
      HoaDon.find({ $or: [{ hang_doi_id: { $in: hangDoiIds } }, { appointment_id: { $in: apptIds } }] })
        .select('hang_doi_id appointment_id tong_thanh_toan trang_thai_hoa_don')
        .lean(),
    ])
    const kqByHangDoi = new Map(results.map((r) => [String(r.hang_doi_id), r]))
    const hoaDonByHangDoi = new Map(invoices.filter((h) => h.hang_doi_id).map((h) => [String(h.hang_doi_id), h]))
    const hoaDonByAppt = new Map(invoices.filter((h) => h.appointment_id).map((h) => [String(h.appointment_id), h]))

    let rows = entries
      // Chỉ liệt kê ca đã CHỐT hồ sơ (da_xac_nhan) — khớp đúng định nghĩa 'da_xong' của
      // trangThaiTongHop() trong appointments.controller.js, không lẫn ca hoàn thành phòng
      // khám nhưng bác sĩ chưa nhập/chưa xác nhận hồ sơ (những ca đó vẫn ở "Hồ sơ chờ khám").
      .filter((e) => kqByHangDoi.has(String(e._id)))
      .map((e) => {
        const kq = kqByHangDoi.get(String(e._id))
        const hoaDon = hoaDonByHangDoi.get(String(e._id))
          ?? (e.appointment_id ? hoaDonByAppt.get(String(e.appointment_id)) : null)
        return {
          queue_id: String(e._id),
          ten_benh_nhan: e.ten_benh_nhan,
          so_dien_thoai: e.so_dien_thoai ?? null,
          nguon: e.nguon,
          ma_so_thu_tu: e.ma_so_thu_tu ?? null,
          checkin_time: e.checkin_time,
          thoi_diem_xac_nhan: kq.thoi_diem_xac_nhan,
          chan_doan: kq.chan_doan,
          ket_cuc: kq.ket_cuc,
          so_dich_vu_phat_sinh: Array.isArray(kq.dich_vu_phat_sinh) ? kq.dich_vu_phat_sinh.length : 0,
          tong_thanh_toan: hoaDon?.tong_thanh_toan ?? null,
          trang_thai_hoa_don: hoaDon?.trang_thai_hoa_don ?? null,
        }
      })

    if (q) {
      rows = rows.filter((r) => r.ten_benh_nhan?.toLowerCase().includes(q) || (r.so_dien_thoai ?? '').includes(q))
    }

    return ok(res, rows)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
