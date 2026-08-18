export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã tiếp nhận',
  in_progress: 'Đang khám',
  waiting_record: 'Chờ vào hồ sơ',
  waiting_doctor_confirm: 'Chờ bác sĩ xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',
  skipped: 'Bỏ lượt',
}

export function appointmentStatusLabel(status: string): string {
  return APPOINTMENT_STATUS_LABEL[status] ?? status
}

export function appointmentStatusTone(status: string): string {
  if (status === 'checked_in') return 'bg-emerald-100 text-emerald-800'
  if (status === 'completed') return 'bg-blue-100 text-blue-800'
  if (status === 'cancelled') return 'bg-rose-100 text-rose-800'
  if (status === 'no_show') return 'bg-slate-200 text-slate-700'
  if (status === 'pending') return 'bg-amber-100 text-amber-800'
  return 'bg-brand-100 text-brand-800'
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: 'Đã trả phí khám',
  partial: 'Đã trả một phần',
  unpaid: 'Chưa trả phí khám',
  refunded: 'Đã hoàn phí khám',
}

export function paymentLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status
}

// Trang thai HangDoi.trang_thai (frozen enum — .claude/rules/lich-lam-viec-bac-si.md muc 6/9).
// KHONG duoc them gia tri moi vao day; chi doi nhan hien thi.
export const EXAM_SESSION_STATUS_LABEL: Record<string, string> = {
  cho_dieu_phoi: 'Chờ điều phối',
  dang_cho: 'Đang chờ gọi',
  da_goi: 'Đã gọi',
  trong_phong: 'Đang khám',
  cho_dich_vu: 'Chờ dịch vụ',
  hoan_thanh: 'Đã khám xong',
  skipped: 'Bỏ lượt',
  cancelled: 'Đã hủy',
}

export function examSessionStatusLabel(status: string): string {
  return EXAM_SESSION_STATUS_LABEL[status] ?? status
}

export type StatusTone = 'warning' | 'info' | 'brand' | 'success' | 'danger' | 'neutral'

export function examSessionStatusTone(status: string): StatusTone {
  if (status === 'cho_dieu_phoi') return 'warning'
  if (status === 'dang_cho' || status === 'da_goi' || status === 'cho_dich_vu') return 'info'
  if (status === 'trong_phong') return 'brand'
  if (status === 'hoan_thanh') return 'success'
  if (status === 'cancelled' || status === 'skipped') return 'danger'
  return 'neutral'
}

export const EXAM_SESSION_SOURCE_LABEL: Record<string, string> = {
  online: 'Online',
  offline: 'Tại quầy',
}

export function examSessionSourceLabel(nguon: string): string {
  return EXAM_SESSION_SOURCE_LABEL[nguon] ?? nguon
}

const DISPATCH_BLOCK_REASON_LABEL: Record<string, string> = {
  khong_con_khung_an_toan: 'Không còn khung giờ an toàn để nhận thêm khách',
  dang_co_benh_nhan_trong_phong: 'Bác sĩ đang có bệnh nhân trong phòng',
  dang_bao_ve_lich_online_gan: 'Đang giữ chỗ cho khách đặt online sắp tới',
}

export function dispatchBlockReasonLabel(code: string): string {
  if (DISPATCH_BLOCK_REASON_LABEL[code]) return DISPATCH_BLOCK_REASON_LABEL[code]
  if (code.startsWith('phong_')) return `Phòng khám đang ở trạng thái "${code.slice('phong_'.length)}"`
  return code
}
