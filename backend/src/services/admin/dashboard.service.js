import { BacSi, HoaDon, LichHen, ThanhToan, DanhGia, NguoiDung } from '../../models/index.js'

const ACTIVE_OPERATIONAL_STATUSES = ['pending', 'confirmed', 'checked_in', 'in_progress']
const CLINIC_TIME_OFFSET_MS = 7 * 60 * 60 * 1000

function startOfToday(date = new Date()) {
  const shiftedDate = new Date(date.getTime() + CLINIC_TIME_OFFSET_MS)
  shiftedDate.setUTCHours(0, 0, 0, 0)
  return new Date(shiftedDate.getTime() - CLINIC_TIME_OFFSET_MS)
}

function startOfTomorrow(date = new Date()) {
  const today = startOfToday(date)
  return new Date(today.getTime() + (24 * 60 * 60 * 1000))
}

function getMonthBounds(date = new Date()) {
  const start = new Date(date.getTime() + CLINIC_TIME_OFFSET_MS)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(1)
  
  const end = new Date(start.getTime())
  end.setUTCMonth(end.getUTCMonth() + 1)
  
  return { 
    start: new Date(start.getTime() - CLINIC_TIME_OFFSET_MS), 
    end: new Date(end.getTime() - CLINIC_TIME_OFFSET_MS) 
  }
}

function getLastMonthBounds(date = new Date()) {
  const start = new Date(date.getTime() + CLINIC_TIME_OFFSET_MS)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(1)
  start.setUTCMonth(start.getUTCMonth() - 1)
  
  const end = new Date(start.getTime())
  end.setUTCMonth(end.getUTCMonth() + 1)
  
  return { 
    start: new Date(start.getTime() - CLINIC_TIME_OFFSET_MS), 
    end: new Date(end.getTime() - CLINIC_TIME_OFFSET_MS) 
  }
}

async function sumField(model, field, match = {}) {
  const [row] = await model.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: `$${field}` },
      },
    },
  ])

  return row?.total ?? 0
}

function calcGrowth(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export async function getAdminDashboardSummary(now = new Date()) {
  const todayStart = startOfToday(now)
  const tomorrowStart = startOfTomorrow(now)
  const yesterdayStart = new Date(todayStart.getTime() - (24 * 60 * 60 * 1000))

  const thisMonth = getMonthBounds(now)
  const lastMonth = getLastMonthBounds(now)

  const [
    appointmentsToday,
    appointmentsYesterday,
    doctorsActive,
    invoicedRevenue,
    collectedRevenue,
    collectedThisMonth,
    collectedLastMonth,
    upcomingAppointments,
    recentBadReviews
  ] = await Promise.all([
    LichHen.countDocuments({
      ngay_kham: {
        $gte: todayStart,
        $lt: tomorrowStart,
      },
      status: { $in: ACTIVE_OPERATIONAL_STATUSES },
    }),
    LichHen.countDocuments({
      ngay_kham: {
        $gte: yesterdayStart,
        $lt: todayStart,
      },
      status: { $in: ACTIVE_OPERATIONAL_STATUSES },
    }),
    BacSi.countDocuments({ trang_thai: 'active', la_hien: true, trang_thai_duyet: 'approved' }),
    sumField(HoaDon, 'tong_thanh_toan'),
    sumField(ThanhToan, 'so_tien', { status: 'paid' }),
    sumField(ThanhToan, 'so_tien', { 
      status: 'paid', 
      ngay_tao: { $gte: thisMonth.start, $lt: thisMonth.end } 
    }),
    sumField(ThanhToan, 'so_tien', { 
      status: 'paid', 
      ngay_tao: { $gte: lastMonth.start, $lt: lastMonth.end } 
    }),
    // Lịch hẹn sắp diễn ra
    LichHen.find({
      ngay_kham: {
        $gte: todayStart,
        $lt: tomorrowStart
      },
      status: { $in: ['pending', 'confirmed', 'checked_in'] }
    })
    .sort({ ngay_kham: 1, gio_kham: 1 })
    .limit(5)
    .populate({
      path: 'doctor_id',
      select: 'user_id',
      populate: { path: 'user_id', select: 'ho_ten' }
    })
    .select('ten_khach user_id member_id ho_so_benh_nhan_id ngay_kham gio_kham doctor_id status loai_kham')
    .lean()
    .then(items => items.map(item => ({
      ...item,
      doctor_id: item.doctor_id ? {
        _id: item.doctor_id._id,
        ho_ten: item.doctor_id.user_id?.ho_ten || 'Trống'
      } : null
    }))),
    // Đánh giá tệ
    DanhGia.find({
      so_sao: { $lte: 3 },
      status: 'visible'
    })
    .sort({ ngay_tao: -1 })
    .limit(5)
    .populate({
      path: 'doctor_id',
      select: 'user_id',
      populate: { path: 'user_id', select: 'ho_ten' }
    })
    .populate('user_id', 'ho_ten')
    .select('so_sao noi_dung doctor_id user_id ngay_tao appointment_id')
    .lean()
    .then(items => items.map(item => ({
      ...item,
      doctor_id: item.doctor_id ? {
        _id: item.doctor_id._id,
        ho_ten: item.doctor_id.user_id?.ho_ten || 'Trống'
      } : null
    })))
  ])

  return {
    appointments_today: {
      value: appointmentsToday,
      growth: calcGrowth(appointmentsToday, appointmentsYesterday)
    },
    doctors_active: {
      value: doctorsActive,
      growth: 0
    },
    revenue: {
      invoiced_total: invoicedRevenue,
      collected_total: collectedRevenue,
      outstanding_total: Math.max(invoicedRevenue - collectedRevenue, 0),
      growth: calcGrowth(collectedThisMonth, collectedLastMonth)
    },
    upcoming_appointments: upcomingAppointments,
    recent_bad_reviews: recentBadReviews,
    generated_at: now.toISOString(),
  }
}

export async function getChiTietDoanhThu(now = new Date()) {
  const thisMonth = getMonthBounds(now)
  const lastMonth = getLastMonthBounds(now)

  // Gom doanh thu theo tháng (tất cả lịch sử)
  const monthlyRevenue = await ThanhToan.aggregate([
    { $match: { status: 'paid' } },
    {
      $group: {
        _id: {
          year: { $year: { date: '$ngay_tao', timezone: 'Asia/Ho_Chi_Minh' } },
          month: { $month: { date: '$ngay_tao', timezone: 'Asia/Ho_Chi_Minh' } }
        },
        total: { $sum: '$so_tien' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ])

  // Gom doanh thu theo năm
  const yearlyRevenue = await ThanhToan.aggregate([
    { $match: { status: 'paid' } },
    {
      $group: {
        _id: {
          year: { $year: { date: '$ngay_tao', timezone: 'Asia/Ho_Chi_Minh' } }
        },
        total: { $sum: '$so_tien' }
      }
    },
    { $sort: { '_id.year': 1 } }
  ])

  // Chuyển đổi dữ liệu
  const currentYear = now.getFullYear()
  
  // Mảng 12 tháng của năm nay
  const thisYearMonthly = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const found = monthlyRevenue.find(x => x._id.year === currentYear && x._id.month === m)
    return {
      month: m,
      year: currentYear,
      total: found?.total || 0
    }
  })

  // Mảng các năm
  const yearly = yearlyRevenue.map(x => ({
    year: x._id.year,
    total: x.total
  }))

  const [collectedThisMonth, collectedLastMonth, collectedTotal] = await Promise.all([
    sumField(ThanhToan, 'so_tien', { status: 'paid', ngay_tao: { $gte: thisMonth.start, $lt: thisMonth.end } }),
    sumField(ThanhToan, 'so_tien', { status: 'paid', ngay_tao: { $gte: lastMonth.start, $lt: lastMonth.end } }),
    sumField(ThanhToan, 'so_tien', { status: 'paid' })
  ])

  return {
    collectedThisMonth,
    collectedLastMonth,
    collectedTotal,
    growth: calcGrowth(collectedThisMonth, collectedLastMonth),
    diff: collectedThisMonth - collectedLastMonth,
    thisYearMonthly,
    yearly
  }
}

export async function getChiTietDoanhThuXuatHoaDon(now = new Date()) {
  const thisMonth = getMonthBounds(now)
  const lastMonth = getLastMonthBounds(now)

  // HoaDon schema thực tế không có trường trạng thái hủy (huy),
  // nên baseMatch sẽ lấy tất cả hóa đơn hợp lệ hiện có.
  const baseMatch = {} 

  // Gom doanh thu xuất hóa đơn theo tháng (tất cả lịch sử)
  const monthlyRevenue = await HoaDon.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: {
          year: { $year: { date: '$created_at', timezone: 'Asia/Ho_Chi_Minh' } },
          month: { $month: { date: '$created_at', timezone: 'Asia/Ho_Chi_Minh' } }
        },
        total: { $sum: '$tong_thanh_toan' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ])

  // Gom doanh thu xuất hóa đơn theo năm
  const yearlyRevenue = await HoaDon.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: {
          year: { $year: { date: '$created_at', timezone: 'Asia/Ho_Chi_Minh' } }
        },
        total: { $sum: '$tong_thanh_toan' }
      }
    },
    { $sort: { '_id.year': 1 } }
  ])

  // Chuyển đổi dữ liệu
  const currentYear = now.getFullYear()
  
  // Mảng 12 tháng của năm nay
  const thisYearMonthly = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const found = monthlyRevenue.find(x => x._id.year === currentYear && x._id.month === m)
    return {
      thang: m,
      tongHoaDon: found?.total || 0
    }
  })

  // Mảng các năm
  const yearly = yearlyRevenue.map(x => ({
    nam: x._id.year,
    tongHoaDon: x.total
  }))

  const [invoicedThisMonth, invoicedLastMonth, invoicedTotal] = await Promise.all([
    sumField(HoaDon, 'tong_thanh_toan', { ...baseMatch, created_at: { $gte: thisMonth.start, $lt: thisMonth.end } }),
    sumField(HoaDon, 'tong_thanh_toan', { ...baseMatch, created_at: { $gte: lastMonth.start, $lt: lastMonth.end } }),
    sumField(HoaDon, 'tong_thanh_toan', baseMatch)
  ])
  
  // Tính tổng công nợ
  const [debtResult] = await HoaDon.aggregate([
    { $match: baseMatch },
    {
      $lookup: {
        from: 'thanh_toan',
        localField: '_id',
        foreignField: 'hoa_don_id',
        as: 'payments'
      }
    },
    {
      $addFields: {
        tong_da_thu: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$payments',
                  as: 'payment',
                  cond: { $eq: ['$$payment.status', 'paid'] }
                }
              },
              as: 'paid_payment',
              in: '$$paid_payment.so_tien'
            }
          }
        }
      }
    },
    {
      $project: {
        no_hoa_don: {
          $max: [0, { $subtract: ['$tong_thanh_toan', '$tong_da_thu'] }]
        }
      }
    },
    {
      $group: {
        _id: null,
        outstandingTotal: { $sum: '$no_hoa_don' }
      }
    }
  ])

  const outstandingTotal = debtResult?.outstandingTotal || 0
  const growth = invoicedLastMonth === 0 ? null : Math.round(((invoicedThisMonth - invoicedLastMonth) / invoicedLastMonth) * 100)

  return {
    invoicedThisMonth,
    invoicedLastMonth,
    invoicedTotal,
    growth,
    diff: invoicedThisMonth - invoicedLastMonth,
    outstandingTotal,
    thisYearMonthly,
    yearly
  }
}
