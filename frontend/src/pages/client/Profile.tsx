import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import Breadcrumb from '@/components/common/Breadcrumb'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Modal from '@/components/common/Modal'
import Toast from '@/components/common/Toast'
import { useAuth } from '@/context/AuthContext'
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
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const justBooked = searchParams.get('booked') === 'true'

  const [activeTab, setActiveTab] = useState<'appointments' | 'ehr' | 'account' | 'family'>('appointments')
  const [appointments, setAppointments] = useState<PatientRecordListItem[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [selectedEHR, setSelectedEHR] = useState<PatientRecordDetail | null>(null)
  const [ehrLoading, setEhrLoading] = useState(false)

  // Family group states
  const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null)
  const [familyLoading, setFamilyLoading] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState('')

  // Appointment detail modal states
  const [selectedAppointment, setSelectedAppointment] = useState<PatientRecordDetail | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

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
  const [birthDate, setBirthDate] = useState('1998-05-12')
  const [gender, setGender] = useState('male')
  const [insuranceCard, setInsuranceCard] = useState('GD401023901923')

  const [toast, setToast] = useState<string | null>(null)
  const [cancelModalId, setCancelModalId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?redirect=/profile')
    }
  }, [user, authLoading, navigate])

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
    if (justBooked && bookedId) {
      setDetailLoading(true)
      patientRecordsService.getAppointmentDetail(bookedId)
        .then((detail) => {
          setSelectedAppointment(detail)
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

  async function handleOpenEhr(id: string) {
    setEhrLoading(true)
    try {
      const detail = await patientRecordsService.getAppointmentDetail(id)
      setSelectedEHR(detail)
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không tải được chi tiết bệnh án.')
    } finally {
      setEhrLoading(false)
    }
  }

  async function handleOpenAppointmentDetail(id: string) {
    setDetailLoading(true)
    try {
      const detail = await patientRecordsService.getAppointmentDetail(id)
      setSelectedAppointment(detail)
      setDetailModalOpen(true)
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không tải được chi tiết cuộc hẹn.')
    } finally {
      setDetailLoading(false)
    }
  }

  function handleUpdateProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return

    const updatedUser = {
      ...user,
      ho_ten: hoTen,
      so_dien_thoai: soDienThoai,
    }
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setToast('Cập nhật hồ sơ thông tin cá nhân thành công.')
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

  const completedAppointments = appointments.filter((item) => item.status === 'completed')

  if (authLoading || !user) {
    return null
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 space-y-6">
      <Breadcrumb items={[{ label: 'Hồ sơ bệnh nhân' }]} />

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="w-full shrink-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4 text-left lg:w-64">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800">{user.ho_ten}</h2>
            <p className="text-xs font-medium text-slate-400">Bệnh nhân chuyên khoa</p>
          </div>

          <div className="flex flex-col gap-1 border-t border-slate-50 pt-3">
            {[
              { key: 'appointments', label: '📅 Lịch hẹn của tôi' },
              { key: 'ehr', label: '📄 Bệnh án & Đơn thuốc' },
              { key: 'family', label: '👨‍👩‍👧 Thành viên gia đình' },
              { key: 'account', label: '👤 Thông tin cá nhân' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'appointments' | 'ehr' | 'account' | 'family')}
                className={`w-full rounded-lg px-4 py-2.5 text-left text-xs font-semibold transition ${
                  activeTab === tab.key ? 'bg-brand-50 text-brand-600 font-bold' : 'text-slate-650 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

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
                              {detailLoading ? 'Đang tải...' : 'Chi tiết'}
                            </button>
                            {appointment.status === 'pending' && (
                              <Button
                                variant="secondary"
                                onClick={() => handleCancelClick(appointment.id)}
                                className="border-red-100 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                Hủy lịch
                              </Button>
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

          {activeTab === 'ehr' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Lịch sử bệnh án & Đơn thuốc</h3>
                <p className="text-xs text-slate-400">Các ca đã hoàn thành sẽ hiển thị tại đây cùng chi tiết chẩn đoán và toa thuốc.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {appointmentsLoading ? (
                  <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Đang tải dữ liệu bệnh án...
                  </div>
                ) : completedAppointments.length === 0 ? (
                  <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Chưa có bệnh án điện tử nào được lưu trữ.
                  </div>
                ) : (
                  completedAppointments.map((appointment) => (
                    <div key={appointment.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md space-y-4">
                      <div className="flex items-start justify-between border-b border-slate-50 pb-3">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400">Ngày khám: {new Date(appointment.ngay_kham).toLocaleDateString('vi-VN')}</span>
                          <h4 className="mt-0.5 text-sm font-bold text-slate-800">{appointment.ten_dich_vu}</h4>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                          Đã chẩn đoán
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-500">
                        <p><span className="font-semibold text-slate-700">Bác sĩ:</span> {appointment.bac_si.ho_ten}</p>
                        <p><span className="font-semibold text-slate-700">Trạng thái thanh toán:</span> {getPaymentLabel(appointment.payment_status)}</p>
                      </div>

                      <button
                        onClick={() => handleOpenEhr(appointment.id)}
                        className="btn-secondary w-full py-2 text-center text-xs font-semibold"
                        disabled={ehrLoading}
                      >
                        {ehrLoading ? 'Đang tải...' : 'Xem chi tiết kết quả bệnh án'}
                      </button>
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
                                    Chủ hộ
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Địa chỉ email đăng ký" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled />
                  <Input label="Số bảo hiểm y tế (BHYT)" value={insuranceCard} onChange={(event) => setInsuranceCard(event.target.value)} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Ngày sinh" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Giới tính</label>
                    <select
                      value={gender}
                      onChange={(event) => setGender(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-50 pt-2">
                  <Button type="submit">Lưu thay đổi</Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {selectedEHR && (
        <Modal
          isOpen={!!selectedEHR}
          onClose={() => setSelectedEHR(null)}
          title="BỆNH ÁN ĐIỆN TỬ CHI TIẾT"
        >
          <div className="max-h-[80vh] space-y-6 overflow-y-auto pr-2 text-left text-sm text-slate-600">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-base font-extrabold text-slate-800">{selectedEHR.ten_dich_vu}</h4>
                <p className="mt-0.5 text-xs text-slate-400">Mã bệnh án: {selectedEHR.id}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-800">{selectedEHR.bac_si.ho_ten}</p>
                <p className="text-[10px] text-slate-500">Ngày khám: {new Date(selectedEHR.ngay_kham).toLocaleDateString('vi-VN')}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chẩn đoán lâm sàng</span>
              <p className="rounded-lg bg-slate-50 p-3 font-medium text-slate-800">
                {selectedEHR.ket_qua?.chan_doan || 'Chưa có chẩn đoán chi tiết.'}
              </p>
            </div>

            {selectedEHR.ket_qua?.thuoc?.length ? (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đơn thuốc chỉ định</span>
                <ul className="list-decimal list-inside space-y-1 rounded-lg bg-slate-50 p-4">
                  {selectedEHR.ket_qua.thuoc.map((thuoc, index) => (
                    <li key={index} className="text-slate-700">
                      {typeof thuoc === 'string'
                        ? thuoc
                        : [
                            thuoc.ten_thuoc,
                            thuoc.lieu_luong,
                            thuoc.tan_suat,
                            thuoc.ghi_chu,
                          ].filter(Boolean).join(' - ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Modal>
      )}

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
                <p className="font-semibold text-slate-800 mt-1">🏠 {selectedAppointment.phong_kham || 'Phòng khám Tai Mũi Họng VitaFamily'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{selectedAppointment.dia_chi_kham || 'Thành phố Hà Nội'}</p>
              </div>

              {selectedAppointment.ly_do_kham && (
                <div className="border-b border-slate-100 pb-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Triệu chứng / Lý do khám</p>
                  <p className="text-slate-700 mt-1">{selectedAppointment.ly_do_kham}</p>
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

      {cancelModalId && (
        <Modal
          isOpen={!!cancelModalId}
          onClose={() => setCancelModalId(null)}
          title="XÁC NHẬN HỦY LỊCH HẸN"
        >
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600">
              Bạn có chắc chắn muốn hủy lịch hẹn khám này không? Hành động này sẽ tác động trực tiếp lên dữ liệu thật của hệ thống.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="secondary" onClick={() => setCancelModalId(null)}>Đóng</Button>
              <Button variant="primary" className="bg-red-600 text-white hover:bg-red-700" onClick={confirmCancel}>Xác nhận hủy</Button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
