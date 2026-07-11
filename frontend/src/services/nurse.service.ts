import axiosInstance from './axiosInstance'
import type {
  ApiResponse,
  NurseDashboard,
  NurseQueueItem,
  NurseAppointmentDetail,
  NurseMedicalRecord,
  NurseRevisionItem,
  NurseMedicalRecordDraftPayload,
  AppointmentStatus,
} from '@/types'

export const nurseService = {
  async getDashboard(): Promise<NurseDashboard> {
    const res = await axiosInstance.get<ApiResponse<NurseDashboard>>('/nurse/dashboard')
    return res.data.data
  },

  async getQueue(params: { date?: string; status?: AppointmentStatus | '' } = {}): Promise<NurseQueueItem[]> {
    const query: Record<string, string> = {}
    if (params.date) query.date = params.date
    if (params.status) query.status = params.status
    const res = await axiosInstance.get<ApiResponse<NurseQueueItem[]>>('/nurse/appointments', { params: query })
    return res.data.data
  },

  async getAppointmentById(id: string): Promise<NurseAppointmentDetail> {
    const res = await axiosInstance.get<ApiResponse<NurseAppointmentDetail>>(`/nurse/appointments/${id}`)
    return res.data.data
  },

  async createDraft(payload: NurseMedicalRecordDraftPayload): Promise<NurseMedicalRecord> {
    const res = await axiosInstance.post<ApiResponse<NurseMedicalRecord>>('/nurse/medical-records', payload)
    return res.data.data
  },

  async updateRecord(id: string, payload: Partial<NurseMedicalRecordDraftPayload>): Promise<NurseMedicalRecord> {
    const res = await axiosInstance.patch<ApiResponse<NurseMedicalRecord>>(`/nurse/medical-records/${id}`, payload)
    return res.data.data
  },

  async submit(id: string): Promise<{ id: string; status: string; appointment_status: string | null }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: string; appointment_status: string | null }>>(`/nurse/medical-records/${id}/submit`)
    return res.data.data
  },

  async resubmit(id: string): Promise<{ id: string; status: string; appointment_status: string | null }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: string; appointment_status: string | null }>>(`/nurse/medical-records/${id}/resubmit`)
    return res.data.data
  },

  async getRevisions(): Promise<NurseRevisionItem[]> {
    const res = await axiosInstance.get<ApiResponse<NurseRevisionItem[]>>('/nurse/medical-records/revisions')
    return res.data.data
  },
}
