import mongoose from 'mongoose'
import {
  ChuyenKhoa,
  DichVu,
  HoaDon,
  LichHen,
  NguoiDung,
  ThanhToan,
  DanhGia,
} from '../models/index.js'

const CLINIC_TIMEZONE = 'Asia/Ho_Chi_Minh'
const ENT_SPECIALTY_SLUG = 'tai-mui-hong'
const ENT_SERVICE_NAME_PATTERN = /(tai\s*mũi\s*họng|tai\s*mui\s*hong|tmh|mũi|mui|họng|hong|tai)/i

function dateRangeMatch(field, range = {}) {
  const conditions = {}
  if (range.start) conditions.$gte = range.start
  if (range.end) conditions.$lt = range.end
  return Object.keys(conditions).length ? { [field]: conditions } : {}
}

function dateLabel(field, format = '%Y-%m-%d') {
  return {
    $dateToString: {
      date: field,
      format,
      timezone: CLINIC_TIMEZONE,
    },
  }
}

export async function getDoanhThuTheoNgay(range = {}) {
  return ThanhToan.aggregate([
    { $match: { status: 'paid' } },
    {
      $set: {
        _stat_date: {
          $ifNull: ['$ngay_thanh_toan', { $ifNull: ['$thoi_diem_thanh_toan', '$ngay_tao'] }],
        },
      },
    },
    { $match: dateRangeMatch('_stat_date', range) },
    {
      $project: {
        ngay: dateLabel('$_stat_date'),
        da_thu: { $ifNull: ['$so_tien', 0] },
        da_xuat_hoa_don: { $literal: 0 },
      },
    },
    {
      $unionWith: {
        coll: HoaDon.collection.name,
        pipeline: [
          { $set: { _stat_date: '$created_at' } },
          { $match: dateRangeMatch('_stat_date', range) },
          {
            $project: {
              ngay: dateLabel('$_stat_date'),
              da_thu: { $literal: 0 },
              da_xuat_hoa_don: { $ifNull: ['$tong_thanh_toan', 0] },
            },
          },
        ],
      },
    },
    {
      $group: {
        _id: '$ngay',
        da_thu: { $sum: '$da_thu' },
        da_xuat_hoa_don: { $sum: '$da_xuat_hoa_don' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        ngay: '$_id',
        da_thu: 1,
        da_xuat_hoa_don: 1,
      },
    },
  ])
}

export async function getLichHenTheoTrangThai(range = {}) {
  return LichHen.aggregate([
    { $match: dateRangeMatch('ngay_kham', range) },
    {
      $set: {
        _status_group: {
          $switch: {
            branches: [
              { case: { $eq: ['$status', 'pending'] }, then: 'cho_xac_nhan' },
              {
                case: {
                  $in: [
                    '$status',
                    ['confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm'],
                  ],
                },
                then: 'da_xac_nhan',
              },
              { case: { $eq: ['$status', 'completed'] }, then: 'hoan_thanh' },
              {
                case: { $in: ['$status', ['cancelled', 'no_show', 'skipped']] },
                then: 'huy',
              },
            ],
            default: null,
          },
        },
      },
    },
    { $match: { _status_group: { $ne: null } } },
    { $group: { _id: '$_status_group', so_luong: { $sum: 1 } } },
    { $sort: { so_luong: -1, _id: 1 } },
    { $project: { _id: 0, trang_thai: '$_id', so_luong: 1 } },
  ])
}

export async function getDoanhThuTheoBacSi(range = {}) {
  return ThanhToan.aggregate([
    { $match: { status: 'paid' } },
    {
      $set: {
        _stat_date: {
          $ifNull: ['$ngay_thanh_toan', { $ifNull: ['$thoi_diem_thanh_toan', '$ngay_tao'] }],
        },
      },
    },
    { $match: dateRangeMatch('_stat_date', range) },
    {
      $lookup: {
        from: HoaDon.collection.name,
        localField: 'hoa_don_id',
        foreignField: '_id',
        as: '_invoice',
      },
    },
    {
      $set: {
        _appointment_id: {
          $ifNull: ['$appointment_id', { $arrayElemAt: ['$_invoice.appointment_id', 0] }],
        },
      },
    },
    {
      $lookup: {
        from: LichHen.collection.name,
        localField: '_appointment_id',
        foreignField: '_id',
        as: '_appointment',
      },
    },
    { $unwind: '$_appointment' },
    {
      $lookup: {
        from: 'bac_si',
        localField: '_appointment.doctor_id',
        foreignField: '_id',
        as: '_doctor',
      },
    },
    { $unwind: '$_doctor' },
    { $match: { '_doctor.trang_thai_duyet': { $ne: 'suspended' } } },
    {
      $lookup: {
        from: NguoiDung.collection.name,
        localField: '_doctor.user_id',
        foreignField: '_id',
        as: '_doctor_user',
      },
    },
    {
      $group: {
        _id: '$_doctor._id',
        ten_bac_si: { $first: { $ifNull: [{ $arrayElemAt: ['$_doctor_user.ho_ten', 0] }, 'Bác sĩ chưa xác định'] } },
        doanh_thu: { $sum: { $ifNull: ['$so_tien', 0] } },
        _appointments: { $addToSet: '$_appointment_id' },
      },
    },
    { $sort: { doanh_thu: -1, ten_bac_si: 1 } },
    { $limit: 8 },
    {
      $project: {
        _id: 0,
        bac_si_id: '$_id',
        ten_bac_si: 1,
        doanh_thu: 1,
        so_luot_kham: { $size: '$_appointments' },
      },
    },
  ])
}

export async function getBenhNhanMoiTheoThang(yearRange) {
  const rows = await NguoiDung.aggregate([
    {
      $match: {
        role: { $in: ['user', 'patient'] },
        ngay_tao: { $gte: yearRange.start, $lt: yearRange.end },
      },
    },
    { $group: { _id: dateLabel('$ngay_tao', '%m'), so_luong: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, thang: { $toInt: '$_id' }, so_luong: 1 } },
  ])

  const countByMonth = new Map(rows.map((item) => [item.thang, item.so_luong]))

  const appointments = await LichHen.aggregate([
    {
      $match: {
        ngay_kham: { $gte: yearRange.start, $lt: yearRange.end },
        status: { $nin: ['cancelled', 'no_show', 'skipped'] },
        user_id: { $ne: null }
      }
    },
    {
      $lookup: {
        from: NguoiDung.collection.name,
        localField: 'user_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: {
          thang: dateLabel('$ngay_kham', '%m'),
          user_id: '$user_id',
          ngay_tao: '$user.ngay_tao'
        }
      }
    }
  ])

  const countOldByMonth = new Map()
  for (const item of appointments) {
    const monthStr = item._id.thang
    if (!monthStr) continue
    const month = parseInt(monthStr, 10)
    
    const year = yearRange.start.getFullYear()
    const startOfMonth = new Date(`${year}-${monthStr}-01T00:00:00+07:00`)
    
    if (item._id.ngay_tao && item._id.ngay_tao < startOfMonth) {
      countOldByMonth.set(month, (countOldByMonth.get(month) ?? 0) + 1)
    }
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    return {
      thang: month,
      label: `T${month}`,
      so_luong: countByMonth.get(month) ?? 0,
      so_luong_cu: countOldByMonth.get(month) ?? 0,
    }
  })
}

function formatClinicDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

export async function getBenhNhanMoiTheoTuanTrongThang(monthRange) {
  const rows = await NguoiDung.aggregate([
    {
      $match: {
        role: { $in: ['user', 'patient'] },
        ngay_tao: { $gte: monthRange.start, $lt: monthRange.end },
      },
    },
    {
      $set: {
        _week: {
          $ceil: {
            $divide: [
              {
                $dayOfMonth: {
                  date: '$ngay_tao',
                  timezone: CLINIC_TIMEZONE,
                },
              },
              7,
            ],
          },
        },
      },
    },
    { $group: { _id: '$_week', so_luong: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, tuan: '$_id', so_luong: 1 } },
  ])

  const countByWeek = new Map(rows.map((item) => [item.tuan, item.so_luong]))

  const appointments = await LichHen.aggregate([
    {
      $match: {
        ngay_kham: { $gte: monthRange.start, $lt: monthRange.end },
        status: { $nin: ['cancelled', 'no_show', 'skipped'] },
        user_id: { $ne: null }
      }
    },
    {
      $set: {
        _week: {
          $ceil: { $divide: [{ $dayOfMonth: { date: '$ngay_kham', timezone: CLINIC_TIMEZONE } }, 7] }
        }
      }
    },
    {
      $lookup: {
        from: NguoiDung.collection.name,
        localField: 'user_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: {
          tuan: '$_week',
          user_id: '$user_id',
          ngay_tao: '$user.ngay_tao'
        }
      }
    }
  ])

  const countOldByWeek = new Map()
  for (const item of appointments) {
    const week = item._id.tuan
    if (!week) continue
    
    const startDay = (week - 1) * 7 + 1
    const year = monthRange.start.getFullYear()
    const month = String(monthRange.start.getMonth() + 1).padStart(2, '0')
    const startOfWeek = new Date(`${year}-${month}-${String(startDay).padStart(2, '0')}T00:00:00+07:00`)
    
    if (item._id.ngay_tao && item._id.ngay_tao < startOfWeek) {
      countOldByWeek.set(week, (countOldByWeek.get(week) ?? 0) + 1)
    }
  }

  const lastDay = new Date(monthRange.end.getTime() - 1)
  const daysInMonth = Number(formatClinicDate(lastDay).slice(8, 10))
  const weekCount = Math.ceil(daysInMonth / 7)

  return Array.from({ length: weekCount }, (_, index) => {
    const week = index + 1
    const fromDay = (week - 1) * 7 + 1
    const toDay = Math.min(week * 7, daysInMonth)

    return {
      tuan: week,
      label: `Tuần ${week}`,
      tu: fromDay,
      den: toDay,
      so_luong: countByWeek.get(week) ?? 0,
      so_luong_cu: countOldByWeek.get(week) ?? 0,
    }
  })
}

export async function getDichVuPhoBien(range = {}) {
  return HoaDon.aggregate([
    { $match: dateRangeMatch('created_at', range) },
    { $unwind: '$chi_tiet_thu_phi' },
    {
      $match: {
        'chi_tiet_thu_phi.loai': { $in: ['dich_vu', 'thu_thuat'] },
        'chi_tiet_thu_phi.ten': { $type: 'string', $ne: '' },
      },
    },
    {
      $lookup: {
        from: DichVu.collection.name,
        localField: 'chi_tiet_thu_phi.service_id',
        foreignField: '_id',
        as: '_service',
      },
    },
    { $unwind: { path: '$_service', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: ChuyenKhoa.collection.name,
        localField: '_service.specialty_id',
        foreignField: '_id',
        as: '_specialty',
      },
    },
    { $unwind: { path: '$_specialty', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [
          { '_specialty.slug': ENT_SPECIALTY_SLUG },
          {
            'chi_tiet_thu_phi.service_id': null,
            'chi_tiet_thu_phi.ten': ENT_SERVICE_NAME_PATTERN,
          },
        ],
      },
    },
    {
      $group: {
        _id: '$chi_tiet_thu_phi.ten',
        so_luot_dung: { $sum: { $ifNull: ['$chi_tiet_thu_phi.so_luong', 1] } },
        doanh_thu: { $sum: { $ifNull: ['$chi_tiet_thu_phi.thanh_tien', 0] } },
      },
    },
    { $sort: { so_luot_dung: -1, doanh_thu: -1, _id: 1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        ten_dich_vu: '$_id',
        so_luot_dung: 1,
        doanh_thu: 1,
      },
    },
  ])
}

export async function getBenhNhanMoiTheoNam(range = {}) {
  const rows = await NguoiDung.aggregate([
    {
      $match: {
        role: { $in: ['user', 'patient'] },
        ...dateRangeMatch('ngay_tao', range),
      },
    },
    { $group: { _id: dateLabel('$ngay_tao', '%Y'), so_luong: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, nam: { $toInt: '$_id' }, so_luong: 1 } },
  ])

  const countByYear = new Map(rows.map((item) => [item.nam, item.so_luong]))

  const appointments = await LichHen.aggregate([
    {
      $match: {
        status: { $nin: ['cancelled', 'no_show', 'skipped'] },
        user_id: { $ne: null },
        ...dateRangeMatch('ngay_kham', range),
      }
    },
    {
      $lookup: {
        from: NguoiDung.collection.name,
        localField: 'user_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: {
          nam: dateLabel('$ngay_kham', '%Y'),
          user_id: '$user_id',
          ngay_tao: '$user.ngay_tao'
        }
      }
    }
  ])

  const countOldByYear = new Map()
  for (const item of appointments) {
    const yearStr = item._id.nam
    if (!yearStr) continue
    const year = parseInt(yearStr, 10)
    
    const startOfYear = new Date(`${yearStr}-01-01T00:00:00+07:00`)
    
    if (item._id.ngay_tao && item._id.ngay_tao < startOfYear) {
      countOldByYear.set(year, (countOldByYear.get(year) ?? 0) + 1)
    }
  }

  const allYears = Array.from(new Set([...countByYear.keys(), ...countOldByYear.keys()])).sort((a, b) => a - b)
  if (allYears.length === 0) {
    const currentYear = new Date().getFullYear()
    return [{ nam: currentYear, label: String(currentYear), so_luong: 0, so_luong_cu: 0 }]
  }

  const minYear = allYears[0]
  const maxYear = allYears[allYears.length - 1]

  return Array.from({ length: maxYear - minYear + 1 }, (_, index) => {
    const year = minYear + index
    return {
      nam: year,
      label: String(year),
      so_luong: countByYear.get(year) ?? 0,
      so_luong_cu: countOldByYear.get(year) ?? 0,
    }
  })
}

export async function getChiTietDoanhThuBacSi(doctorId, range = {}) {
  const doctorObjectId = new mongoose.Types.ObjectId(doctorId)
  
  // 1. Doanh thu theo thời gian của bác sĩ này
  const revenueData = await ThanhToan.aggregate([
    { $match: { status: 'paid' } },
    {
      $set: {
        _stat_date: {
          $ifNull: ['$ngay_thanh_toan', { $ifNull: ['$thoi_diem_thanh_toan', '$ngay_tao'] }],
        },
      },
    },
    { $match: dateRangeMatch('_stat_date', range) },
    {
      $lookup: {
        from: HoaDon.collection.name,
        localField: 'hoa_don_id',
        foreignField: '_id',
        as: '_invoice',
      },
    },
    {
      $set: {
        _appointment_id: {
          $ifNull: ['$appointment_id', { $arrayElemAt: ['$_invoice.appointment_id', 0] }],
        },
      },
    },
    {
      $lookup: {
        from: LichHen.collection.name,
        localField: '_appointment_id',
        foreignField: '_id',
        as: '_appointment',
      },
    },
    { $unwind: '$_appointment' },
    { $match: { '_appointment.doctor_id': doctorObjectId } },
    {
      $group: {
        _id: dateLabel('$_stat_date'),
        doanh_thu: { $sum: { $ifNull: ['$so_tien', 0] } },
        so_luot_kham: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        ngay: '$_id',
        doanh_thu: 1,
        so_luot_kham: 1,
      },
    },
  ])

  // 2. Tính số lượng bệnh nhân mới / bệnh nhân cũ
  const patientsInRange = await LichHen.aggregate([
    { 
      $match: { 
        doctor_id: doctorObjectId, 
        status: { $nin: ['cancelled', 'no_show', 'skipped'] },
        user_id: { $ne: null },
        ...dateRangeMatch('ngay_kham', range)
      } 
    },
    {
      $group: {
        _id: '$user_id',
      }
    }
  ])

  let newPatientsCount = 0
  let oldPatientsCount = 0

  if (patientsInRange.length > 0) {
    const patientIds = patientsInRange.map(p => p._id)
    
    if (range.start) {
      const pastAppointments = await LichHen.aggregate([
        {
          $match: {
            doctor_id: doctorObjectId,
            status: { $nin: ['cancelled', 'no_show', 'skipped'] },
            user_id: { $in: patientIds, $ne: null },
            ngay_kham: { $lt: range.start }
          }
        },
        {
          $group: {
            _id: '$user_id'
          }
        }
      ])

      const pastPatientIds = new Set(pastAppointments.filter(p => p._id).map(p => p._id.toString()))
      
      patientIds.filter(id => id).forEach(id => {
        if (pastPatientIds.has(id.toString())) {
          oldPatientsCount++
        } else {
          newPatientsCount++
        }
      })
    } else {
      newPatientsCount = patientIds.length
    }
  }

  // 3. Top dịch vụ phổ biến của bác sĩ này
  const topServices = await ThanhToan.aggregate([
    { $match: { status: 'paid' } },
    {
      $set: {
        _stat_date: {
          $ifNull: ['$ngay_thanh_toan', { $ifNull: ['$thoi_diem_thanh_toan', '$ngay_tao'] }],
        },
      },
    },
    { $match: dateRangeMatch('_stat_date', range) },
    {
      $lookup: {
        from: HoaDon.collection.name,
        localField: 'hoa_don_id',
        foreignField: '_id',
        as: '_invoice',
      },
    },
    {
      $set: {
        _appointment_id: {
          $ifNull: ['$appointment_id', { $arrayElemAt: ['$_invoice.appointment_id', 0] }],
        },
      },
    },
    {
      $lookup: {
        from: LichHen.collection.name,
        localField: '_appointment_id',
        foreignField: '_id',
        as: '_appointment',
      },
    },
    { $unwind: '$_appointment' },
    { $match: { '_appointment.doctor_id': doctorObjectId } },
    { $unwind: '$_invoice' },
    { $unwind: '$_invoice.chi_tiet_thu_phi' },
    {
      $match: {
        '_invoice.chi_tiet_thu_phi.loai': { $in: ['dich_vu', 'thu_thuat', 'phi_kham'] },
        '_invoice.chi_tiet_thu_phi.ten': { $type: 'string', $ne: '' },
      }
    },
    {
      $group: {
        _id: '$_invoice.chi_tiet_thu_phi.ten',
        so_luot_dung: { $sum: { $ifNull: ['$_invoice.chi_tiet_thu_phi.so_luong', 1] } },
        doanh_thu: { $sum: { $ifNull: ['$_invoice.chi_tiet_thu_phi.thanh_tien', 0] } },
      },
    },
    { $sort: { so_luot_dung: -1, doanh_thu: -1, _id: 1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        ten_dich_vu: '$_id',
        so_luot_dung: 1,
        doanh_thu: 1,
      },
    },
  ])

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.doanh_thu, 0)
  const totalAppointments = revenueData.reduce((sum, item) => sum + item.so_luot_kham, 0)

  // 4. Lấy thông tin bác sĩ và rating tổng thể
  const BacSiModel = mongoose.model('BacSi')
  const bacSiRecord = await BacSiModel.findById(doctorObjectId)
  let ten_bac_si = 'Bác sĩ chưa xác định'
  
  if (bacSiRecord && bacSiRecord.user_id) {
    const userRecord = await NguoiDung.findById(bacSiRecord.user_id)
    if (userRecord) {
      ten_bac_si = userRecord.ho_ten
    }
  }

  const rating = bacSiRecord ? {
    trung_binh: Math.round((bacSiRecord.diem_danh_gia || 0) * 10) / 10,
    so_luong: bacSiRecord.tong_danh_gia || 0
  } : { trung_binh: 0, so_luong: 0 }

  return {
    ten_bac_si,
    chartData: revenueData,
    topServices,
    rating,
    summary: {
      doanh_thu: totalRevenue,
      so_luot_kham: totalAppointments,
      benh_nhan_moi: newPatientsCount,
      benh_nhan_cu: oldPatientsCount,
      tong_benh_nhan: newPatientsCount + oldPatientsCount
    }
  }
}
