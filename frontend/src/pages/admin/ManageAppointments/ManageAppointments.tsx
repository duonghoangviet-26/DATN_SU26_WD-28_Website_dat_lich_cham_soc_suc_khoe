import { useCallback, useEffect, useState } from 'react'
import { appointmentService } from '@/services/appointment.service'
import type {
  AppointmentItem,
  AppointmentPagination,
  AppointmentStatus,
  AppointmentSummary,
} from '@/types'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'

import DoctorAppointmentGroupList from './DoctorAppointmentGroupList'
import AppointmentDetail from './AppointmentDetail'
import AddAppointment from './AddAppointment'
import RescheduleAppointment from './RescheduleAppointment'

type ViewMode = 'list' | 'add' | 'reschedule'

const EMPTY_SUMMARY: AppointmentSummary = {
  today: 0,
  pending: 0,
  confirmed: 0,
  completed: 0,
}

const EMPTY_PAGINATION: AppointmentPagination = {
  total: 0,
  totalPages: 1,
  page: 1,
}

export default function ManageAppointments() {
  const [view, setView] = useState<ViewMode>('list')
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [loading, setLoading] = useState(true)

  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [loaiKham, setLoaiKham] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<AppointmentPagination>(EMPTY_PAGINATION)
  const [summary, setSummary] = useState<AppointmentSummary>(EMPTY_SUMMARY)
  
  // Lưu data grouped khi view_mode = 'doctor_grouped'
  const [groupedAppointments, setGroupedAppointments] = useState<any[]>([])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<AppointmentItem | null>(null)
  const [rescheduleData, setRescheduleData] = useState<AppointmentItem | null>(null)

  const fetchAppointments = useCallback(async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await appointmentService.getAll({
        keyword,
        status,
        loai_kham: loaiKham,
        startDate,
        endDate,
        page: nextPage,
        limit: 10,
        view_mode: 'doctor_grouped' // Thêm cờ này để backend tự gom nhóm
      })
      // Khi view_mode=doctor_grouped, res.data là mảng các DoctorGroup
      setGroupedAppointments(res.data)
      setSummary(res.summary)
      // Không dùng pagination của backend cho chế độ grouped nữa (hoặc chỉ mang tính tham khảo)
    } finally {
      setLoading(false)
    }
  }, [endDate, keyword, loaiKham, page, startDate, status])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  async function handleCancel(appointment: AppointmentItem) {
    await appointmentService.cancel(appointment._id, 'Admin huy lich')
    await fetchAppointments()
  }

  async function handleRestore(appointment: AppointmentItem) {
    await appointmentService.restore(appointment._id)
    await fetchAppointments()
  }

  async function handleHardDelete(appointment: AppointmentItem) {
    await appointmentService.hardDelete(appointment._id)
    await fetchAppointments()
  }

  async function handleView(appointment: AppointmentItem) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const fullDetail = await appointmentService.getById(appointment._id)
      setDetail(fullDetail)
    } finally {
      setDetailLoading(false)
    }
  }

  function handleReschedule(appointment: AppointmentItem) {
    setRescheduleData(appointment)
    setView('reschedule')
  }

  function closeDetail() {
    setDetailOpen(false)
    setDetailLoading(false)
    setDetail(null)
  }

  return (
    <div>
      <PageHeader
        title="Lịch hẹn hệ thống"
        description="Xem toàn bộ lịch hẹn, theo dõi trạng thái và xử lý các vấn đề phát sinh."
      />

      {view === 'list' && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Lịch hẹn hôm nay', value: summary.today, iconBg: 'bg-purple-100', iconColor: 'text-purple-600', icon: 'calendar' },
              { label: 'Chờ xác nhận', value: summary.pending, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', icon: 'clock' },
              { label: 'Đã xác nhận', value: summary.confirmed, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: 'check' },
              { label: 'Hoàn thành', value: summary.completed, iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: 'star' },
            ].map((item) => (
              <div key={item.label} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    <p className="mt-1.5 text-2xl font-bold text-slate-800">{item.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                    <Icon name={item.icon} className={`h-6 w-6 ${item.iconColor}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card mb-4 flex flex-col justify-between gap-3 p-4 md:flex-row">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
                  <Icon name="search" className="h-4 w-4" />
                </span>
                <input
                  className="input w-full pl-9"
                  placeholder="Tìm bệnh nhân/bác sĩ..."
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <input
                type="date"
                className="input w-full"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
                title="Từ ngày"
              />
              <input
                type="date"
                className="input w-full"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
                title="Đến ngày"
              />
              <select
                className="input"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as AppointmentStatus | '')
                  setPage(1)
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </select>
              <select
                className="input"
                value={loaiKham}
                onChange={(e) => {
                  setLoaiKham(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Tất cả loại khám</option>
                <option value="clinic">Phòng khám</option>
                <option value="home">Tại nhà</option>
              </select>
            </div>
            <button
              onClick={() => setView('add')}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Icon name="plus" className="h-4 w-4" />
              Đặt lịch mới
            </button>
          </div>

          <DoctorAppointmentGroupList
            groupedAppointments={groupedAppointments}
            loading={loading}
            onView={handleView}
            onCancel={handleCancel}
            onReschedule={handleReschedule}
            onRestore={handleRestore}
            onHardDelete={handleHardDelete}
          />
        </>
      )}

      {view === 'add' && (
        <AddAppointment
          onCancel={() => setView('list')}
          onSaved={async () => {
            setView('list')
            setPage(1)
            await fetchAppointments(1)
          }}
        />
      )}

      {view === 'reschedule' && rescheduleData && (
        <RescheduleAppointment
          appointment={rescheduleData}
          onCancel={() => setView('list')}
          onSaved={async () => {
            setView('list')
            await fetchAppointments()
          }}
        />
      )}

      {detailOpen && (
        <AppointmentDetail detail={detail} loading={detailLoading} onClose={closeDetail} />
      )}
    </div>
  )
}
