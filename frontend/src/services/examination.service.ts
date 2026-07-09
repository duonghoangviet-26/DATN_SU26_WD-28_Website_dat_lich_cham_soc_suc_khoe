import { mockExaminations } from '@/mock/examinations'
import type { ExaminationResult, PrescriptionDrug } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let examinations = [...mockExaminations]
let nextId = examinations.length + 1

interface ExamPayload {
  appointment_id: string | number
  chan_doan: string
  huong_dan_dieu_tri?: string | null
  ghi_chu?: string | null
  ngay_tai_kham?: string | null
  thuoc?: Omit<PrescriptionDrug, 'id'>[]
}

export const examinationService = {
  async getByAppointment(appointmentId: string | number): Promise<ExaminationResult | null> {
    await delay()
    const exam = examinations.find(e => e.appointment_id === appointmentId)
    return exam ? { ...exam } : null
    // Real API:
    // try {
    //   const res = await axiosInstance.get<ApiResponse<ExaminationResult>>(`/doctor/appointments/${appointmentId}/result`)
    //   return res.data.data
    // } catch (err: unknown) {
    //   if ((err as { response?: { status?: number } }).response?.status === 404) return null
    //   throw err
    // }
  },

  async save(data: ExamPayload): Promise<ExaminationResult> {
    await delay()
    const thuoc = (data.thuoc ?? []).map((t, i) => ({ ...t, id: i + 1 }))
    const idx = examinations.findIndex(e => e.appointment_id === data.appointment_id)
    if (idx !== -1) {
      const updated: ExaminationResult = { ...examinations[idx], ...data, thuoc }
      examinations[idx] = updated
      return { ...updated }
    }
    const newExam: ExaminationResult = {
      id: nextId++,
      appointment_id: data.appointment_id,
      chan_doan: data.chan_doan,
      huong_dan_dieu_tri: data.huong_dan_dieu_tri ?? '',
      ghi_chu: data.ghi_chu ?? null,
      ngay_tai_kham: data.ngay_tai_kham ?? '',
      co_the_sua: true,
      thuoc,
      ngay_tao: new Date().toISOString(),
    }
    examinations = [...examinations, newExam]
    return newExam
    // Real API:
    // const isUpdate = idx !== -1
    // const url = `/doctor/appointments/${data.appointment_id}/result`
    // const res = isUpdate
    //   ? await axiosInstance.put<ApiResponse<ExaminationResult>>(url, data)
    //   : await axiosInstance.post<ApiResponse<ExaminationResult>>(url, data)
    // return res.data.data
  },
}
