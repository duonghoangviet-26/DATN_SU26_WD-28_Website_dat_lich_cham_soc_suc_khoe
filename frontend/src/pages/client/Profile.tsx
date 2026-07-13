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

export default function Profile() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const justBooked = searchParams.get('booked') === 'true'

  const [activeTab, setActiveTab] = useState<'appointments' | 'ehr' | 'account'>('appointments')
  const [appointments, setAppointments] = useState<PatientRecordListItem[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [selectedEHR, setSelectedEHR] = useState<PatientRecordDetail | null>(null)
  const [ehrLoading, setEhrLoading] = useState(false)

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
              { key: 'appointments', label: 'Lịch hẹn của tôi' },
              { key: 'ehr', label: 'Bệnh án & Đơn thuốc' },
              { key: 'account', label: 'Thông tin cá nhân' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'appointments' | 'ehr' | 'account')}
                className={`w-full rounded-lg px-4 py-2.5 text-left text-xs font-semibold transition ${
                  activeTab === tab.key ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-50'
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
