import { BacSi } from '../models/index.js'
import { emitDoctorQueueChanged } from '../realtime/socket.js'

// Realtime is a best-effort notification. The database write remains the source of truth.
export async function notifyDoctorQueueUpdated(doctorId, payload = {}) {
  if (!doctorId) return

  try {
    const doctor = await BacSi.findById(doctorId).select('user_id').lean()
    if (!doctor?.user_id) return

    emitDoctorQueueChanged(doctor.user_id, {
      doctor_id: doctorId,
      ...payload,
    })
  } catch (error) {
    console.warn('[realtime] Khong the thong bao hang doi bac si:', error.message)
  }
}
