import cron from 'node-cron'
import { generateRollingWindowForAllDoctors } from '../services/scheduleGenerator.service.js'
import { autoCancelExpiredHomeAppointments } from '../services/appointmentAutoCancel.service.js'

// ============================================================
// CRON JOBS — B2 + B3
// ============================================================

export function startCronJobs() {
  // 23:55 hàng ngày — sinh slot ngày T+7 cho tất cả bác sĩ đã duyệt (B2 doc mục 2.3)
  cron.schedule('55 23 * * *', async () => {
    try {
      const result = await generateRollingWindowForAllDoctors()
      console.log('[cron] Sinh lịch T+7:', result)
    } catch (err) {
      console.error('[cron] Lỗi sinh lịch T+7:', err.message)
    }
  })

  // Mỗi 15 phút — auto-cancel lịch home confirmed+unpaid quá payment_deadline (B3 doc mục 7)
  cron.schedule('*/15 * * * *', async () => {
    try {
      const count = await autoCancelExpiredHomeAppointments()
      if (count > 0) console.log(`[cron] Đã tự động hủy ${count} lịch home quá hạn thanh toán`)
    } catch (err) {
      console.error('[cron] Lỗi auto-cancel home:', err.message)
    }
  })

  console.log('✅ Đã khởi động cron jobs (sinh lịch 23:55, auto-cancel mỗi 15 phút)')
}
