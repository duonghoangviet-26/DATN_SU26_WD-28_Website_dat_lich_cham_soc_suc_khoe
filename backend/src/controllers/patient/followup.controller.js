import { LichHen, KetQuaKham, BacSi, HoSoBenhNhan, HangDoi } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// GET /api/patient/followup
export async function getMyFollowUps(req, res) {
  try {
    const userId = req.user.id

    // 1. Lấy LichHen (Online)
    const lichHens = await LichHen.find({
      $or: [
        { user_id: userId },
        { nguoi_dat_ho_id: userId }
      ],
      status: 'completed'
    }).select('_id ngay_kham doctor_id specialty_id ten_khach so_dien_thoai_khach member_id').lean()
    const appointmentIds = lichHens.map(l => l._id)

    // 2. Lấy HoSoBenhNhan (Offline)
    const hoSoBenhNhans = await HoSoBenhNhan.find({
      $or: [{ tai_khoan_id: userId }, { nguoi_giam_ho_id: userId }]
    }).select('_id').lean()
    const hoSoIds = hoSoBenhNhans.map(h => h._id)

    // 3. Lấy HangDoi (Offline)
    let hangDois = []
    if (hoSoIds.length > 0) {
      hangDois = await HangDoi.find({
        ho_so_benh_nhan_id: { $in: hoSoIds },
        trang_thai: 'hoan_thanh'
      }).select('_id checkin_time doctor_id specialty_id ten_benh_nhan so_dien_thoai member_id ho_so_benh_nhan_id').lean()
    }
    const hangDoiIds = hangDois.map(h => h._id)

    if (!appointmentIds.length && !hangDoiIds.length) {
      return ok(res, [])
    }

    // 4. Lọc KetQuaKham có chi_dinh_tai_kham = true
    const ketQuas = await KetQuaKham.find({
      $or: [
        { appointment_id: { $in: appointmentIds } },
        { hang_doi_id: { $in: hangDoiIds } }
      ],
      chi_dinh_tai_kham: true,
      da_dat_lich_tai_kham: false
    }).select('appointment_id hang_doi_id chan_doan ngay_tai_kham').lean()

    if (!ketQuas.length) {
      return ok(res, [])
    }

    // 5. Map lại data
    const doctorIds = [...new Set([
      ...lichHens.map(l => l.doctor_id?.toString()),
      ...hangDois.map(h => h.doctor_id?.toString())
    ].filter(Boolean))]

    const doctors = await BacSi.find({ _id: { $in: doctorIds } })
      .populate('user_id', 'ho_ten anh_dai_dien')
      .select('_id user_id').lean()
      
    const doctorMap = doctors.reduce((acc, doc) => {
      acc[doc._id.toString()] = doc
      return acc
    }, {})

    const result = ketQuas.map(kq => {
      let doctorId, specialtyId, ngayKhamCu, tenKhach, memberId;
      let lichGocId = null;
      let hangDoiId = null;

      if (kq.appointment_id) {
        const lich = lichHens.find(l => l._id.toString() === kq.appointment_id.toString())
        if (lich) {
          doctorId = lich.doctor_id;
          specialtyId = lich.specialty_id;
          ngayKhamCu = lich.ngay_kham;
          tenKhach = lich.ten_khach;
          memberId = lich.member_id;
          lichGocId = lich._id;
        }
      } else if (kq.hang_doi_id) {
        const hd = hangDois.find(h => h._id.toString() === kq.hang_doi_id.toString())
        if (hd) {
          doctorId = hd.doctor_id;
          specialtyId = hd.specialty_id;
          ngayKhamCu = hd.checkin_time;
          tenKhach = hd.ten_benh_nhan;
          memberId = hd.member_id;
          hangDoiId = hd._id;
        }
      }

      const doctor = doctorMap[doctorId?.toString()]
      
      return {
        lich_hen_goc_id: lichGocId,
        hang_doi_id: hangDoiId,
        ngay_kham_cu: ngayKhamCu,
        chan_doan: kq.chan_doan,
        ngay_tai_kham: kq.ngay_tai_kham || null,
        specialty_id: specialtyId,
        doctor_id: doctorId,
        bac_si: doctor ? {
          id: doctor._id,
          ho_ten: doctor.user_id?.ho_ten || 'Không rõ',
          anh_dai_dien: doctor.user_id?.anh_dai_dien || null
        } : null,
        benh_nhan: {
          ten_khach: tenKhach,
          member_id: memberId
        }
      }
    })

    // 6. Sort by ngay_tai_kham asc, then by ngay_kham_cu desc
    result.sort((a, b) => {
      if (a.ngay_tai_kham && b.ngay_tai_kham) {
        return new Date(a.ngay_tai_kham) - new Date(b.ngay_tai_kham)
      }
      if (a.ngay_tai_kham) return -1
      if (b.ngay_tai_kham) return 1
      return new Date(b.ngay_kham_cu) - new Date(a.ngay_kham_cu)
    })

    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
