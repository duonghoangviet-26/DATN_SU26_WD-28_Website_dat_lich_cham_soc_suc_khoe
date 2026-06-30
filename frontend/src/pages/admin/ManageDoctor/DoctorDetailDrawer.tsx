import { useState, useEffect } from 'react'
import { doctorService } from '@/services/doctor.service'
import type { DoctorDetailAPI, DoctorAuditLog, DoctorApproval, DoctorAppointmentHistory } from '@/types'
import { DOCTOR_APPROVAL_LABEL, APPOINTMENT_STATUS_LABEL } from '@/utils/constants'
import { formatPrice, formatDateTime, formatDate } from '@/utils/format'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'

const STATUS_COLOR: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'yellow', confirmed: 'blue', completed: 'green', cancelled: 'red',
}

const APPROVAL_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green', pending: 'yellow', rejected: 'red', suspended: 'gray',
}

const ACTION_LABEL_MAP: Record<string, string> = {
  APPROVE_DOCTOR: 'Đã duyệt hồ sơ',
  RESTORE_DOCTOR: 'Khôi phục tài khoản',
  REJECT_DOCTOR: 'Từ chối hồ sơ',
  SUSPEND_DOCTOR: 'Tạm ngưng tài khoản',
  UPDATE_INFO: 'Cập nhật thông tin',
}

interface Props {
  doctorId: string | null
  onClose: () => void
  onAction: (doc: DoctorDetailAPI, action: 'approve' | 'reject' | 'suspend' | 'restore') => void
}

export default function DoctorDetailDrawer({ doctorId, onClose, onAction }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'logs' | 'appointments'>('profile')
  const [loading, setLoading] = useState(false)
  const [doctor, setDoctor] = useState<DoctorDetailAPI | null>(null)
  const [logs, setLogs] = useState<DoctorAuditLog[]>([])

  // Appointments state
  const [appointments, setAppointments] = useState<DoctorAppointmentHistory[]>([])
  const [aptKeyword, setAptKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [aptPage, setAptPage] = useState(1)
  const [aptTotalPages, setAptTotalPages] = useState(1)
  const [aptLoading, setAptLoading] = useState(false)

  useEffect(() => {
    if (!doctorId) return
    let ignore = false

    async function load() {
      setLoading(true)
      try {
        const [docData, logsData] = await Promise.all([
          doctorService.getById(doctorId!),
          doctorService.getLogs(doctorId!)
        ])
        if (!ignore) {
          setDoctor(docData)
          setLogs(logsData)
        }
      } catch (err) {
        console.error('Failed to load doctor details', err)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => { ignore = true }
  }, [doctorId])

  useEffect(() => {
    if (!doctorId || activeTab !== 'appointments') return
    let ignore = false

    async function loadApts() {
      setAptLoading(true)
      try {
        const d = new Date()
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const { data, pagination } = await doctorService.getAppointments(doctorId!, {
          keyword: aptKeyword,
          page: aptPage,
          limit: 10,
          date: today,
          exclude_status: 'completed,cancelled'
        })
        if (!ignore) {
          setAppointments(data)
          setAptTotalPages(pagination.totalPages)
        }
      } catch (err) {
        console.error('Failed to load appointments', err)
      } finally {
        if (!ignore) setAptLoading(false)
      }
    }
    loadApts()
    return () => { ignore = true }
  }, [doctorId, activeTab, aptPage, aptKeyword])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAptPage(1)
    setAptKeyword(searchInput)
  }

  if (!doctorId) return null

  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/50 transition-opacity backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col h-full transform transition-transform">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
            <h2 className="text-xl font-bold text-slate-800">Chi tiết Bác sĩ</h2>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
            >
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>

          {loading || !doctor ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-400">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="px-6 border-b border-slate-100 flex gap-6 bg-slate-50/50">
                <button 
                  onClick={() => setActiveTab('profile')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'profile' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Thông tin hồ sơ
                </button>
                <button 
                  onClick={() => setActiveTab('logs')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'logs' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Lịch sử thao tác
                  <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">
                    {logs.length}
                  </span>
                </button>
                <button 
                  onClick={() => setActiveTab('appointments')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'appointments' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Ca khám hôm nay
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-start gap-5">
                      <img 
                        src={doctor.user_id.anh_dai_dien || 'https://ui-avatars.com/api/?name=' + doctor.user_id.ho_ten} 
                        alt="Avatar" 
                        className="w-20 h-20 rounded-full object-cover border border-slate-100 bg-slate-50"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold text-slate-800">{doctor.user_id.ho_ten}</h3>
                            <p className="text-sm text-slate-500">{doctor.user_id.email} • {doctor.user_id.so_dien_thoai || 'Chưa cập nhật SĐT'}</p>
                          </div>
                          <Badge color={APPROVAL_COLOR[doctor.trang_thai_duyet]}>
                            {DOCTOR_APPROVAL_LABEL[doctor.trang_thai_duyet]}
                          </Badge>
                        </div>
                        <div className="mt-3 flex gap-3 flex-wrap">
                          {doctor.specialties.map(spec => (
                            <span key={spec._id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                              <Icon name="stethoscope" className="w-3.5 h-3.5" />
                              {spec.ten}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                        <p className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-wider">Lịch hẹn tổng</p>
                        <p className="text-2xl font-bold text-slate-800">{doctor.thong_ke.tong_lich_hen}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                        <p className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-wider">Sắp tới</p>
                        <p className="text-2xl font-bold text-brand-600">{doctor.thong_ke.lich_hen_sap_toi}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                        <p className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-wider">Đánh giá</p>
                        <div className="flex items-center justify-center gap-1">
                          <Icon name="star" className="w-5 h-5 text-amber-400" />
                          <span className="text-2xl font-bold text-slate-800">{doctor.diem_danh_gia.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Professional Info */}
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide border-b border-slate-100 pb-2">Hồ sơ chuyên môn</h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Kinh nghiệm</p>
                          <p className="font-medium text-slate-800">{doctor.so_nam_kinh_nghiem} năm</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Phí tư vấn cơ bản</p>
                          <p className="font-medium text-brand-600">{formatPrice(doctor.phi_tu_van)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-slate-400 text-xs mb-1">Bằng cấp</p>
                          <p className="text-slate-700 whitespace-pre-wrap">{doctor.bang_cap || '—'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-slate-400 text-xs mb-1">Tiểu sử / Chuyên môn chi tiết</p>
                          <p className="text-slate-700 whitespace-pre-wrap">{doctor.tieu_su || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    {doctor.services.length > 0 && (
                      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide border-b border-slate-100 pb-2">Dịch vụ cung cấp</h4>
                        <ul className="divide-y divide-slate-100">
                          {doctor.services.map(srv => (
                            <li key={srv._id} className="py-3 flex justify-between items-center">
                              <div>
                                <p className="font-medium text-slate-800 text-sm">{srv.ten}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{srv.thoi_gian_phut} phút • {srv.loai === 'home' ? 'Tại nhà' : srv.loai === 'video' ? 'Video' : 'Phòng khám'}</p>
                              </div>
                              <span className="font-semibold text-brand-600 text-sm">{formatPrice(srv.gia)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'logs' && (
                  <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[19px] before:w-[2px] before:bg-slate-100 pl-2">
                    {logs.length === 0 ? (
                      <p className="text-slate-500 text-center py-10">Chưa có lịch sử thao tác nào.</p>
                    ) : (
                      logs.map(log => {
                        const isApprove = log.hanh_dong === 'APPROVE_DOCTOR' || log.hanh_dong === 'RESTORE_DOCTOR'
                        const isReject = log.hanh_dong === 'REJECT_DOCTOR'
                        const isSuspend = log.hanh_dong === 'SUSPEND_DOCTOR'
                        
                        let icon = 'check'
                        let bg = 'bg-green-100 text-green-600'
                        if (isReject) { icon = 'x'; bg = 'bg-red-100 text-red-600' }
                        if (isSuspend) { icon = 'ban'; bg = 'bg-slate-200 text-slate-600' }

                        return (
                          <div key={log._id} className="relative pl-10 pt-2 pb-4">
                            <span className={`absolute left-0 top-3 w-[26px] h-[26px] rounded-full flex items-center justify-center ring-4 ring-white ${bg}`}>
                              <Icon name={icon as any} className="w-3.5 h-3.5" />
                            </span>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-semibold text-slate-800 text-sm">
                                    {ACTION_LABEL_MAP[log.hanh_dong] || log.hanh_dong}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">Bởi: {log.nguoi_thuc_hien_id?.ho_ten || 'Admin ẩn'}</p>
                                </div>
                                <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(log.ngay_tao)}</span>
                              </div>
                              {log.ly_do && (
                                <div className="mt-2 text-sm bg-slate-50 p-2.5 rounded text-slate-700 border border-slate-100">
                                  <strong>Lý do:</strong> {log.ly_do}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}

                {activeTab === 'appointments' && (
                  <div className="space-y-4">
                    <form onSubmit={handleSearch} className="flex gap-3 mb-4">
                      <div className="relative flex-1">
                        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Tìm theo tên hoặc SĐT bệnh nhân..." 
                          className="input w-full pl-9 bg-white"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn-primary whitespace-nowrap px-6">
                        Tìm kiếm
                      </button>
                    </form>

                    <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50/80 text-left text-slate-500 border-b border-slate-100">
                            <tr>
                              <th className="px-5 py-3 font-medium whitespace-nowrap">Bệnh nhân</th>
                              <th className="px-5 py-3 font-medium whitespace-nowrap">Lịch khám</th>
                              <th className="px-5 py-3 font-medium whitespace-nowrap">Loại khám</th>
                              <th className="px-5 py-3 font-medium whitespace-nowrap">Trạng thái</th>
                              <th className="px-5 py-3 font-medium whitespace-nowrap text-right">Phí</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {aptLoading ? (
                              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Đang tải lịch sử...</td></tr>
                            ) : appointments.length === 0 ? (
                              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Không tìm thấy lịch khám nào.</td></tr>
                            ) : (
                              appointments.map(apt => (
                                <tr key={apt._id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-5 py-3">
                                    <p className="font-semibold text-slate-800 whitespace-nowrap">{apt.patient_name || 'Khách'}</p>
                                    {apt.patient_phone && <p className="text-xs text-slate-500">{apt.patient_phone}</p>}
                                  </td>
                                  <td className="px-5 py-3 whitespace-nowrap">
                                    <p className="text-slate-800">{formatDate(apt.ngay_kham)}</p>
                                    <p className="text-xs font-medium text-brand-600">{apt.gio_kham}</p>
                                  </td>
                                  <td className="px-5 py-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                                      apt.loai_kham === 'home' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      <Icon name={apt.loai_kham === 'home' ? 'home' : 'map-pin'} className="w-3 h-3" />
                                      {apt.loai_kham === 'home' ? 'Tại nhà' : 'Phòng khám'}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 whitespace-nowrap">
                                    <Badge color={STATUS_COLOR[apt.status] || 'gray'}>
                                      {APPOINTMENT_STATUS_LABEL[apt.status] || apt.status}
                                    </Badge>
                                  </td>
                                  <td className="px-5 py-3 whitespace-nowrap text-right font-medium text-slate-700">
                                    {formatPrice(apt.gia_kham)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Pagination */}
                    {!aptLoading && appointments.length > 0 && (
                      <div className="flex items-center justify-between mt-4 px-1">
                        <p className="text-sm text-slate-500">Trang {aptPage} / {aptTotalPages}</p>
                        {aptTotalPages > 1 && (
                          <div className="flex gap-2">
                            <button 
                              disabled={aptPage === 1} 
                              onClick={() => setAptPage(p => p - 1)}
                              className="px-3 py-1.5 border border-slate-200 rounded text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                              Trước
                            </button>
                            <button 
                              disabled={aptPage === aptTotalPages} 
                              onClick={() => setAptPage(p => p + 1)}
                              className="px-3 py-1.5 border border-slate-200 rounded text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                              Sau
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                {doctor.trang_thai_duyet === 'pending' && (
                  <>
                    <button onClick={() => { onClose(); onAction(doctor, 'reject') }} className="btn-danger bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Từ chối</button>
                    <button onClick={() => { onClose(); onAction(doctor, 'approve') }} className="btn-primary">Duyệt hồ sơ</button>
                  </>
                )}
                {(doctor.trang_thai_duyet === 'suspended' || doctor.trang_thai_duyet === 'rejected') && (
                  <button onClick={() => { onClose(); onAction(doctor, 'restore') }} className="btn-primary">Khôi phục</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
