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
  NurseRoomStatus,
  PhongKhamTrangThai,
  NurseQueueEntry,
  HangDoiTrangThai,
  NurseQueueCheckinPayload,
  NurseQueueCheckinResult,
  NurseQueueActionResult,
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

  // ─── Trạng thái phòng (Kế hoạch 2) ─────────────────────────────────────────
  async getRoomStatus(): Promise<NurseRoomStatus[]> {
    const res = await axiosInstance.get<ApiResponse<NurseRoomStatus[]>>('/nurse/room-status')
    return res.data.data
  },

  async updateRoomStatus(doctorId: string, trangThai: Exclude<PhongKhamTrangThai, 'dang_kham'>): Promise<{ doctor_id: string; trang_thai: string }> {
    const res = await axiosInstance.patch<ApiResponse<{ doctor_id: string; trang_thai: string }>>(
      `/nurse/room-status/${doctorId}`,
      { trang_thai: trangThai },
    )
    return res.data.data
  },

  // ─── Hàng đợi động (Kế hoạch 2) ─────────────────────────────────────────────
  async getQueueEntries(status?: HangDoiTrangThai): Promise<NurseQueueEntry[]> {
    const query: Record<string, string> = {}
    if (status) query.status = status
    const res = await axiosInstance.get<ApiResponse<NurseQueueEntry[]>>('/nurse/queue', { params: query })
    return res.data.data
  },

  async checkinQueue(payload: NurseQueueCheckinPayload): Promise<NurseQueueCheckinResult> {
    const res = await axiosInstance.post<ApiResponse<NurseQueueCheckinResult>>('/nurse/queue/checkin', payload)
    return res.data.data
  },

  async callQueuePatient(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/call`)
    return res.data.data
  },

  async intoRoomQueue(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/into-room`)
    return res.data.data
  },

  async finishQueue(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/finish`)
    return res.data.data
  },

  async skipQueue(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/skip`)
    return res.data.data
  },

  async cancelQueue(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/cancel`)
    return res.data.data
  },
}
