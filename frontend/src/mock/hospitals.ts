import type { HospitalItem, SpecialtyItem } from '@/types'

export const mockHospitals: HospitalItem[] = [
  {
    id: 1,
    ten: 'Bệnh viện Đa khoa VitaFamily Hà Nội',
    dia_chi: '123 Đường Láng, Đống Đa, Hà Nội',
    so_dien_thoai: '024 3826 9999',
    gio_lam_viec: 'T2–T7: 7:00–17:00',
    status: 'active',
    ngay_tao: '2026-01-10T00:00:00',
  },
  {
    id: 2,
    ten: 'Phòng khám VitaFamily Quận 1',
    dia_chi: '45 Nguyễn Huệ, Quận 1, TP.HCM',
    so_dien_thoai: '028 3829 4444',
    gio_lam_viec: 'T2–CN: 8:00–20:00',
    status: 'active',
    ngay_tao: '2026-01-15T00:00:00',
  },
  {
    id: 3,
    ten: 'Trung tâm Y tế VitaFamily Đà Nẵng',
    dia_chi: '88 Trần Phú, Hải Châu, Đà Nẵng',
    so_dien_thoai: '0236 3655 555',
    gio_lam_viec: 'T2–T6: 7:30–16:30',
    status: 'active',
    ngay_tao: '2026-02-01T00:00:00',
  },
  {
    id: 4,
    ten: 'Phòng khám VitaFamily Bình Dương',
    dia_chi: '56 Đại lộ Bình Dương, Thủ Dầu Một',
    so_dien_thoai: '0274 3836 666',
    gio_lam_viec: 'T2–T7: 8:00–17:00',
    status: 'hidden',
    ngay_tao: '2026-03-01T00:00:00',
  },
]

export const mockSpecialties: SpecialtyItem[] = [
  { id: 1, ten: 'Tim mạch', mo_ta: 'Khám và điều trị bệnh tim mạch', icon: '❤️', thu_tu: 1, status: 'active' },
  { id: 2, ten: 'Nhi khoa', mo_ta: 'Chăm sóc sức khỏe trẻ em', icon: '👶', thu_tu: 2, status: 'active' },
  { id: 3, ten: 'Da liễu', mo_ta: 'Các bệnh về da, tóc, móng', icon: '🧴', thu_tu: 3, status: 'active' },
  { id: 4, ten: 'Sản phụ khoa', mo_ta: 'Sức khỏe sinh sản và thai kỳ', icon: '🌸', thu_tu: 4, status: 'active' },
  { id: 5, ten: 'Thần kinh', mo_ta: 'Bệnh lý hệ thần kinh', icon: '🧠', thu_tu: 5, status: 'active' },
  { id: 6, ten: 'Nội tổng quát', mo_ta: 'Khám và điều trị bệnh nội khoa', icon: '🩺', thu_tu: 6, status: 'active' },
  { id: 7, ten: 'Mắt', mo_ta: 'Các bệnh về mắt và thị lực', icon: '👁️', thu_tu: 7, status: 'active' },
  { id: 8, ten: 'Tai Mũi Họng', mo_ta: 'Khám tai, mũi, họng', icon: '👂', thu_tu: 8, status: 'hidden' },
]
