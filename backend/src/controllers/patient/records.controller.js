import { LichHen, KetQuaKham, DonThuoc, BacSi, NguoiDung } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// A3 — Lịch sử khám & Kết quả (Bệnh nhân)
// Routes: /api/patient/records
// ============================================================

// ─── GET /api/patient/records?status=&page=&limit= ──────────────────────────
export async function listRecords(req, res) {
  try {
    const { status, page = 1, limit = 10 } = req.query
    const filter = { user_id: req.user.id }
    if (status) filter.status = status

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await LichHen.countDocuments(filter)

    const appointments = await LichHen.find(filter)
      .sort({ ngay_kham: -1, gio_kham: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    // Lấy tên bác sĩ cho từng lịch hẹn
    const doctorIds = [...new Set(appointments.map((a) => a.doctor_id.toString()))]
    const docList = await BacSi.find({ _id: { $in: doctorIds } })
      .populate('user_id', 'ho_ten anh_dai_dien')
      .select('user_id')
      .lean()
    const docMap = Object.fromEntries(docList.map((d) => [d._id.toString(), d.user_id]))

    // Lấy trạng thái đã có kết quả khám (KetQuaKham) của các lịch hẹn
    const appointmentIds = appointments.map((a) => a._id)
    const examResults = await KetQuaKham.find({ appointment_id: { $in: appointmentIds } })
      .select('appointment_id')
      .lean()
    const resultAppIds = new Set(examResults.map((r) => r.appointment_id.toString()))

    const data = appointments.map((a) => ({
      id:             a._id,
      loai_kham:      a.loai_kham,
      ngay_kham:      a.ngay_kham,
      gio_kham:       a.gio_kham,
      ten_dich_vu:    a.ten_dich_vu,
      phong_kham:     a.phong_kham,
      dia_chi_kham:   a.dia_chi_kham,
      status:         a.status,
      payment_status: a.payment_status,
      gia_kham:       a.gia_kham,
      payment_deadline: a.payment_deadline,
      ly_do_huy:      a.ly_do_huy,
      bac_si: {
        ho_ten:       docMap[a.doctor_id.toString()]?.ho_ten       ?? 'Không rõ',
        anh_dai_dien: docMap[a.doctor_id.toString()]?.anh_dai_dien ?? null,
      },
      da_co_ket_qua:  resultAppIds.has(a._id.toString()),
    }))

    return ok(res, { total, page: Number(page), limit: Number(limit), data })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/records/:id ───────────────────────────────────────────
export async function getRecord(req, res) {
  try {
    const a = await LichHen.findOne({ _id: req.params.id, user_id: req.user.id }).lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    const [doc, ketQua] = await Promise.all([
      BacSi.findById(a.doctor_id).populate('user_id', 'ho_ten anh_dai_dien so_dien_thoai').select('user_id').lean(),
      KetQuaKham.findOne({ appointment_id: a._id }).lean(),
    ])

    let prescription = null
    if (ketQua) {
      prescription = await DonThuoc.findOne({
        $or: [
          { medical_record_id: ketQua._id },
          { ket_qua_kham_id: ketQua._id }
        ]
      }).lean()
    }

    return ok(res, {
      id:             a._id,
      loai_kham:      a.loai_kham,
      ngay_kham:      a.ngay_kham,
      gio_kham:       a.gio_kham,
      ten_dich_vu:    a.ten_dich_vu,
      phong_kham:     a.phong_kham,
      dia_chi_kham:   a.dia_chi_kham,
      ly_do_kham:     a.ly_do_kham,
      status:         a.status,
      payment_status: a.payment_status,
      gia_kham:       a.gia_kham,
      payment_deadline: a.payment_deadline,
      ly_do_huy:      a.ly_do_huy,
      bac_si: {
        ho_ten:        doc?.user_id?.ho_ten       ?? 'Không rõ',
        anh_dai_dien:  doc?.user_id?.anh_dai_dien ?? null,
        so_dien_thoai: doc?.user_id?.so_dien_thoai ?? null,
      },
      ket_qua: ketQua ? {
        id:                 ketQua._id,
        chan_doan:          ketQua.chan_doan,
        huong_dan_dieu_tri: ketQua.huong_dan_dieu_tri,
        ghi_chu:            ketQua.ghi_chu,
        ngay_tai_kham:      ketQua.ngay_tai_kham,
        ngay_tao:           ketQua.ngay_tao,
        thuoc: prescription?.items ?? [],
      } : null,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
