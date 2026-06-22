import type { ExaminationResult, PrescriptionDrug } from '@/types'
import { mockExaminations } from '@/mock/examinations'
import { delay } from '@/utils/format'

let exams: ExaminationResult[] = [...mockExaminations]
let nextId = exams.length + 1

interface ExamPayload {
  appointment_id: number
  chan_doan: string
  huong_dan_dieu_tri: string
  ghi_chu?: string | null
  ngay_tai_kham: string
  thuoc: Omit<PrescriptionDrug, 'id'>[]
}

export const examinationService = {
  async getByAppointment(appointment_id: number): Promise<ExaminationResult | null> {
    await delay(150)
    return exams.find((e) => e.appointment_id === appointment_id) ?? null
  },

  async save(payload: ExamPayload): Promise<ExaminationResult> {
    await delay(300)
    const existing = exams.find((e) => e.appointment_id === payload.appointment_id)
    if (existing && !existing.co_the_sua) {
      throw new Error('Kết quả khám đã bị khóa (quá 24h)')
    }

    const drugs: PrescriptionDrug[] = payload.thuoc.map((d, i) => ({ ...d, id: i + 1 }))
    const ngayTao = new Date().toISOString()

    if (existing) {
      const updated = { ...existing, ...payload, thuoc: drugs }
      exams = exams.map((e) => (e.appointment_id === payload.appointment_id ? updated : e))
      return updated
    }

    const newExam: ExaminationResult = {
      id: nextId++,
      ...payload,
      thuoc: drugs,
      co_the_sua: true,
      ngay_tao: ngayTao,
    }
    exams = [...exams, newExam]
    return newExam
  },
}
