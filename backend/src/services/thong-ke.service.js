import {
  HoaDon,
  LichHen,
  NguoiDung,
  ThanhToan,
} from '../models/index.js'

const CLINIC_TIMEZONE = 'Asia/Ho_Chi_Minh'

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
        ten_bac_si: 1,
        doanh_thu: 1,
        so_luot_kham: { $size: '$_appointments' },
      },
    },
  ])
}

export async function getBenhNhanMoiTheoThang(yearRange) {
  return NguoiDung.aggregate([
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
}

export async function getDichVuPhoBien(range = {}) {
  return HoaDon.aggregate([
    { $match: dateRangeMatch('created_at', range) },
    { $unwind: '$chi_tiet_thu_phi' },
    {
      $match: {
        'chi_tiet_thu_phi.loai': { $ne: 'giam_tru_bao_hiem' },
        'chi_tiet_thu_phi.ten': { $type: 'string', $ne: '' },
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
