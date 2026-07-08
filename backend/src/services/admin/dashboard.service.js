import { BacSi, HoaDon, LichHen, ThanhToan } from '../../models/index.js'

function startOfToday(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfTomorrow(date = new Date()) {
  const today = startOfToday(date)
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
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

export async function getAdminDashboardSummary(now = new Date()) {
  const todayStart = startOfToday(now)
  const tomorrowStart = startOfTomorrow(now)

  const [
    appointmentsToday,
    doctorsActive,
    invoicedRevenue,
    collectedRevenue,
  ] = await Promise.all([
    LichHen.countDocuments({
      ngay_kham: {
        $gte: todayStart,
        $lt: tomorrowStart,
      },
    }),
    BacSi.countDocuments({ trang_thai: 'active' }),
    sumField(HoaDon, 'tong_thanh_toan'),
    sumField(ThanhToan, 'so_tien', { status: 'paid' }),
  ])

  return {
    appointments_today: appointmentsToday,
    doctors_active: doctorsActive,
    revenue: {
      invoiced_total: invoicedRevenue,
      collected_total: collectedRevenue,
      outstanding_total: Math.max(invoicedRevenue - collectedRevenue, 0),
    },
    generated_at: now.toISOString(),
  }
}
