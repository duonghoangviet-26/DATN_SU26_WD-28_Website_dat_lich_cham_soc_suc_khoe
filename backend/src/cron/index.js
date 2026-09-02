import cron from 'node-cron'
import {
  generateAutoScheduleWindowForAllDoctors,
  generateRollingWindowForAllDoctors,
} from '../services/scheduleGenerator.service.js'
import { autoCancelExpiredHomeAppointments } from '../services/appointmentAutoCancel.service.js'
import {
  chuyenSlotOnlineQuaCutoffToanHeThong,
  nhaSlotQuaHanToanHeThong,
} from '../services/slotRelease.service.js'
import { apDungDeXuatQuaHan } from '../services/appointmentReschedule.service.js'
import { BAT_QUET_NO_SHOW, quetNoShowHetCa, SO_NGAY_QUET_NO_SHOW_MAC_DINH } from '../services/noShowSweep.service.js'

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

  // Moi 5 phut: huy lich qua han thanh toan (di TU PHIA LICH HEN) + nha slot ket
  // (di TU PHIA SLOT). Hai chieu bo sung cho nhau:
  //   - autoCancel...: co LichHen qua han -> huy lich + nha slot cua no.
  //   - nhaSlotQuaHan...: slot ket ma KHONG con LichHen nao tro toi -> chieu kia khong voi toi.
  // Ha 15' -> 5' vi cutoff dong dat online la T-30': cron cham 15' an mat nua cua so ban lai
  // (rule §11). Day chi la LUOI AN TOAN — duong chinh la quet lazy luc doc lich.
  tasks.push(cron.schedule('*/5 * * * *', async () => {
    try {
      const count = await autoCancelExpiredHomeAppointments()
      if (count > 0) {
        console.log(`[cron] Da tu dong huy ${count} lich qua han thanh toan`)
      }
    } catch (err) {
      console.error('[cron] Loi auto-cancel:', err.message)
    }

    try {
      const { soLich, soSlot } = await nhaSlotQuaHanToanHeThong()
      if (soSlot > 0) {
        console.log(`[cron] Da nha ${soSlot} slot giu cho qua han tren ${soLich} lich lam viec`)
      }
    } catch (err) {
      console.error('[cron] Loi nha slot qua han:', err.message)
    }

    // Cutoff T-30' (rule muc 11): slot online chua ban -> walk-in. Chay SAU khi nha slot
    // de cho vua duoc nha cung kip xet cutoff trong cung mot luot.
    try {
      const { soLich, soSlot } = await chuyenSlotOnlineQuaCutoffToanHeThong()
      if (soSlot > 0) {
        console.log(`[cron] Da chuyen ${soSlot} slot online qua cutoff T-30' sang walk-in tren ${soLich} lich`)
      }
    } catch (err) {
      console.error('[cron] Loi chuyen slot online qua cutoff:', err.message)
    }

    // Khach khong phan hoi de xuat doi lich -> ap phuong an DA GIU SAN (rule muc 15).
    // Khach khong bao gio mat cho chi vi khong kip tra loi.
    try {
      const daAp = await apDungDeXuatQuaHan()
      if (daAp > 0) console.log(`[cron] Da tu ap phuong an doi lich cho ${daAp} lich hen qua han phan hoi`)
    } catch (err) {
      console.error('[cron] Loi ap de xuat doi lich qua han:', err.message)
    }

    // Het ca ma khong co ban ghi HangDoi -> `no_show` (rule muc 8). CHI tu dong, khong ai
    // set tay duoc, vi no_show = mat 100% tien (muc 5). Mac dinh chi quet NGAY HOM NAY
    // (soNgay=1) — khong tu quet nguoc lich su, xem chu thich trong service. Chinh
    // NO_SHOW_SWEEP_LOOKBACK_DAYS de quet tồn đọng nhiều ngày khi CHU DONG can (vd: cron
    // vua duoc bat lai sau mot dot tat lau).
    // Tat bang NO_SHOW_SWEEP_ENABLED=false khi demo (xem BAT_QUET_NO_SHOW).
    if (BAT_QUET_NO_SHOW) {
      try {
        const { daDanhDau } = await quetNoShowHetCa({ soNgay: SO_NGAY_QUET_NO_SHOW_MAC_DINH })
        if (daDanhDau > 0) console.log(`[cron] Da danh dau ${daDanhDau} lich hen 'no_show' (het ca, khong toi quay)`)
      } catch (err) {
        console.error('[cron] Loi quet no_show:', err.message)
      }
    }
  }, { timezone: CLINIC_TIMEZONE }))

  console.log('Da khoi dong cron jobs (auto fill lich khi startup, sinh/bu lich 00:00 Chu nhat, moi 5 phut: auto-cancel + nha slot ket + cutoff walk-in + de xuat doi qua han + quet no_show)')
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
