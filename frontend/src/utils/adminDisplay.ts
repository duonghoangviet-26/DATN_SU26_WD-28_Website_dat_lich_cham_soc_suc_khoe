import {
  APPOINTMENT_STATUS_LABEL,
  DOCTOR_APPROVAL_LABEL,
  EXAM_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  ROLE_LABEL,
  SCHEDULE_DAY_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  USER_STATUS_LABEL,
} from '@/utils/constants'
import { formatPrice } from '@/utils/format'

const FIELD_LABELS: Record<string, string> = {
  _id: 'Mã bản ghi',
  id: 'Mã bản ghi',
  user_id: 'Tài khoản',
  member_id: 'Thành viên gia đình',
  doctor_id: 'Bác sĩ',
  schedule_id: 'Lịch làm việc',
  slot_id: 'Khung giờ khám',
  service_id: 'Dịch vụ',
  specialty_id: 'Chuyên khoa',
  chi_nhanh_id: 'Chi nhánh',
  phong_kham_id: 'Phòng khám',
  appointment_id: 'Lịch hẹn',
  nguoi_dat_ho_id: 'Người đặt hộ',

  ho_ten: 'Họ và tên',
  email: 'Email',
  mat_khau: 'Mật khẩu',
  so_dien_thoai: 'Số điện thoại',
  anh_dai_dien: 'Ảnh đại diện',
  role: 'Vai trò',
  status: 'Trạng thái',
  ngay_xoa: 'Ngày xóa',
  ngay_tao: 'Ngày tạo',
  ngay_cap_nhat: 'Ngày cập nhật',

  ten: 'Tên',
  ten_dich_vu: 'Tên dịch vụ',
  ten_chuyen_khoa: 'Tên chuyên khoa',
  mo_ta: 'Mô tả',
  mo_ta_ngan: 'Mô tả ngắn',
  gia: 'Giá dịch vụ',
  gia_kham: 'Phí khám',
  phi_kham: 'Phí khám',
  phi_tu_van: 'Phí tư vấn',
  thoi_gian_phut: 'Thời lượng khám',
  loai: 'Loại dịch vụ',
  la_goi: 'Là gói dịch vụ',
  loai_goi: 'Loại gói dịch vụ',
  doi_tuong_ap_dung: 'Đối tượng áp dụng',
  so_nguoi_ap_dung: 'Số người áp dụng',
  phan_tram_giam_gia: 'Phần trăm giảm giá',
  dich_vu_con: 'Dịch vụ trong gói',

  trang_thai: 'Trạng thái',
  trang_thai_duyet: 'Trạng thái duyệt',
  trang_thai_ngay: 'Trạng thái ngày làm việc',
  trang_thai_xac_nhan: 'Trạng thái xác nhận',
  ly_do_tu_choi: 'Lý do từ chối',
  ly_do_tu_choi_xac_nhan: 'Lý do từ chối xác nhận',
  thoi_diem_xac_nhan: 'Thời điểm xác nhận',
  ghi_chu_ngay: 'Ghi chú ngày làm việc',
  ngay: 'Ngày làm việc',
  gio_bat_dau: 'Giờ bắt đầu',
  gio_ket_thuc: 'Giờ kết thúc',
  phong_kham: 'Phòng khám',
  tong_slot: 'Tổng khung giờ',
  slot_da_dat: 'Khung giờ đã đặt',
  slot_trong: 'Khung giờ trống',
  so_lich_hen_xung_dot: 'Lịch đang xử lý',
  canh_bao_xung_dot_xac_nhan: 'Cảnh báo xác nhận',
  slots: 'Danh sách khung giờ',

  tieu_su: 'Tiểu sử',
  bang_cap: 'Bằng cấp',
  kinh_nghiem: 'Kinh nghiệm',
  so_nam_kinh_nghiem: 'Số năm kinh nghiệm',
  la_hien: 'Hiển thị công khai',
  phong_kham_mac_dinh: 'Phòng khám mặc định',
  specialties: 'Chuyên khoa',
  services: 'Dịch vụ',

  ma_lich_hen: 'Mã lịch hẹn',
  benh_nhan: 'Bệnh nhân',
  sdt_benh_nhan: 'Số điện thoại bệnh nhân',
  loai_dat_lich: 'Loại đặt lịch',
  hinh_thuc_dat_lich: 'Kênh tạo lịch',
  nguoi_dat_ho_ten: 'Người đặt hộ',
  nguoi_dat_sdt: 'Số điện thoại người đặt hộ',
  bac_si: 'Bác sĩ',
  chuyen_khoa: 'Chuyên khoa / dịch vụ',
  ngay_kham: 'Ngày khám',
  gio_kham: 'Giờ khám',
  loai_kham: 'Loại khám',
  dia_chi_kham: 'Địa chỉ khám',
  ly_do_kham: 'Lý do khám',
  payment_status: 'Trạng thái thanh toán',
  so_lan_thay_doi: 'Số lần thay đổi',
  ly_do_huy: 'Lý do hủy',
  huy_boi: 'Người hủy',
  thoi_diem_huy: 'Thời điểm hủy',
  ghi_chu_le_tan: 'Ghi chú lễ tân',
  ghi_chu_tiep_nhan: 'Ghi chú tiếp nhận',
  so_hoa_don: 'Số hóa đơn',
  trang_thai_hoa_don: 'Trạng thái hóa đơn',
  tong_thanh_toan: 'Tổng thanh toán',
  loai_thanh_toan: 'Loại thanh toán',
  phuong_thuc: 'Phương thức thanh toán',
}

const VALUE_LABELS: Record<string, string> = {
  ...ROLE_LABEL,
  ...USER_STATUS_LABEL,
  ...DOCTOR_APPROVAL_LABEL,
  ...APPOINTMENT_STATUS_LABEL,
  ...PAYMENT_STATUS_LABEL,
  ...PAYMENT_METHOD_LABEL,
  ...EXAM_TYPE_LABEL,
  ...SERVICE_TYPE_LABEL,
  ...SCHEDULE_DAY_STATUS_LABEL,

  cho_xac_nhan: 'Chờ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  tu_choi: 'Từ chối',
  nghi: 'Nghỉ',
  nghi_phep: 'Nghỉ phép',
  lam_viec: 'Làm việc',
  chua_tao: 'Chưa tạo lịch',

  booked: 'Đã đặt lịch',
  locked: 'Bị khóa',
  cancelled: 'Đã hủy',
  expired: 'Đã hết hạn',
  pending_payment: 'Chờ thanh toán',
  phi_dat_lich: 'Phí đặt lịch',
  dat_coc: 'Đặt cọc',
  thanh_toan_bo_sung: 'Thanh toán bổ sung',
  chua_thanh_toan: 'Chưa thanh toán',
  da_dat_coc: 'Đã đặt cọc',
  da_thanh_toan_du: 'Đã thanh toán đủ',

  self: 'Tự đặt',
  proxy: 'Đặt hộ',
  patient: 'Bệnh nhân tự đặt',
  receptionist: 'Lễ tân tạo lịch',
  clinic: 'Phòng khám',
  home: 'Tại nhà',
  related: 'Dịch vụ liên quan',
  inactive: 'Đã ẩn',
  active: 'Đang hoạt động',

  goi_don: 'Gói đơn',
  goi_gia_dinh: 'Gói gia đình',
  ca_nhan: 'Cá nhân',
  gia_dinh: 'Gia đình',

  create: 'Tạo mới',
  update: 'Cập nhật',
  cancel: 'Hủy lịch',
  restore: 'Khôi phục',
  reschedule: 'Dời lịch',
  status_change: 'Đổi trạng thái',
  payment_change: 'Đổi trạng thái thanh toán',
  note_change: 'Cập nhật ghi chú',
  appointment_update: 'Cập nhật lịch hẹn',
  dat_ho: 'Cập nhật thông tin đặt hộ',

  admin: 'Quản trị viên',
  doctor: 'Bác sĩ',
  user: 'Bệnh nhân',
  system: 'Hệ thống',
}

const ACTION_LABELS: Record<string, string> = {
  auto_generate: 'Tự động sinh lịch',
  manual_create: 'Tạo lịch thủ công',
  update_workday: 'Cập nhật ngày làm việc',
  update_slot: 'Cập nhật khung giờ',
  doctor_confirm: 'Bác sĩ xác nhận',
  doctor_reject: 'Bác sĩ từ chối',
  doctor_request_cancel_slot: 'Bác sĩ xin hủy khung giờ',
  APPROVE_DOCTOR: 'Đã duyệt hồ sơ',
  RESTORE_DOCTOR: 'Khôi phục tài khoản',
  REJECT_DOCTOR: 'Từ chối hồ sơ',
  SUSPEND_DOCTOR: 'Tạm ngưng tài khoản',
  UPDATE_INFO: 'Cập nhật thông tin',
  CREATE_USER: 'Tạo tài khoản',
  UPDATE_USER: 'Cập nhật tài khoản',
  SOFT_DELETE_USER: 'Đưa tài khoản vào thùng rác',
  RESTORE_USER: 'Khôi phục tài khoản',
  LOCK_USER: 'Khóa tài khoản',
  UNLOCK_USER: 'Mở khóa tài khoản',
  HARD_DELETE_USER: 'Xóa vĩnh viễn tài khoản',
}

const ENUM_LIKE_FIELDS = new Set([
  'role',
  'status',
  'trang_thai',
  'trang_thai_duyet',
  'trang_thai_ngay',
  'trang_thai_xac_nhan',
  'payment_status',
  'trang_thai_hoa_don',
  'loai_thanh_toan',
  'loai',
  'loai_goi',
  'loai_kham',
  'loai_dat_lich',
  'hinh_thuc_dat_lich',
  'loai_thay_doi',
  'doi_tuong_ap_dung',
  'phuong_thuc',
])

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === ''
}

function compactObject(value: Record<string, unknown>): string {
  const preferred = ['ten', 'ho_ten', 'name', 'email', 'so_dien_thoai', 'ma_lich_hen', 'so_hoa_don']
  const visible = preferred
    .map((key) => value[key])
    .filter((item) => !isEmptyValue(item))
    .map(String)

  if (visible.length > 0) return visible.join(' - ')

  const entries = Object.entries(value).filter(([, entryValue]) => !isEmptyValue(entryValue))
  if (entries.length === 0) return 'Không có'

  return entries
    .slice(0, 3)
    .map(([key, entryValue]) => `${formatAdminFieldLabel(key)}: ${formatAdminValue(key, entryValue)}`)
    .join('; ')
}

export function formatAdminFieldLabel(field: string): string {
  return FIELD_LABELS[field] || 'Thông tin khác'
}

export function formatAdminActionLabel(action: string | null | undefined): string {
  if (!action) return 'Thao tác hệ thống'
  return ACTION_LABELS[action] || 'Thao tác hệ thống'
}

export function formatAdminValue(field: string, value: unknown): string {
  if (isEmptyValue(value)) return 'Không có'
  if (field === 'anh_dai_dien') return value ? 'Có ảnh' : 'Không có ảnh'
  if (field === 'phi_kham' || field === 'phi_tu_van' || field === 'gia' || field === 'gia_kham' || field === 'tong_thanh_toan') {
    return formatPrice(Number(value))
  }
  if (field === 'phan_tram_giam_gia') return `${Number(value)}%`
  if (field === 'thoi_gian_phut') return `${Number(value)} phút`
  if (field === 'so_nam_kinh_nghiem') return `${Number(value)} năm`
  if (field === 'status' && String(value) === 'active') return 'Đang hoạt động'

  const stringValue = String(value)
  if (VALUE_LABELS[stringValue]) return VALUE_LABELS[stringValue]
  if (ENUM_LIKE_FIELDS.has(field)) return 'Thông tin khác'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) => (typeof item === 'object' && item !== null ? compactObject(item as Record<string, unknown>) : formatAdminValue(field, item))).join(', ')
      : 'Không có'
  }
  if (typeof value === 'object') return compactObject(value as Record<string, unknown>)
  return stringValue
}
