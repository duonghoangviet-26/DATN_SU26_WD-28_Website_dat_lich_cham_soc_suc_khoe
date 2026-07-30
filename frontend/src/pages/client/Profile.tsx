import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import Breadcrumb from '@/components/common/Breadcrumb'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Modal from '@/components/common/Modal'
import Toast from '@/components/common/Toast'
import RescheduleModal from '@/components/client/RescheduleModal'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth.service'
import {
  patientRecordsService,
  type PatientRecordDetail,
  type PatientRecordListItem,
} from '@/services/patient-records.service'
import {
  patientBookingService,
  type FamilyGroup,
  type FamilyMember,
} from '@/services/patient-booking.service'

export default function Profile() {
  const { user, loading: authLoading, updateUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const justBooked = searchParams.get('booked') === 'true'

  const [activeTab, setActiveTab] = useState<'appointments' | 'account' | 'family'>('appointments')
  const [appointments, setAppointments] = useState<PatientRecordListItem[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)

  // Family group states
  const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null)
  const [familyLoading, setFamilyLoading] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState('')

  // Appointment detail modal states
  const [selectedAppointment, setSelectedAppointment] = useState<PatientRecordDetail | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [contactEditOpen, setContactEditOpen] = useState(false)
  const [contactEditName, setContactEditName] = useState('')
  const [contactEditPhone, setContactEditPhone] = useState('')
  const [contactSaving, setContactSaving] = useState(false)

  // Member modal states
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [memberFormName, setMemberFormName] = useState('')
  const [memberFormDob, setMemberFormDob] = useState('')
  const [memberFormGender, setMemberFormGender] = useState<'nam' | 'nu' | 'khac'>('nam')
  const [memberFormBlood, setMemberFormBlood] = useState('')
  const [memberFormAllergy, setMemberFormAllergy] = useState('')
  const [memberFormBackground, setMemberFormBackground] = useState('')
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)

  const [hoTen, setHoTen] = useState('')
  const [soDienThoai, setSoDienThoai] = useState('')
  const [email, setEmail] = useState('')

  const [toast, setToast] = useState<string | null>(null)
  const [cancelModalId, setCancelModalId] = useState<string | null>(null)
  // Giữ ID lịch hẹn thay vì boolean: modal cần biết dời lịch NÀO (trước đây chỉ mở một
  // hộp thoại tĩnh bảo khách gọi hotline, không gắn với lịch cụ thể).
  const [rescheduleAppId, setRescheduleAppId] = useState<string | null>(null)
  const [refundHelpAppId, setRefundHelpAppId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?redirect=/profile')
    }
  }, [user, authLoading, navigate])

  // Tách riêng để dời lịch xong có thể nạp lại danh sách mà không phải reload trang.
  async function loadAppointments() {
    try {
      const result = await patientRecordsService.getAppointments()
      setAppointments(Array.isArray(result?.data) ? result.data : [])
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không tải được lịch hẹn của bạn.')
    }
  }

  useEffect(() => {
    if (!user) return

    setHoTen(user.ho_ten)
    setSoDienThoai(user.so_dien_thoai || '')
    setEmail(user.email)

    let ignore = false
    setAppointmentsLoading(true)
    patientRecordsService.getAppointments()
      .then((result) => {
        if (!ignore) {
          setAppointments(Array.isArray(result?.data) ? result.data : [])
          if (justBooked) {
            setToast('Đặt lịch và xác nhận thanh toán thành công.')
          }
        }
      })
      .catch((error: any) => {
        if (!ignore) {
          setToast(error.response?.data?.message || error.message || 'Không tải được lịch hẹn của bạn.')
          setAppointments([])
        }
      })
      .finally(() => {
        if (!ignore) setAppointmentsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [user, justBooked])

  const fetchFamilyGroup = () => {
    if (!user) return
    setFamilyLoading(true)
    patientBookingService.getFamilyGroup()
      .then((group) => {
        setFamilyGroup(group)
      })
      .catch((error: any) => {
        setToast(error.response?.data?.message || error.message || 'Không tải được nhóm gia đình.')
      })
      .finally(() => {
        setFamilyLoading(false)
      })
  }

  useEffect(() => {
    fetchFamilyGroup()
  }, [user])

  useEffect(() => {
    const bookedId = searchParams.get('id')
    const paymentId = searchParams.get('payment_id')
    const isPaymentSuccess = searchParams.get('payment_status') === 'success'

    if (isPaymentSuccess && paymentId) {
      patientBookingService.confirmPayment(paymentId)
        .then(() => {
          patientRecordsService.getAppointments().then((res) => {
            setAppointments(Array.isArray(res?.data) ? res.data : [])
          })
        })
        .catch(() => {})
    }

    const targetId = bookedId || paymentId
    if (targetId && (justBooked || isPaymentSuccess || paymentId)) {
      setDetailLoading(true)
      patientRecordsService.getAppointmentDetail(targetId)
        .then((detail) => {
          setSelectedAppointment(detail)
          setContactEditName(detail.ten_khach || '')
          setContactEditPhone(detail.so_dien_thoai_khach || '')
          setContactEditOpen(false)
          setDetailModalOpen(true)
        })
        .catch((error) => {
          console.error('Không tải được chi tiết lịch hẹn vừa đặt:', error)
        })
        .finally(() => {
          setDetailLoading(false)
        })
    }
  }, [searchParams, justBooked])

  function isAppointmentInPast(ngayKham: string, gioKham: string) {
    try {
      const appDate = new Date(ngayKham)
      if (gioKham && gioKham.includes(':')) {
        const [h, m] = gioKham.split(':').map(Number)
        appDate.setHours(h, m, 0, 0)
      } else {
        appDate.setHours(23, 59, 59, 999)
      }
      return appDate.getTime() < Date.now()
    } catch {
      return false
    }
  }

  function handleCancelClick(id: string) {
    setCancelModalId(id)
  }

  async function confirmCancel() {
    if (!cancelModalId) return
    try {
      const updated = await patientRecordsService.cancelAppointment(cancelModalId)
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === cancelModalId
            ? {
                ...item,
                status: updated.status as PatientRecordListItem['status'],
                payment_status: updated.payment_status as PatientRecordListItem['payment_status'],
              }
            : item
        )
      )
      setToast('Đã hủy lịch hẹn thành công.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Hủy lịch hẹn thất bại.')
    } finally {
      setCancelModalId(null)
    }
  }

  async function handleOpenAppointmentDetail(id: string) {
    setDetailLoading(true)
    try {
      const detail = await patientRecordsService.getAppointmentDetail(id)
      setSelectedAppointment(detail)
      setContactEditName(detail.ten_khach || '')
      setContactEditPhone(detail.so_dien_thoai_khach || '')
      setContactEditOpen(false)
      setDetailModalOpen(true)
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không tải được chi tiết cuộc hẹn.')
    } finally {
      setDetailLoading(false)
    }
  }

  function canEditAppointmentContact(appointment: PatientRecordDetail) {
    return ['pending', 'confirmed'].includes(appointment.status)
      && !isAppointmentInPast(appointment.ngay_kham, appointment.gio_kham)
  }

  async function handleUpdateAppointmentContact(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedAppointment) return

    setContactSaving(true)
    try {
      const updated = await patientRecordsService.updateAppointmentContact(selectedAppointment.id, {
        ho_ten: contactEditName.trim(),
        so_dien_thoai: contactEditPhone.trim(),
      })

      setSelectedAppointment((current) => current ? {
        ...current,
        ten_khach: updated.ten_khach,
        so_dien_thoai_khach: updated.so_dien_thoai_khach,
      } : current)
      setAppointments((current) => current.map((appointment) => appointment.id === selectedAppointment.id ? {
        ...appointment,
        ten_khach: updated.ten_khach,
        so_dien_thoai_khach: updated.so_dien_thoai_khach,
      } : appointment))
      setContactEditOpen(false)
      setToast('Đã cập nhật thông tin cho lịch hẹn này.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không thể cập nhật thông tin lịch hẹn.')
    } finally {
      setContactSaving(false)
    }
  }

  async function handleUpdateProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return

    try {
      const updatedUser = await authService.updateProfile({
        ho_ten: hoTen.trim(),
        so_dien_thoai: soDienThoai.trim(),
      })
      // Giữ nguyên toàn bộ thông tin phiên hiện tại, đặc biệt là id tài khoản.
      // Tên chỉ là thuộc tính hiển thị, không được thay thế khóa định danh.
      updateUser({
        ...user,
        ho_ten: updatedUser.ho_ten,
        so_dien_thoai: updatedUser.so_dien_thoai,
        anh_dai_dien: updatedUser.anh_dai_dien ?? user.anh_dai_dien ?? null,
      })
      setToast('Cập nhật thông tin cá nhân thành công.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không thể lưu thông tin cá nhân.')
    }
  }

  async function handleCreateFamily(event: React.FormEvent) {
    event.preventDefault()
    if (!newFamilyName.trim()) return

    setFamilyLoading(true)
    try {
      await patientBookingService.createFamily({
        ten_nhom: newFamilyName.trim(),
        ho_ten: user?.ho_ten || 'Chủ hộ',
      })
      setNewFamilyName('')
      setToast('Tạo nhóm gia đình thành công.')
      fetchFamilyGroup()
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Tạo nhóm thất bại.')
    } finally {
      setFamilyLoading(false)
    }
  }

  async function handleAddOrUpdateMember(event: React.FormEvent) {
    event.preventDefault()
    if (!memberFormName.trim() || !memberFormDob || !memberFormGender) {
      setToast('Vui lòng điền đầy đủ các thông tin bắt buộc.')
      return
    }

    setFamilyLoading(true)
    const payload = {
      ho_ten: memberFormName.trim(),
      ngay_sinh: memberFormDob,
      gioi_tinh: memberFormGender,
      nhom_mau: memberFormBlood || null,
      di_ung: memberFormAllergy || null,
      benh_nen: memberFormBackground || null,
    }

    try {
      if (editingMemberId) {
        await patientBookingService.updateFamilyMember(editingMemberId, payload)
        setToast('Cập nhật thành viên gia đình thành công.')
      } else {
        await patientBookingService.addFamilyMember(payload)
        setToast('Thêm thành viên gia đình mới thành công.')
      }
      setMemberModalOpen(false)
      clearMemberForm()
      fetchFamilyGroup()
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Thao tác thành viên thất bại.')
    } finally {
      setFamilyLoading(false)
    }
  }

  function handleEditMemberClick(member: FamilyMember) {
    setEditingMemberId(member.id)
    setMemberFormName(member.ho_ten)
    setMemberFormDob(new Date(member.ngay_sinh).toISOString().split('T')[0])
    setMemberFormGender(member.gioi_tinh)
    setMemberFormBlood(member.nhom_mau || '')
    setMemberFormAllergy(member.di_ung || '')
    setMemberFormBackground(member.benh_nen || '')
    setMemberModalOpen(true)
  }

  async function handleRemoveMember(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa thành viên gia đình này?')) return

    setFamilyLoading(true)
    try {
      await patientBookingService.removeFamilyMember(id)
      setToast('Đã xóa thành viên khỏi nhóm gia đình.')
      fetchFamilyGroup()
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Xóa thành viên thất bại.')
    } finally {
      setFamilyLoading(false)
    }
  }

  function clearMemberForm() {
    setEditingMemberId(null)
    setMemberFormName('')
    setMemberFormDob('')
    setMemberFormGender('nam')
    setMemberFormBlood('')
    setMemberFormAllergy('')
    setMemberFormBackground('')
  }

  function getStatusBadge(status: PatientRecordListItem['status']) {
    if (status === 'completed') return 'bg-emerald-50 text-emerald-600'
    if (status === 'confirmed') return 'bg-blue-50 text-blue-600'
    if (status === 'cancelled') return 'bg-red-50 text-red-600'
    return 'bg-amber-50 text-amber-600'
  }

  function getStatusLabel(status: PatientRecordListItem['status']) {
    if (status === 'completed') return 'Đã khám'
    if (status === 'confirmed') return 'Đã xác nhận'
    if (status === 'cancelled') return 'Đã hủy'
    return 'Chờ xác nhận'
  }

  function getPaymentLabel(status: PatientRecordListItem['payment_status']) {
    if (status === 'paid') return 'Đã thanh toán'
    if (status === 'refunded') return 'Đã hoàn tiền'
    if (status === 'partial') return 'Thanh toán một phần'
    return 'Chưa thanh toán'
  }

  if (authLoading || !user) {
    return null
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-16 sm:px-6">
      <Breadcrumb items={[{ label: 'Hồ sơ cá nhân' }]} />

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_22px_60px_-35px_rgba(15,118,110,0.5)]">
        <div className="flex flex-col gap-5 bg-[linear-gradient(120deg,#f0fdfa_0%,#ffffff_58%,#f8fafc_100%)] px-5 py-6 sm:flex-row sm:items-center sm:px-8">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-teal-700 text-xl font-black text-white shadow-sm">
            {user.ho_ten?.split(' ').pop()?.charAt(0) || 'B'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Khu vực bệnh nhân</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Hồ sơ cá nhân</h1>
            <p className="mt-1 text-sm text-slate-600">Quản lý lịch hẹn, thông tin liên hệ và kết quả khám của gia đình.</p>
          </div>
          <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs text-slate-500">Đang đăng nhập với</p>
            <p className="mt-0.5 max-w-[240px] truncate font-semibold text-slate-800">{user.email}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <aside className="w-full shrink-0 rounded-3xl border border-slate-200 bg-white p-3 text-left shadow-sm lg:w-72">
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tài khoản</p>
            <p className="mt-1 text-base font-bold text-slate-900">{user.ho_ten}</p>
            <p className="mt-1 text-xs text-slate-500">Thông tin được cập nhật trực tiếp vào hồ sơ.</p>
          </div>

          <div className="mt-3 flex flex-col gap-1">
            {[
              { key: 'appointments', label: 'Lịch hẹn', meta: 'Theo dõi lịch khám' },
              { key: 'family', label: 'Gia đình', meta: 'Quản lý người thân' },
              { key: 'account', label: 'Thông tin cá nhân', meta: 'Tên và số liên hệ' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'appointments' | 'account' | 'family')}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                  activeTab === tab.key ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className={`mt-0.5 block text-xs ${activeTab === tab.key ? 'text-teal-100' : 'text-slate-400'}`}>{tab.meta}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="w-full flex-1 text-left">
          {activeTab === 'appointments' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Quản lý lịch hẹn</h3>
                <p className="text-xs text-slate-400">Theo dõi trạng thái lịch hẹn và tình trạng thanh toán từ dữ liệu thật của hệ thống.</p>
              </div>

              <div className="space-y-4">
                {appointmentsLoading ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Đang tải danh sách lịch hẹn...
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Bạn chưa có lịch hẹn khám nào.
                  </div>
                ) : (
                  appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-brand-100"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Mã: {appointment.id.slice(-6).toUpperCase()}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadge(appointment.status)}`}>
                              {getStatusLabel(appointment.status)}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                              {getPaymentLabel(appointment.payment_status)}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800">
                            {appointment.ten_dich_vu || 'Khám lâm sàng Tai Mũi Họng'}
                          </h4>
                          <p className="text-xs text-slate-600 font-medium">
                            👤 Bệnh nhân: <span className="font-bold text-slate-800">{appointment.ten_khach || user?.ho_ten}</span>{' '}
                            {appointment.member_id ? (
                              <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 ml-1">
                                Thành viên gia đình
                              </span>
                            ) : appointment.ten_khach && appointment.ten_khach !== user?.ho_ten ? (
                              <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ml-1">
                                Đặt hộ người thân
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ml-1">
                                Bản thân
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            Bác sĩ phụ trách: <span className="font-semibold text-slate-700">{appointment.bac_si.ho_ten}</span>
                          </p>
                          <p className="text-xs text-slate-400">
                            Thời gian: <span className="font-semibold text-brand-600">{appointment.gio_kham}</span>, ngày {new Date(appointment.ngay_kham).toLocaleDateString('vi-VN')}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0">
                          <div className="text-left md:text-right">
                            <p className="text-[10px] font-semibold uppercase text-slate-400">Phí thanh toán</p>
                            <p className="text-sm font-extrabold text-slate-800">{appointment.gia_kham.toLocaleString('vi-VN')} đ</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenAppointmentDetail(appointment.id)}
                              disabled={detailLoading}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                            >
                              {detailLoading ? 'Đang tải...' : appointment.status === 'completed' ? 'Xem kết quả' : 'Chi tiết'}
                            </button>
                            {['pending', 'confirmed'].includes(appointment.status) && !isAppointmentInPast(appointment.ngay_kham, appointment.gio_kham) && (
                              <div className="flex gap-2">
                                <Button
                                  variant="secondary"
                                  onClick={() => setRescheduleAppId(appointment.id)}
                                  className="border-blue-100 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  Dời lịch
                                </Button>
                                {appointment.payment_status === 'paid' ? (
                                  <Button
                                    variant="secondary"
                                    onClick={() => setRefundHelpAppId(appointment.id)}
                                    className="border-red-100 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                                  >
                                    Hủy lịch
                                  </Button>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    onClick={() => handleCancelClick(appointment.id)}
                                    className="border-red-100 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                                  >
                                    Hủy lịch
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'family' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-800">Sổ quản lý gia đình</h3>
                  <p className="text-xs text-slate-400">Lưu thông tin sức khỏe và đặt lịch khám nhanh cho thành viên trong nhà.</p>
                </div>
                {familyGroup && (
                  <Button
                    onClick={() => {
                      clearMemberForm()
                      setMemberModalOpen(true)
                    }}
                    className="text-xs py-2 px-3 bg-brand-500 hover:bg-brand-600 font-bold flex items-center gap-1.5 text-white"
                  >
                    Thêm thành viên mới
                  </Button>
                )}
              </div>

              {familyLoading && !familyGroup ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                  Đang tải thông tin nhóm gia đình...
                </div>
              ) : !familyGroup ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
                  <div className="bg-brand-50/30 p-4 rounded-xl border border-brand-50 text-slate-700 text-sm">
                    <p className="font-bold text-brand-700 text-base mb-1">👨‍👩‍👧‍👦 Bạn chưa có nhóm gia đình</p>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Tính năng quản lý gia đình cho phép bạn lưu thông tin người thân (con cái, bố mẹ, vợ/chồng) để theo dõi kết quả khám bệnh, đơn thuốc tập trung và **đặt lịch khám hộ nhanh** mà không cần nhập lại thông tin.
                    </p>
                  </div>
                  <form onSubmit={handleCreateFamily} className="space-y-4 max-w-md text-left">
                    <Input
                      label="Tên nhóm gia đình (ví dụ: Gia đình họ Nguyễn, Gia đình An & Bình)"
                      placeholder="Nhập tên nhóm gia đình..."
                      value={newFamilyName}
                      onChange={(e) => setNewFamilyName(e.target.value)}
                      required
                    />
                    <Button type="submit" loading={familyLoading}>Tạo nhóm gia đình mới</Button>
                  </form>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Tên nhóm gia đình banner */}
                  <div className="bg-brand-600 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold">🏠 {familyGroup.ten_nhom}</h4>
                      <p className="text-xs text-brand-100 mt-1">Mã nhóm: {familyGroup.id.toUpperCase()}</p>
                    </div>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      👪 {familyGroup.members.length} Thành viên
                    </span>
                  </div>

                  {/* Danh sách thành viên card grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {familyGroup.members.map((member) => (
                      <div
                        key={member.id}
                        className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4 relative flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                {member.ho_ten}
                                {member.la_chu_ho && (
                                  <span className="bg-brand-50 text-brand-600 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                                    Chủ tài khoản
                                  </span>
                                )}
                              </h4>
                              <p className="text-[10px] text-slate-400 uppercase mt-0.5">
                                Giới tính: {member.gioi_tinh === 'nam' ? 'Nam' : member.gioi_tinh === 'nu' ? 'Nữ' : 'Khác'} • Năm sinh: {new Date(member.ngay_sinh).getFullYear()}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-50 pt-3 text-slate-500 font-medium">
                            <p>
                              <span className="font-bold text-slate-700">Nhóm máu:</span> {member.nhom_mau || '--'}
                            </p>
                            <p>
                              <span className="font-bold text-slate-700">Dị ứng:</span> {member.di_ung || 'Không có'}
                            </p>
                            <p className="col-span-2">
                              <span className="font-bold text-slate-700">Bệnh nền:</span> {member.benh_nen || 'Không ghi nhận'}
                            </p>
                          </div>
                        </div>

                        {!member.la_chu_ho && (
                          <div className="flex gap-2 justify-end border-t border-slate-50 pt-3 mt-1">
                            <button
                              onClick={() => handleEditMemberClick(member)}
                              className="text-xs font-bold text-brand-600 hover:bg-brand-50 px-2.5 py-1.5 rounded-lg border border-brand-50 transition"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-xs font-bold text-red-550 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-50 transition"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Cập nhật hồ sơ bệnh nhân</h3>
                <p className="text-xs text-slate-400">Thông tin hành chính dùng để liên hệ đặt lịch khám.</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Họ và tên bệnh nhân" value={hoTen} onChange={(event) => setHoTen(event.target.value)} required />
                  <Input label="Số điện thoại liên hệ" value={soDienThoai} onChange={(event) => setSoDienThoai(event.target.value)} required />
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Email đăng ký:</span> {email}
                  <p className="mt-1 text-xs text-slate-500">Email dùng để đăng nhập và không thể chỉnh sửa tại đây.</p>
                </div>

                <div className="flex justify-end border-t border-slate-50 pt-2">
                  <Button type="submit">Lưu thay đổi</Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {memberModalOpen && (
        <Modal
          isOpen={memberModalOpen}
          onClose={() => {
            setMemberModalOpen(false)
            clearMemberForm()
          }}
          title={editingMemberId ? 'SỬA THÀNH VIÊN GIA ĐÌNH' : 'THÊM THÀNH VIÊN GIA ĐÌNH'}
        >
          <form onSubmit={handleAddOrUpdateMember} className="space-y-4 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Họ và tên thành viên *"
                placeholder="Nhập họ và tên..."
                value={memberFormName}
                onChange={(e) => setMemberFormName(e.target.value)}
                required
              />
              <Input
                label="Ngày sinh *"
                type="date"
                value={memberFormDob}
                onChange={(e) => setMemberFormDob(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Giới tính *</label>
                <select
                  value={memberFormGender}
                  onChange={(e) => setMemberFormGender(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  required
                >
                  <option value="nam">Nam</option>
                  <option value="nu">Nữ</option>
                  <option value="khac">Khác</option>
                </select>
              </div>
              <Input
                label="Nhóm máu (tùy chọn)"
                placeholder="Ví dụ: A, B, O, AB..."
                value={memberFormBlood}
                onChange={(e) => setMemberFormBlood(e.target.value)}
              />
            </div>

            <Input
              label="Dị ứng thuốc / thức ăn (tùy chọn)"
              placeholder="Ví dụ: Dị ứng Penicillin, dị ứng hải sản..."
              value={memberFormAllergy}
              onChange={(e) => setMemberFormAllergy(e.target.value)}
            />

            <Input
              label="Tiền sử bệnh lý / Bệnh nền (tùy chọn)"
              placeholder="Ví dụ: Viêm xoang mãn tính, hen phế quản..."
              value={memberFormBackground}
              onChange={(e) => setMemberFormBackground(e.target.value)}
            />

            <div className="flex gap-4 justify-end border-t border-slate-50 pt-4 mt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMemberModalOpen(false)
                  clearMemberForm()
                }}
              >
                Đóng
              </Button>
              <Button type="submit" loading={familyLoading}>
                {editingMemberId ? 'Lưu thay đổi' : 'Thêm thành viên'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {detailModalOpen && selectedAppointment && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false)
            setSelectedAppointment(null)
            setContactEditOpen(false)
          }}
          title="CHI TIẾT LỊCH HẸN KHÁM"
        >
          <div className="space-y-6 text-left">
            {/* Lịch hẹn status banner */}
            <div className="bg-brand-50 p-4 rounded-xl border border-brand-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Mã lịch hẹn</p>
                <p className="text-lg font-black text-brand-700">{selectedAppointment.id.toUpperCase()}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusBadge(selectedAppointment.status)}`}>
                  {getStatusLabel(selectedAppointment.status)}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-105 px-2.5 py-0.5 text-xs font-bold text-slate-650 mt-1">
                  {getPaymentLabel(selectedAppointment.payment_status)}
                </span>
              </div>
            </div>

            {/* Thông tin bệnh nhân được đặt khám */}
            <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Thông tin bệnh nhân khám</p>
                <div className="flex items-center gap-2">
                  {canEditAppointmentContact(selectedAppointment) && !contactEditOpen && (
                    <button
                      type="button"
                      onClick={() => setContactEditOpen(true)}
                      className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                    >
                      Chỉnh sửa
                    </button>
                  )}
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                    {selectedAppointment.member_id
                      ? 'Thành viên gia đình'
                      : selectedAppointment.ten_khach && selectedAppointment.ten_khach !== user?.ho_ten
                      ? 'Đặt hộ người thân'
                      : 'Tài khoản chính (Bản thân)'}
                  </span>
                </div>
              </div>
              {contactEditOpen ? (
                <form onSubmit={handleUpdateAppointmentContact} className="space-y-3 pt-2">
                  <Input label="Họ và tên bệnh nhân" value={contactEditName} onChange={(event) => setContactEditName(event.target.value)} required />
                  <Input label="Số điện thoại liên hệ" value={contactEditPhone} onChange={(event) => setContactEditPhone(event.target.value)} required />
                  <p className="text-xs leading-5 text-blue-700">Thay đổi này chỉ áp dụng cho lịch hẹn hiện tại, không thay đổi hồ sơ cá nhân.</p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setContactEditOpen(false)}>Hủy</Button>
                    <Button type="submit" loading={contactSaving}>Lưu thông tin</Button>
                  </div>
                </form>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 text-sm pt-1">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Họ và tên bệnh nhân:</p>
                    <p className="font-bold text-slate-800">{selectedAppointment.ten_khach || user?.ho_ten}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Số điện thoại liên hệ:</p>
                    <p className="font-bold text-slate-800">{selectedAppointment.so_dien_thoai_khach || user?.so_dien_thoai || 'Chưa cập nhật'}</p>
                  </div>
                  {selectedAppointment.nam_sinh_khach && (
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Năm sinh:</p>
                      <p className="font-semibold text-slate-700">{selectedAppointment.nam_sinh_khach}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bác sĩ phụ trách</p>
                <p className="font-bold text-slate-800 mt-1">{selectedAppointment.bac_si.ho_ten}</p>
                <p className="text-xs text-slate-500 mt-0.5">{selectedAppointment.ten_dich_vu || 'Chuyên khoa Tai Mũi Họng'}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Thời gian khám</p>
                <p className="font-bold text-slate-800 mt-1">{selectedAppointment.gio_kham}</p>
                <p className="text-xs text-slate-500 mt-0.5">Ngày {new Date(selectedAppointment.ngay_kham).toLocaleDateString('vi-VN')}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="border-b border-slate-100 pb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Địa điểm khám</p>
                <p className="font-semibold text-slate-800 mt-1">🏠 {selectedAppointment.phong_kham ? `${selectedAppointment.phong_kham} - Phòng khám Tai Mũi Họng ViteFamily` : 'Phòng 102 - Tầng 1 - Phòng khám Tai Mũi Họng ViteFamily'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{selectedAppointment.dia_chi_kham || 'Thành phố Hà Nội'}</p>
              </div>

              {selectedAppointment.ly_do_kham && (
                <div className="border-b border-slate-100 pb-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Triệu chứng / Lý do khám</p>
                  <p className="text-slate-700 mt-1">{selectedAppointment.ly_do_kham}</p>
                </div>
              )}

              {selectedAppointment.status === 'completed' && selectedAppointment.ket_qua && (
                <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Kết quả sau khám</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedAppointment.ket_qua.chan_doan || 'Chưa có chẩn đoán chi tiết.'}
                    </p>
                  </div>
                  {selectedAppointment.ket_qua.huong_dan_dieu_tri && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Hướng dẫn điều trị</p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{selectedAppointment.ket_qua.huong_dan_dieu_tri}</p>
                    </div>
                  )}
                  {selectedAppointment.ket_qua.thuoc.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Đơn thuốc</p>
                      <ul className="mt-2 space-y-2">
                        {selectedAppointment.ket_qua.thuoc.map((thuoc, index) => (
                          <li key={index} className="rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-700">
                            {typeof thuoc === 'string'
                              ? thuoc
                              : `${thuoc.ten_thuoc || 'Thuốc'}${thuoc.lieu_luong ? ` · ${thuoc.lieu_luong}` : ''}${thuoc.tan_suat ? ` · ${thuoc.tan_suat}` : ''}${thuoc.so_ngay ? ` · ${thuoc.so_ngay} ngày` : ''}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Chi phí khám</p>
                  <p className="text-xs text-slate-500">Đã thanh toán online</p>
                </div>
                <p className="text-lg font-black text-brand-600">
                  {selectedAppointment.gia_kham.toLocaleString('vi-VN')} đ
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 mt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDetailModalOpen(false)
                  setSelectedAppointment(null)
                }}
                className="w-full sm:w-auto"
              >
                Đóng lại
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {cancelModalId && (() => {
        const selectedCancelApp = appointments.find((a) => a.id === cancelModalId)
        let isWithin24h = false
        let isPaid = false
        if (selectedCancelApp) {
          isPaid = selectedCancelApp.payment_status === 'paid'
          try {
            const appDate = new Date(selectedCancelApp.ngay_kham)
            if (selectedCancelApp.gio_kham && selectedCancelApp.gio_kham.includes(':')) {
              const [h, m] = selectedCancelApp.gio_kham.split(':').map(Number)
              appDate.setHours(h, m, 0, 0)
            }
            isWithin24h = (appDate.getTime() - Date.now()) < 24 * 3600 * 1000
          } catch {}
        }
        return (
          <Modal
            isOpen={!!cancelModalId}
            onClose={() => setCancelModalId(null)}
            title="XÁC NHẬN HỦY LỊCH HẸN"
          >
            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-600">
                Bạn có chắc chắn muốn hủy lịch hẹn khám này không? Hành động này sẽ tác động trực tiếp lên dữ liệu thật của hệ thống.
              </p>

              {isPaid && selectedCancelApp && (
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-3.5 text-left text-xs space-y-1">
                  <p className="font-bold text-orange-800 uppercase tracking-wider">Chính sách hoàn tiền:</p>
                  {isWithin24h ? (
                    <p className="text-orange-700">
                      Lịch khám diễn ra trong vòng 24h tới. Nếu hủy lúc này, quý khách chỉ được <strong>hoàn tiền 50%</strong> ({((selectedCancelApp.gia_kham || 0) * 0.5).toLocaleString('vi-VN')}đ) theo quy định của phòng khám.
                    </p>
                  ) : (
                    <p className="text-orange-700">
                      Lịch khám diễn ra còn hơn 24h nữa. Quý khách sẽ được <strong>hoàn tiền 100%</strong> ({selectedCancelApp.gia_kham.toLocaleString('vi-VN')}đ).
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-center gap-4">
                <Button variant="secondary" onClick={() => setCancelModalId(null)}>Đóng</Button>
                <Button variant="primary" className="bg-red-600 text-white hover:bg-red-700" onClick={confirmCancel}>Xác nhận hủy</Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {rescheduleAppId && (
        <RescheduleModal
          appointmentId={rescheduleAppId}
          onClose={() => setRescheduleAppId(null)}
          onDone={(thongBao) => {
            setRescheduleAppId(null)
            setToast(thongBao)
            void loadAppointments()
          }}
        />
      )}

      {/* Rule mục 5: KHÔNG hoàn tiền trong mọi trường hợp. Bản cũ ở đây hứa hoàn 50%/100%
          tuỳ mốc 24h — trái hẳn điều khoản khách đã ký lúc đặt, và là loại mâu thuẫn dẫn
          thẳng tới tranh chấp. Nay nói đúng chính sách và hướng khách sang DỜI LỊCH, thứ
          họ thực sự được hưởng. */}
      {refundHelpAppId && (() => {
        const selectedApp = appointments.find((a) => a.id === refundHelpAppId)
        return (
          <Modal
            isOpen={!!refundHelpAppId}
            onClose={() => setRefundHelpAppId(null)}
            title="HỦY LỊCH KHÁM"
          >
            <div className="space-y-4 text-left">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800">
                <p className="font-bold">Huỷ lịch đồng nghĩa mất toàn bộ số tiền đã thanh toán
                  {selectedApp ? ` (${selectedApp.gia_kham.toLocaleString('vi-VN')}đ)` : ''}.</p>
                <p className="mt-2">
                  Phòng khám không hoàn tiền — đây là điều khoản bạn đã đồng ý khi đặt lịch.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">
                <p className="font-bold">Bạn nên dời lịch thay vì huỷ.</p>
                <p className="mt-2">
                  Dời lịch giữ nguyên số tiền đã trả và bạn được dời một lần miễn phí. Nếu không
                  đến được vào giờ đã hẹn, chỉ cần dời trước giờ khám 30 phút.
                </p>
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                Nếu bạn cho rằng đây là lỗi từ phía phòng khám (bác sĩ nghỉ, đổi lịch...), vui lòng
                liên hệ hotline <strong>0365 747888</strong> — những trường hợp đó được dời lịch mà
                không tính vào hạn mức của bạn.
              </p>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setRefundHelpAppId(null)}>Để sau</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const id = refundHelpAppId
                    setRefundHelpAppId(null)
                    setRescheduleAppId(id)
                  }}
                >
                  Dời lịch thay vì huỷ
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
