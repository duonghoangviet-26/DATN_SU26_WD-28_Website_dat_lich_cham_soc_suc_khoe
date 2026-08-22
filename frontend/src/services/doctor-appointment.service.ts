import axiosInstance from './axiosInstance'
import type { MucDoThongBaoLeTan } from './doctor-exam-session.service'
import type {
  ApiResponse,
  DoctorAppointmentDetail,
  AppointmentStatus,
  PaymentStatus,
  KetQuaKhamStatus,
  DoctorPendingRecord,
  ExamResultEditPayload,
  DoctorExamQueueRow,
  QueueEntry,
  QueueCheckinPayload,
  QueueCheckinResult,
  QueueActionResult,
  LichChoTiepNhan,
  HangDoiTrangThai,
  RoomStatus,
  PhongKhamTrangThai,
} from '@/types'

interface Filters {
  status?: AppointmentStatus | ''
  date?: string
}

export const doctorAppointmentService = {
  async getAll({ status = '', date = '' }: Filters = {}): Promise<DoctorAppointmentDetail[]> {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (date)   params.date   = date
    const res = await axiosInstance.get<ApiResponse<DoctorAppointmentDetail[]>>('/doctor/appointments', { params })
    return res.data.data
  },

  async getById(id: string | number): Promise<DoctorAppointmentDetail> {
    const res = await axiosInstance.get<ApiResponse<DoctorAppointmentDetail>>(`/doctor/appointments/${id}`)
    return res.data.data
  },

  async confirm(id: string | number): Promise<Partial<DoctorAppointmentDetail>> {
    const res = await axiosInstance.patch<ApiResponse<Partial<DoctorAppointmentDetail>>>(`/doctor/appointments/${id}/confirm`)
    return res.data.data
  },

  async complete(id: string | number): Promise<Partial<DoctorAppointmentDetail>> {
    const res = await axiosInstance.patch<ApiResponse<Partial<DoctorAppointmentDetail>>>(`/doctor/appointments/${id}/complete`)
    return res.data.data
  },

  // Từ chối lịch 'pending' (home) — dùng chung endpoint /cancel với cancelConfirmed
  // (backend tự phân biệt qua status/loai_kham hiện tại của lịch hẹn).
  async reject(id: string | number, ly_do: string): Promise<{ id: string | number; status: AppointmentStatus; payment_status: PaymentStatus }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: AppointmentStatus; payment_status: PaymentStatus }>>(`/doctor/appointments/${id}/cancel`, { ly_do })
    return res.data.data
  },

  // Hủy lịch 'confirmed' (khẩn cấp với clinic) — cùng endpoint /cancel như reject()
  async cancelConfirmed(id: string | number, ly_do: string): Promise<{ id: string | number; status: AppointmentStatus; payment_status: PaymentStatus }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: AppointmentStatus; payment_status: PaymentStatus }>>(`/doctor/appointments/${id}/cancel`, { ly_do })
    return res.data.data
  },

  // "Lưu & Xác nhận" hồ sơ khám đang 'cho_xac_nhan' — bác sĩ có thể gửi kèm chỉnh sửa trực tiếp
  // (chẩn đoán/hướng dẫn/ghi chú/ngày tái khám/đơn thuốc) trong cùng thao tác, backend áp dụng
  // trước khi chốt da_xac_nhan (xem confirmResult ở BE). payload tùy chọn — bỏ qua = chỉ xác nhận.
  async confirmResult(
    id: string | number,
    payload?: ExamResultEditPayload,
  ): Promise<{ id: string; status: KetQuaKhamStatus; appointment_status: AppointmentStatus }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: KetQuaKhamStatus; appointment_status: AppointmentStatus }>>(
      `/doctor/appointments/${id}/result/confirm`,
      payload,
    )
    return res.data.data
  },

  // Đánh dấu hồ sơ 'cho_xac_nhan' là "cần chỉnh sửa lại" kèm lý do. Đẩy hồ sơ về
  // yeu_cau_chinh_sua; backend revert LichHen về waiting_record (transaction).
  async requestRevision(
    id: string | number,
    ly_do: string,
  ): Promise<{ id: string; status: KetQuaKhamStatus; appointment_status: AppointmentStatus }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: KetQuaKhamStatus; appointment_status: AppointmentStatus }>>(
      `/doctor/appointments/${id}/result/request-revision`,
      { ly_do },
    )
    return res.data.data
  },

  // Không truyền status: chỉ hồ sơ 'cho_xac_nhan' (dùng cho thẻ thống kê Dashboard — không đổi).
  // status='all': cả 3 trạng thái liên quan bác sĩ (chờ xác nhận/đã xác nhận/cần chỉnh sửa) —
  // dùng cho trang "Hồ sơ chờ xác nhận" để bác sĩ tra cứu lại hồ sơ đã xử lý.
  async listPendingResults(status?: 'all' | KetQuaKhamStatus): Promise<DoctorPendingRecord[]> {
    const params = status ? { status } : undefined
    const res = await axiosInstance.get<ApiResponse<DoctorPendingRecord[]>>('/doctor/appointments/pending-results', { params })
    return res.data.data
  },

  async getPatientProfileHistory(profileId: string): Promise<{ profile: unknown; visits: unknown[] }> {
    const res = await axiosInstance.get<ApiResponse<{ profile: unknown; visits: unknown[] }>>(
      `/doctor/appointments/patient-profiles/${profileId}/history`,
    )
    return res.data.data
  },

  // Hàng đợi khám của bác sĩ (online + offline gộp chung, trang "Hồ sơ chờ khám").
  async getExamQueue(date?: string): Promise<DoctorExamQueueRow[]> {
    const res = await axiosInstance.get<ApiResponse<DoctorExamQueueRow[]>>('/doctor/queue', { params: date ? { date } : {} })
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  // Xác nhận nhanh hồ sơ vãng lai (offline) theo ket_qua_id — không cần appointment_id.
  async confirmResultByRecord(ketQuaId: string, body: Record<string, unknown> = {}): Promise<unknown> {
    const res = await axiosInstance.patch<ApiResponse<unknown>>(`/doctor/appointments/result/${ketQuaId}/confirm-by-record`, body)
    return res.data.data
  },

  // ─── Hàng đợi động (trước đây do y tá đảm nhiệm — nay bác sĩ tự thao tác) ───────────────────
  async getQueueEntries(status?: HangDoiTrangThai): Promise<QueueEntry[]> {
    const query: Record<string, string> = {}
    if (status) query.status = status
    const res = await axiosInstance.get<ApiResponse<QueueEntry[]>>('/doctor/queue-entries', { params: query })
    return res.data.data
  },

  async checkinQueue(payload: QueueCheckinPayload): Promise<QueueCheckinResult> {
    const res = await axiosInstance.post<ApiResponse<QueueCheckinResult>>('/doctor/queue/checkin', payload)
    return res.data.data
  },

  // Khách đã đặt lịch hôm nay nhưng chưa vào hàng đợi — nguồn cho nút "Tiếp nhận".
  async getPendingCheckin(date?: string): Promise<LichChoTiepNhan[]> {
    const res = await axiosInstance.get<ApiResponse<LichChoTiepNhan[]>>(
      '/doctor/queue/pending-checkin',
      { params: date ? { date } : {} },
    )
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async callQueuePatient(id: string): Promise<QueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<QueueActionResult>>(`/doctor/queue/${id}/call`)
    return res.data.data
  },

  async intoRoomQueue(id: string): Promise<QueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<QueueActionResult>>(`/doctor/queue/${id}/into-room`)
    return res.data.data
  },

  async finishQueue(id: string): Promise<QueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<QueueActionResult>>(`/doctor/queue/${id}/finish`)
    return res.data.data
  },

  async skipQueue(id: string): Promise<QueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<QueueActionResult>>(`/doctor/queue/${id}/skip`)
    return res.data.data
  },

  async cancelQueue(id: string, lyDo: string): Promise<QueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<QueueActionResult>>(`/doctor/queue/${id}/cancel`, { ly_do: lyDo })
    return res.data.data
  },

  // Báo lễ tân KHÔNG gắn bệnh nhân cụ thể — dùng ở "Hồ sơ chờ khám" (ngoài phòng khám), khác
  // doctorExamSessionService.notifyReception (trong phòng khám, gắn theo queueId).
  async notifyReceptionGeneral(payload: { noi_dung: string; muc_do: MucDoThongBaoLeTan }): Promise<{ sent: number }> {
    const res = await axiosInstance.post<ApiResponse<{ sent: number }>>('/doctor/queue/notify-reception', payload)
    return res.data.data
  },

  // ─── Trạng thái phòng khám (trước đây do y tá đảm nhiệm — nay bác sĩ tự thao tác) ───────────
  async getRoomStatus(): Promise<RoomStatus> {
    const res = await axiosInstance.get<ApiResponse<RoomStatus>>('/doctor/room-status')
    return res.data.data
  },

  async updateRoomStatus(trangThai: Exclude<PhongKhamTrangThai, 'dang_kham'>): Promise<{ doctor_id: string; trang_thai: string }> {
    const res = await axiosInstance.patch<ApiResponse<{ doctor_id: string; trang_thai: string }>>(
      '/doctor/room-status',
      { trang_thai: trangThai },
    )
    return res.data.data
  },
}
