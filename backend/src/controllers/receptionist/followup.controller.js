import { LichHen, KetQuaKham, BacSi, HangDoi } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// GET /api/receptionist/followup
export async function getAllFollowUps(req, res) {
  try {
    const { specialty_id, tu_ngay, den_ngay, search } = req.query

    // Đầu tiên tìm các KetQuaKham có chi_dinh_tai_kham = true và da_dat_lich_tai_kham = false
    const matchKetQua = {
      chi_dinh_tai_kham: true,
      da_dat_lich_tai_kham: false
    }

    if (tu_ngay || den_ngay) {
      matchKetQua.ngay_tai_kham = {}
      if (tu_ngay) matchKetQua.ngay_tai_kham.$gte = new Date(tu_ngay)
      if (den_ngay) matchKetQua.ngay_tai_kham.$lte = new Date(den_ngay)
    }

    const ketQuas = await KetQuaKham.find(matchKetQua)
      .select('appointment_id hang_doi_id chan_doan ngay_tai_kham')
      .lean()

    if (!ketQuas.length) {
      return ok(res, { data: [], total: 0 })
    }

    const appointmentIds = ketQuas.map(k => k.appointment_id).filter(Boolean)
    const hangDoiIds = ketQuas.map(k => k.hang_doi_id).filter(Boolean)

    // Lọc tiếp qua LichHen (Online)
    const matchLichHen = {
      _id: { $in: appointmentIds },
      status: 'completed'
    }
    if (specialty_id) matchLichHen.specialty_id = specialty_id
    
    // Lọc tiếp qua HangDoi (Offline)
    const matchHangDoi = {
      _id: { $in: hangDoiIds },
      trang_thai: 'hoan_thanh'
    }
    if (specialty_id) matchHangDoi.specialty_id = specialty_id

    let lichHens = []
    if (appointmentIds.length > 0) {
      lichHens = await LichHen.find(matchLichHen)
        .select('_id ngay_kham doctor_id specialty_id ten_khach so_dien_thoai_khach')
        .lean()
    }
    
    let hangDois = []
    if (hangDoiIds.length > 0) {
      hangDois = await HangDoi.find(matchHangDoi)
        .select('_id checkin_time doctor_id specialty_id ten_benh_nhan so_dien_thoai')
        .lean()
    }
    
    // Áp dụng filter search (tên khách / số điện thoại)
    if (search) {
      const s = search.toLowerCase()
      lichHens = lichHens.filter(l => 
        (l.ten_khach && l.ten_khach.toLowerCase().includes(s)) ||
        (l.so_dien_thoai_khach && l.so_dien_thoai_khach.includes(s))
      )
      hangDois = hangDois.filter(h => 
        (h.ten_benh_nhan && h.ten_benh_nhan.toLowerCase().includes(s)) ||
        (h.so_dien_thoai && h.so_dien_thoai.includes(s))
      )
    }

    if (!lichHens.length && !hangDois.length) {
      return ok(res, { data: [], total: 0 })
    }

    // Map data
    const doctorIds = [...new Set([
      ...lichHens.map(l => l.doctor_id?.toString()),
      ...hangDois.map(h => h.doctor_id?.toString())
    ].filter(Boolean))]

    const doctors = await BacSi.find({ _id: { $in: doctorIds } })
      .populate('user_id', 'ho_ten')
      .select('_id user_id').lean()
      
    const doctorMap = doctors.reduce((acc, doc) => {
      acc[doc._id.toString()] = doc
      return acc
    }, {})

    const validAppointmentIds = new Set(lichHens.map(l => l._id.toString()))
    const validHangDoiIds = new Set(hangDois.map(h => h._id.toString()))
    
    const validKetQuas = ketQuas.filter(k => 
      (k.appointment_id && validAppointmentIds.has(k.appointment_id.toString())) ||
      (k.hang_doi_id && validHangDoiIds.has(k.hang_doi_id.toString()))
    )

    const result = validKetQuas.map(kq => {
      let doctorId, specialtyId, ngayKhamCu, tenKhach, soDienThoai;
      let lichGocId = null;
      let hangDoiId = null;

      if (kq.appointment_id && validAppointmentIds.has(kq.appointment_id.toString())) {
        const lich = lichHens.find(l => l._id.toString() === kq.appointment_id.toString())
        doctorId = lich.doctor_id;
        specialtyId = lich.specialty_id;
        ngayKhamCu = lich.ngay_kham;
        tenKhach = lich.ten_khach;
        soDienThoai = lich.so_dien_thoai_khach;
        lichGocId = lich._id;
      } else if (kq.hang_doi_id && validHangDoiIds.has(kq.hang_doi_id.toString())) {
        const hd = hangDois.find(h => h._id.toString() === kq.hang_doi_id.toString())
        doctorId = hd.doctor_id;
        specialtyId = hd.specialty_id;
        ngayKhamCu = hd.checkin_time;
        tenKhach = hd.ten_benh_nhan;
        soDienThoai = hd.so_dien_thoai;
        hangDoiId = hd._id;
      }

      const doctor = doctorMap[doctorId?.toString()]
      
      return {
        lich_hen_goc_id: lichGocId,
        hang_doi_id: hangDoiId, // thêm hang_doi_id nếu cần map lại
        ten_khach: tenKhach,
        so_dien_thoai: soDienThoai,
        bac_si: doctor ? doctor.user_id?.ho_ten : 'Không rõ',
        chuyen_khoa_id: specialtyId,
        chan_doan: kq.chan_doan,
        ngay_kham_cu: ngayKhamCu,
        ngay_tai_kham: kq.ngay_tai_kham || null
      }
    })

    result.sort((a, b) => {
      if (a.ngay_tai_kham && b.ngay_tai_kham) {
        return new Date(a.ngay_tai_kham) - new Date(b.ngay_tai_kham)
      }
      if (a.ngay_tai_kham) return -1
      if (b.ngay_tai_kham) return 1
      return new Date(b.ngay_kham_cu) - new Date(a.ngay_kham_cu)
    })

    return ok(res, { data: result, total: result.length })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
