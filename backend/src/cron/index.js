import cron from 'node-cron'
import {
  generateAutoScheduleWindowForAllDoctors,
  generateRollingWindowForAllDoctors,
} from '../services/scheduleGenerator.service.js'
import { autoCancelExpiredHomeAppointments } from '../services/appointmentAutoCancel.service.js'
import { sendWeeklyNewsArticleReminder } from '../services/newsReminder.service.js'

const CLINIC_TIMEZONE = 'Asia/Ho_Chi_Minh'

export function startCronJobs() {
  const tasks = []

  async function runScheduleAutoFill(source) {
    try {
      const result = await generateAutoScheduleWindowForAllDoctors({
        weeksAhead: 2,
        action: 'auto_generate',
        note: source === 'startup' ? 'Tự động sinh lịch làm việc khi khởi động hệ thống' : `Tự động sinh lịch làm việc từ ${source}`,
      })
      console.log(`[cron] Auto fill lich lam viec (${source}):`, result)
    } catch (err) {
      console.error(`[cron] Loi auto fill lich lam viec (${source}):`, err.message)
    }
  }

  runScheduleAutoFill('startup')

  // 00:00 every Sunday: make sure current and upcoming weeks are available.
  tasks.push(cron.schedule('0 0 * * 0', async () => {
    try {
      const result = await generateRollingWindowForAllDoctors()
      console.log('[cron] Sinh/bu lich tuan tu dong:', result)
    } catch (err) {
      console.error('[cron] Loi sinh/bu lich tuan tu dong:', err.message)
    }
  }, { timezone: CLINIC_TIMEZONE }))

  // Every 15 minutes: auto-cancel expired unpaid home appointments.
  tasks.push(cron.schedule('*/15 * * * *', async () => {
    try {
      const count = await autoCancelExpiredHomeAppointments()
      if (count > 0) {
        console.log(`[cron] Da tu dong huy ${count} lich home qua han thanh toan`)
      }
    } catch (err) {
      console.error('[cron] Loi auto-cancel home:', err.message)
    }
  }, { timezone: CLINIC_TIMEZONE }))

  // 08:00 and 20:00 every Wednesday: remind receptionists to add a new article.
  tasks.push(cron.schedule('0 8,20 * * 3', async () => {
    try {
      const result = await sendWeeklyNewsArticleReminder()
      console.log('[cron] Nhac le tan them bai viet tin tuc:', result)
    } catch (err) {
      console.error('[cron] Loi nhac le tan them bai viet tin tuc:', err.message)
    }
  }, { timezone: CLINIC_TIMEZONE }))

  console.log('Da khoi dong cron jobs (auto fill lich khi startup, sinh/bu lich 00:00 Chu nhat, auto-cancel moi 15 phut, nhac tin tuc thu 4 08:00/20:00)')

  return {
    stop() {
      for (const task of tasks) {
        try {
          task.stop()
          task.destroy?.()
        } catch {}
      }
    },
  }
}
