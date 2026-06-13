import { useEffect, useState } from 'react'
import { appointmentService } from '@/services/appointment.service'
import type { AppointmentItem, AppointmentStatus } from '@/types'
import { APPOINTMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL, SERVICE_TYPE_LABEL } from '@/utils/constants'
import { formatPrice } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'

const STATUS_COLOR: Record<AppointmentStatus, 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow', confirmed: 'blue', completed: 'green', cancelled: 'red',
}

const PAYMENT_COLOR: Record<string, 'yellow' | 'green' | 'gray'> = {
  unpaid: 'yellow', paid: 'green', refunded: 'gray',
}

export default function ManageAppointments() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [loading, setLoading] = useState(true)

  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [loaiKham, setLoaiKham] = useState('')

  const [confirmItem, setConfirmItem] = useState<AppointmentItem | null>(null)
  const [detail, setDetail] = useState<AppointmentItem | null>(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    appointmentService.getAll({ keyword, status, loai_kham: loaiKham }).then((data) => {
      if (!ignore) setAppointments(data)
    }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [keyword, status, loaiKham])

  const todayStr = new Date().toISOString().slice(0, 10)
  const counts = {
    today: appointments.filter((a) => a.ngay_kham === todayStr).length,
    pending: appointments.filter((a) => a.status === 'pending').length,
    confirmed: appointments.filter((a) => a.status === 'confirmed').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
  }

  async function handleCancel() {
    if (!confirmItem) return
    const id = confirmItem.id
    setConfirmItem(null)
    const updated = await appointmentService.cancel(id)
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  return (
    <div>
      <PageHeader
        title="Lịch hẹn hệ thống"
        description="Xem toàn bộ lịch hẹn, theo dõi trạng thái và xử lý các vấn đề phát sinh."
      />

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
      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              className="input pl-9"
              placeholder="Tìm bệnh nhân hoặc bác sĩ..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus | '')}>
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select className="input" value={loaiKham} onChange={(e) => setLoaiKham(e.target.value)}>
            <option value="">Tất cả loại khám</option>
            <option value="clinic">Phòng khám</option>
            <option value="video">Video</option>
            <option value="home">Tại nhà</option>
          </select>
        </div>
      </div>

      {/* Bảng lịch hẹn */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Bệnh nhân</th>
                <th className="px-4 py-3 font-medium">Bác sĩ</th>
                <th className="px-4 py-3 font-medium">Ngày — Giờ</th>
                <th className="px-4 py-3 font-medium">Loại khám</th>
                <th className="px-4 py-3 font-medium">Giá</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Thanh toán</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
              ) : appointments.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Không tìm thấy lịch hẹn.</td></tr>
              ) : appointments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.benh_nhan}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{a.bac_si}</p>
                    <p className="text-xs text-slate-400">{a.chuyen_khoa}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{a.ngay_kham}</p>
                    <p className="text-xs text-slate-400">{a.gio_kham}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={a.loai_kham === 'clinic' ? 'blue' : a.loai_kham === 'video' ? 'green' : 'yellow'}>
                      {SERVICE_TYPE_LABEL[a.loai_kham]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{formatPrice(a.gia_kham)}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={PAYMENT_COLOR[a.payment_status]}>{PAYMENT_STATUS_LABEL[a.payment_status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setDetail(a)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <Icon name="eye" className="h-3 w-3" /> Xem
                      </button>
                      {(a.status === 'pending' || a.status === 'confirmed') && (
                        <button
                          onClick={() => setConfirmItem(a)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                        >
                          <Icon name="x" className="h-3 w-3" /> Hủy
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && (
        <p className="mt-3 text-sm text-slate-500">Tổng cộng {appointments.length} lịch hẹn</p>
      )}

      {/* Modal chi tiết */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Chi tiết lịch hẹn #{detail.id}</h3>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-700">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                ['Bệnh nhân', detail.benh_nhan],
                ['Bác sĩ', `${detail.bac_si} — ${detail.chuyen_khoa}`],
                ['Ngày khám', `${detail.ngay_kham} lúc ${detail.gio_kham}`],
                ['Loại khám', SERVICE_TYPE_LABEL[detail.loai_kham]],
                ['Phí khám', formatPrice(detail.gia_kham)],
                ['Trạng thái', APPOINTMENT_STATUS_LABEL[detail.status]],
                ['Thanh toán', PAYMENT_STATUS_LABEL[detail.payment_status]],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-800 text-right">{value}</dd>
                </div>
              ))}
            </dl>
            <button onClick={() => setDetail(null)} className="btn-secondary mt-6 w-full">Đóng</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmItem}
        danger
        title="Hủy lịch hẹn"
        message={`Xác nhận hủy lịch hẹn của "${confirmItem?.benh_nhan}" với ${confirmItem?.bac_si}?`}
        confirmText="Hủy lịch"
        onConfirm={handleCancel}
        onCancel={() => setConfirmItem(null)}
      />
    </div>
  )
}
