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
    .populate('doctor_id', 'ho_ten')
    .select('ten_khach user_id member_id ho_so_benh_nhan_id ngay_kham gio_kham doctor_id status loai_kham')
    .lean(),
    // Đánh giá tệ
    DanhGia.find({
      so_sao: { $lte: 3 },
      status: 'visible'
    })
    .sort({ ngay_tao: -1 })
    .limit(5)
    .populate('doctor_id', 'ho_ten')
    .populate('user_id', 'ho_ten')
    .select('so_sao noi_dung doctor_id user_id ngay_tao appointment_id')
    .lean()
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
