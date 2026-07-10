import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Breadcrumb from '@/components/common/Breadcrumb'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Toast from '@/components/common/Toast'
import Modal from '@/components/common/Modal'

interface Appointment {
  _id: string
  user_id?: string
  doctor_id?: string
  schedule_id?: string
  slot_id?: string
  service_id?: string | null
  loai_kham: 'clinic' | 'home'
  ngay_kham: string
  gio_kham: string
  ly_do_kham: string
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
  gia_kham: number
  ten_dich_vu: string
  ten_khach?: string
  so_dien_thoai_khach?: string
  bac_si: string
  // EHR details if completed
  chan_doan?: string
  don_thuoc?: string[]
  hinh_anh_noi_soi?: string
}

// Pre-seeded past completed clinical appointments for high realism
const SEEDED_PAST_APPOINTMENTS: Appointment[] = [
  {
    _id: 'app-completed-1',
    ten_khach: 'Nguyễn Văn Bệnh Nhân',
    so_dien_thoai_khach: '0987654321',
    bac_si: 'PGS. TS. BS. Nguyễn Văn Cương',
    ngay_kham: '2026-06-15',
    gio_kham: '09:00 - 09:30',
    loai_kham: 'clinic',
    status: 'completed',
    payment_status: 'paid',
    gia_kham: 350000,
    ten_dich_vu: 'Nội soi tai mũi họng bằng ống mềm',
    ly_do_kham: 'Rát họng nhiều, có đờm vướng cổ họng khi nuốt.',
    chan_doan: 'Viêm họng hạt cấp tính, niêm mạc xung huyết đỏ nhẹ.',
    don_thuoc: [
      'Amoxicillin 500mg - Uống 2 viên/ngày (Sáng 1 - Chiều 1) sau ăn',
      'Paracetamol 500mg - Uống 1 viên khi sốt trên 38.5 độ',
      'Nước muối sinh lý NaCl 0.9% - Súc họng 4-5 lần/ngày',
    ],
    hinh_anh_noi_soi: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&auto=format&fit=crop&q=60',
  },
  {
    _id: 'app-completed-2',
    ten_khach: 'Nguyễn Văn Bệnh Nhân',
    so_dien_thoai_khach: '0987654321',
    bac_si: 'ThS. BS. Phạm Thu Dung',
    ngay_kham: '2026-05-20',
    gio_kham: '14:30 - 15:00',
    loai_kham: 'clinic',
    status: 'completed',
    payment_status: 'paid',
    gia_kham: 150000,
    ten_dich_vu: 'Khám lâm sàng Tai Mũi Họng',
    ly_do_kham: 'Ngứa nhức tai bên trái, thỉnh thoảng thấy ù nhẹ.',
    chan_doan: 'Viêm tai ngoài nhẹ do vệ sinh tai sai cách.',
    don_thuoc: [
      'Ofloxacin dung dịch nhỏ tai - Nhỏ 3 giọt/lần, 2 lần/ngày',
      'Hạn chế nước vào tai khi tắm trong vòng 1 tuần',
    ],
  },
]

export default function Profile() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const justBooked = searchParams.get('booked') === 'true'

  // Tabs state
  const [activeTab, setActiveTab] = useState<'appointments' | 'ehr' | 'account'>('appointments')

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([])
  
  // EHR Detail Modal state
  const [selectedEHR, setSelectedEHR] = useState<Appointment | null>(null)
  
  // Profile update form state
  const [hoTen, setHoTen] = useState('')
  const [soDienThoai, setSoDienThoai] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('1998-05-12')
  const [gender, setGender] = useState('male')
  const [insuranceCard, setInsuranceCard] = useState('GD401023901923')

  const [toast, setToast] = useState<string | null>(null)
  const [cancelModalId, setCancelModalId] = useState<string | null>(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?redirect=/profile')
    }
  }, [user, authLoading, navigate])

  // Sync user info and load appointments
  useEffect(() => {
    if (user) {
      setHoTen(user.ho_ten)
      setSoDienThoai(user.so_dien_thoai || '')
      setEmail(user.email)

      // Load appointments
      const savedApps = JSON.parse(localStorage.getItem('my_appointments') || '[]')
      // Merge saved appointments with pre-seeded past completed appointments
      setAppointments([...savedApps, ...SEEDED_PAST_APPOINTMENTS])

      if (justBooked) {
        setToast('Đặt lịch khám chuyên khoa thành công! Đang chờ duyệt.')
      }
    }
  }, [user, justBooked])

  // Handle Cancel Appointment
  const handleCancelClick = (id: string) => {
    setCancelModalId(id)
  }

  const confirmCancel = () => {
    if (!cancelModalId) return
    const savedApps = JSON.parse(localStorage.getItem('my_appointments') || '[]')
    
    // Update local storage status
    const updatedLocal = savedApps.map((app: Appointment) => {
      if (app._id === cancelModalId) {
        return { ...app, status: 'cancelled' }
      }
      return app
    })
    localStorage.setItem('my_appointments', JSON.stringify(updatedLocal))

    // Update active component state
    setAppointments((prev) =>
      prev.map((app) => (app._id === cancelModalId ? { ...app, status: 'cancelled' } : app))
    )

    setCancelModalId(null)
    setToast('Đã hủy lịch hẹn thành công.')
  }

  // Handle Update Profile details
  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (user) {
      const updatedUser = {
        ...user,
        ho_ten: hoTen,
        so_dien_thoai: soDienThoai,
      }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setToast('Cập nhật hồ sơ thông tin cá nhân thành công.')
    }
  }

  if (authLoading || !user) {
    return null
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 space-y-6">
      <Breadcrumb items={[{ label: 'Hồ sơ bệnh nhân' }]} />

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* SIDEBAR TABS SELECTOR */}
        <div className="w-full lg:w-64 shrink-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4 text-left">
          <div className="space-y-1">
            <h2 className="font-bold text-slate-800 text-base">{user.ho_ten}</h2>
            <p className="text-xs text-slate-400 font-medium">Bệnh nhân chuyên khoa</p>
          </div>

          <div className="flex flex-col gap-1 border-t border-slate-50 pt-3">
            {[
              { key: 'appointments', label: '📅 Lịch hẹn của tôi' },
              { key: 'ehr', label: '📄 Bệnh án & Đơn thuốc' },
              { key: 'account', label: '👤 Thông tin cá nhân' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === tab.key
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN DISPLAY MODULE */}
        <div className="flex-1 w-full text-left">
          {/* TAB 1: MY APPOINTMENTS */}
          {activeTab === 'appointments' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Quản lý lịch hẹn</h3>
                <p className="text-xs text-slate-400">Theo dõi trạng thái các cuộc hẹn đã đăng ký khám tại cơ sở.</p>
              </div>

              <div className="space-y-4">
                {appointments.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-400 text-sm">
                    Bạn chưa có lịch hẹn khám nào.
                  </div>
                ) : (
                  appointments.map((app) => (
                    <div
                      key={app._id}
                      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-brand-100"
                    >
                      <div className="space-y-2 text-left">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Mã: {app._id.split('-').pop()?.toUpperCase()}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              app.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-600'
                                : app.status === 'confirmed'
                                ? 'bg-blue-50 text-blue-600'
                                : app.status === 'cancelled'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-amber-50 text-amber-600'
                            }`}
                          >
                            {app.status === 'completed'
                              ? 'Đã khám'
                              : app.status === 'confirmed'
                              ? 'Đã duyệt'
                              : app.status === 'cancelled'
                              ? 'Đã hủy'
                              : 'Chờ duyệt'}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          {app.ten_dich_vu || 'Khám lâm sàng Tai Mũi Họng'}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Bác sĩ phụ trách: <span className="font-semibold text-slate-700">{app.bac_si}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Thời gian: <span className="font-semibold text-brand-600">{app.gio_kham}</span>, ngày {app.ngay_kham}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 justify-between md:justify-end border-t md:border-t-0 border-slate-55 pt-3 md:pt-0">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Phí thanh toán</p>
                          <p className="text-sm font-extrabold text-slate-800">{app.gia_kham.toLocaleString('vi-VN')} đ</p>
                        </div>
                        {app.status === 'pending' && (
                          <Button
                            variant="secondary"
                            onClick={() => handleCancelClick(app._id)}
                            className="text-red-600 hover:bg-red-50 border-red-100 hover:text-red-700 text-xs px-3 py-1.5 font-bold"
                          >
                            Hủy lịch
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ELECTRONIC HEALTH RECORDS (EHR) */}
          {activeTab === 'ehr' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Lịch sử bệnh án & Đơn thuốc</h3>
                <p className="text-xs text-slate-400">Hồ sơ điện tử lưu trữ kết quả nội soi và phác đồ thuốc điều trị.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {appointments.filter((app) => app.status === 'completed').length === 0 ? (
                  <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-400 text-sm">
                    Chưa có bệnh án điện tử nào được lưu trữ.
                  </div>
                ) : (
                  appointments
                    .filter((app) => app.status === 'completed')
                    .map((app) => (
                      <div key={app._id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition space-y-4">
                        <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400">Ngày khám: {app.ngay_kham}</span>
                            <h4 className="font-bold text-slate-800 text-sm mt-0.5">{app.ten_dich_vu}</h4>
                          </div>
                          <span className="text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 text-[10px] font-bold">
                            Đã chẩn đoán
                          </span>
                        </div>

                        <div className="text-xs space-y-1.5 text-slate-500">
                          <p>
                            <span className="font-semibold text-slate-700">Chẩn đoán:</span> {app.chan_doan}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Bác sĩ:</span> {app.bac_si}
                          </p>
                        </div>

                        <button
                          onClick={() => setSelectedEHR(app)}
                          className="w-full btn-secondary text-center text-xs font-semibold py-2"
                        >
                          Xem chi tiết kết quả bệnh án
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT PROFILE INFO */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Cập nhật hồ sơ bệnh nhân</h3>
                <p className="text-xs text-slate-400">Thông tin hành chính dùng để liên hệ đặt lịch khám.</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Họ và tên bệnh nhân"
                    value={hoTen}
                    onChange={(e) => setHoTen(e.target.value)}
                    required
                  />
                  <Input
                    label="Số điện thoại liên hệ"
                    value={soDienThoai}
                    onChange={(e) => setSoDienThoai(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Địa chỉ email đăng ký"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled
                  />
                  <Input
                    label="Số bảo hiểm y tế (BHYT)"
                    value={insuranceCard}
                    onChange={(e) => setInsuranceCard(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Ngày sinh"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Giới tính</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white transition"
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-50 flex justify-end">
                  <Button type="submit">Lưu thay đổi</Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* EHR DETAILED RECORD MODAL */}
      {selectedEHR && (
        <Modal
          isOpen={!!selectedEHR}
          onClose={() => setSelectedEHR(null)}
          title="BỆNH ÁN ĐIỆN TỬ CHI TIẾT"
        >
          <div className="space-y-6 text-left text-sm text-slate-600 max-h-[80vh] overflow-y-auto pr-2">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
              <div>
                <h4 className="font-extrabold text-slate-800 text-base">{selectedEHR.ten_dich_vu}</h4>
                <p className="text-xs text-slate-400 mt-0.5">Mã bệnh án: {selectedEHR._id}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-800">{selectedEHR.bac_si}</p>
                <p className="text-[10px] text-slate-450">Ngày khám: {selectedEHR.ngay_kham}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chẩn đoán lâm sàng</span>
              <p className="bg-slate-50 p-3 rounded-lg text-slate-800 font-medium">
                {selectedEHR.chan_doan}
              </p>
            </div>

            {selectedEHR.don_thuoc && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đơn thuốc chỉ định</span>
                <ul className="list-decimal list-inside space-y-1 bg-slate-50 p-4 rounded-lg">
                  {selectedEHR.don_thuoc.map((thuoc, idx) => (
                    <li key={idx} className="text-slate-700">{thuoc}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedEHR.hinh_anh_noi_soi && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hình ảnh nội soi camera (EHR)</span>
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-w-md mx-auto">
                  <img src={selectedEHR.hinh_anh_noi_soi} alt="Hình ảnh nội soi Tai Mũi Họng" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* CONFIRM APPOINTMENT CANCEL MODAL */}
      {cancelModalId && (
        <Modal
          isOpen={!!cancelModalId}
          onClose={() => setCancelModalId(null)}
          title="XÁC NHẬN HỦY LỊCH HẸN"
        >
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600">
              Bạn có chắc chắn muốn hủy lịch hẹn khám Tai Mũi Họng này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="secondary" onClick={() => setCancelModalId(null)}>Đóng</Button>
              <Button variant="primary" className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmCancel}>Xác nhận hủy</Button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
