// Dùng Hospital/Specialty (số ít) thay vì HospitalItem/SpecialtyItem —
// 2 type đó đã được nhánh main tái sử dụng cho ManageHospitals (C3, gọi API thật /admin/clinic-info,
// dạng Mongo _id/trang_thai, không còn slug). Mock ở đây vẫn phục vụ specialty.service.ts
// (Tầng 2/3 Quản lý dịch vụ + trang duyệt bác sĩ theo chuyên khoa của bệnh nhân) — cần giữ slug.
import type { Hospital, Specialty } from '@/types'

export const mockHospitals: Hospital[] = [
  { id: 1, ten: 'Bệnh viện Đa khoa VitaFamily', dia_chi: '123 Đường Phổ Quang, Tân Bình, TP.HCM', so_dien_thoai: '1900 1234', gio_lam_viec: '07:00 - 21:00', status: 'active', ngay_tao: '2024-01-01' },
  { id: 2, ten: 'Phòng khám Vita cơ sở 2', dia_chi: '456 Đường Nguyễn Huệ, Quận 1, TP.HCM', so_dien_thoai: '1900 5678', gio_lam_viec: '08:00 - 18:00', status: 'active', ngay_tao: '2024-02-10' },
]

export const mockSpecialties: Specialty[] = [
  { id: 1, ten: 'Tim mạch', mo_ta: 'Khám và điều trị bệnh tim mạch', icon_url: '❤️', slug: 'tim-mach', thu_tu: 1, status: 'active' },
  { id: 2, ten: 'Nhi khoa', mo_ta: 'Chăm sóc sức khỏe trẻ em', icon_url: '👶', slug: 'nhi-khoa', thu_tu: 2, status: 'active' },
  { id: 3, ten: 'Da liễu', mo_ta: 'Các bệnh về da, tóc, móng', icon_url: '🧴', slug: 'da-lieu', thu_tu: 3, status: 'active' },
  { id: 4, ten: 'Sản phụ khoa', mo_ta: 'Sức khỏe sinh sản và thai kỳ', icon_url: '🌸', slug: 'san-phu-khoa', thu_tu: 4, status: 'active' },
  { id: 5, ten: 'Thần kinh', mo_ta: 'Bệnh lý hệ thần kinh', icon_url: '🧠', slug: 'than-kinh', thu_tu: 5, status: 'active' },
  { id: 6, ten: 'Nội tổng quát', mo_ta: 'Khám và điều trị bệnh nội khoa', icon_url: '🩺', slug: 'noi-tong-quat', thu_tu: 6, status: 'active' },
  { id: 7, ten: 'Mắt', mo_ta: 'Các bệnh về mắt và thị lực', icon_url: '👁️', slug: 'mat', thu_tu: 7, status: 'active' },
  { id: 8, ten: 'Tai Mũi Họng', mo_ta: 'Khám tai, mũi, họng', icon_url: '👂', slug: 'tai-mui-hong', thu_tu: 8, status: 'hidden' },
  { id: 9, ten: 'Cột sống', mo_ta: 'Chẩn đoán và điều trị bệnh lý cột sống, thoát vị đĩa đệm', icon_url: '🦴', slug: 'cot-song', thu_tu: 9, status: 'active' },
]
