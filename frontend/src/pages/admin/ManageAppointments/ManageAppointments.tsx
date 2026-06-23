import { useEffect, useState } from 'react'
import { appointmentService } from '@/services/appointment.service'
import type { AppointmentItem, AppointmentStatus } from '@/types'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'

import AppointmentList from './AppointmentList'
import AppointmentDetail from './AppointmentDetail'
import AddAppointment from './AddAppointment'
import RescheduleAppointment from './RescheduleAppointment'

type ViewMode = 'list' | 'add' | 'reschedule'

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
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })

  const [detail, setDetail] = useState<AppointmentItem | null>(null)
  const [rescheduleData, setRescheduleData] = useState<AppointmentItem | null>(null)

  function fetchAppointments() {
    setLoading(true)
    appointmentService.getAll({ keyword, status, loai_kham: loaiKham, startDate, endDate, page, limit: 10 })
      .then((res) => {
        setAppointments(res.data)
        setPagination(res.pagination)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAppointments()
  }, [keyword, status, loaiKham, startDate, endDate, page])

  const todayStr = new Date().toISOString().slice(0, 10)
  const counts = {
    today: appointments.filter((a) => a.ngay_kham === todayStr).length,
    pending: appointments.filter((a) => a.status === 'pending').length,
    confirmed: appointments.filter((a) => a.status === 'confirmed').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
  }

  async function handleCancel(a: AppointmentItem) {
    const updated = await appointmentService.cancel(a._id, 'Admin hủy lịch')
    setAppointments((prev) => prev.map((item) => (item._id === updated._id ? updated : item)))
  }

  function handleReschedule(a: AppointmentItem) {
    setRescheduleData(a)
    setView('reschedule')
  }

  return (
    <div>
      <PageHeader
        title="Lịch hẹn hệ thống"
        description="Xem toàn bộ lịch hẹn, theo dõi trạng thái và xử lý các vấn đề phát sinh."
      />

      {view === 'list' && (
        <>
          {/* Thẻ thống kê */}
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Lịch hẹn hôm nay', value: counts.today, iconBg: 'bg-purple-100', iconColor: 'text-purple-600', icon: 'calendar' },
              { label: 'Chờ xác nhận', value: counts.pending, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', icon: 'clock' },
              { label: 'Đã xác nhận', value: counts.confirmed, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: 'check' },
              { label: 'Hoàn thành', value: counts.completed, iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: 'star' },
            ].map((s) => (
              <div key={s.label} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500">{s.label}</p>
                    <p className="mt-1.5 text-2xl font-bold text-slate-800">{s.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
                    <Icon name={s.icon} className={`h-6 w-6 ${s.iconColor}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bộ lọc */}
          <div className="card mb-4 p-4 flex flex-col md:flex-row gap-3 justify-between">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 flex-1">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
                  <Icon name="search" className="h-4 w-4" />
                </span>
                <input
                  className="input pl-9 w-full"
                  placeholder="Tìm bệnh nhân/bác sĩ..."
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
                />
              </div>
              <input 
                type="date" 
                className="input w-full" 
                value={startDate} 
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }} 
                title="Từ ngày"
              />
              <input 
                type="date" 
                className="input w-full" 
                value={endDate} 
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }} 
                title="Đến ngày"
              />
              <select className="input" value={status} onChange={(e) => { setStatus(e.target.value as AppointmentStatus | ''); setPage(1) }}>
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </select>
              <select className="input" value={loaiKham} onChange={(e) => { setLoaiKham(e.target.value); setPage(1) }}>
                <option value="">Tất cả loại khám</option>
                <option value="clinic">Phòng khám</option>
                <option value="home">Tại nhà</option>
              </select>
            </div>
            <button
              onClick={() => setView('add')}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 shrink-0"
            >
              <Icon name="plus" className="h-4 w-4" />
              Đặt lịch mới
            </button>
          </div>

          <AppointmentList
            appointments={appointments}
            loading={loading}
            onView={setDetail}
            onCancel={handleCancel}
            onReschedule={handleReschedule}
          />
          {!loading && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Hiển thị trang {pagination.page}/{pagination.totalPages} (Tổng {pagination.total} lịch hẹn)
              </p>
              <div className="flex gap-2">
                <button 
                  disabled={page <= 1} 
                  onClick={() => setPage(page - 1)}
                  className="btn-secondary px-3 py-1"
                >
                  Trước
                </button>
                <button 
                  disabled={page >= pagination.totalPages} 
                  onClick={() => setPage(page + 1)}
                  className="btn-secondary px-3 py-1"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'add' && (
        <AddAppointment 
          onCancel={() => setView('list')}
          onSaved={() => {
            setView('list')
            setPage(1)
            fetchAppointments()
          }}
        />
      )}

      {view === 'reschedule' && rescheduleData && (
        <RescheduleAppointment 
          appointment={rescheduleData}
          onCancel={() => setView('list')}
          onSaved={() => {
            setView('list')
            fetchAppointments()
          }}
        />
      )}

      {detail && (
        <AppointmentDetail detail={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
