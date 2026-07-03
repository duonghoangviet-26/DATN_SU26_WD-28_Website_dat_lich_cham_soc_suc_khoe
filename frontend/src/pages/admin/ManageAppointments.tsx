import { useEffect, useState } from 'react'
import { appointmentService } from '@/services/appointment.service'
import { doctorService } from '@/services/doctor.service'
import type { AppointmentItem, AppointmentStatus, DoctorProfile } from '@/types'
import { APPOINTMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL, EXAM_TYPE_LABEL } from '@/utils/constants'
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
  const [completeItem, setCompleteItem] = useState<AppointmentItem | null>(null)
  const [detail, setDetail] = useState<AppointmentItem | null>(null)
  const [assignItem, setAssignItem] = useState<AppointmentItem | null>(null)
  const [resultItem, setResultItem] = useState<AppointmentItem | null>(null)
  const [homeStaff, setHomeStaff] = useState<DoctorProfile[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    appointmentService.getAll({ keyword, status, loai_kham: loaiKham }).then((data) => {
      if (!ignore) setAppointments(data)
    }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [keyword, status, loaiKham])

  useEffect(() => {
    // Nhân viên lấy mẫu tại nhà — dùng cho modal "Gán nhân viên"
    doctorService.getAll('approved').then((list) => {
      setHomeStaff(list.filter((d) => d.loai === 'home_staff'))
    })
  }, [])

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
    await appointmentService.cancel(String(id))
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'cancelled' as const } : a))
  }

  async function handleComplete() {
    if (!completeItem) return
    const id = completeItem.id
    setCompleteItem(null)
    await appointmentService.complete(String(id))
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'completed' as const } : a))
  }

  async function handleAssignStaff() {
    if (!assignItem || !selectedStaffId) return
    const staff = homeStaff.find((s) => String(s.id) === selectedStaffId)
    if (!staff) return
    setActionLoading(true)
    try {
      const updated = await appointmentService.assignHomeStaff(String(assignItem.id), staff.ho_ten, staff.chuyen_khoa)
      setAppointments((prev) => prev.map((a) => a.id === assignItem.id ? { ...a, ...updated } : a))
      setAssignItem(null)
      setSelectedStaffId('')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUploadResult() {
    if (!resultItem || !resultUrl.trim()) return
    setActionLoading(true)
    try {
      const updated = await appointmentService.uploadResult(String(resultItem.id), resultUrl.trim())
      setAppointments((prev) => prev.map((a) => a.id === resultItem.id ? { ...a, ...updated } : a))
      setResultItem(null)
      setResultUrl('')
    } finally {
      setActionLoading(false)
    }
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
                    {a.bac_si ? (
                      <>
                        <p className="text-slate-700">{a.bac_si}</p>
                        <p className="text-xs text-slate-400">{a.chuyen_khoa}</p>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                        Chưa gán nhân viên
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{a.ngay_kham}</p>
                    <p className="text-xs text-slate-400">{a.gio_kham}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={a.loai_kham === 'clinic' ? 'blue' : 'yellow'}>
                      {EXAM_TYPE_LABEL[a.loai_kham]}
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
                      {a.loai_kham === 'home' && a.status === 'pending' && (
                        <button
                          onClick={() => setAssignItem(a)}
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-600 transition-colors hover:bg-purple-100"
                        >
                          <Icon name="user" className="h-3 w-3" /> Gán nhân viên
                        </button>
                      )}
                      {a.loai_kham === 'home' && a.status === 'confirmed' && (
                        <button
                          onClick={() => setResultItem(a)}
                          className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600 transition-colors hover:bg-green-100"
                        >
                          <Icon name="file-text" className="h-3 w-3" /> Nhập kết quả
                        </button>
                      )}
                      {a.loai_kham === 'clinic' && a.status === 'confirmed' && (
                        <button
                          onClick={() => setCompleteItem(a)}
                          className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600 transition-colors hover:bg-green-100"
                        >
                          <Icon name="check" className="h-3 w-3" /> Hoàn thành
                        </button>
                      )}
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
                [detail.loai_kham === 'home' ? 'Nhân viên lấy mẫu' : 'Bác sĩ', detail.bac_si ? `${detail.bac_si}${detail.chuyen_khoa ? ` — ${detail.chuyen_khoa}` : ''}` : 'Chưa gán nhân viên'],
                ['Ngày khám', `${detail.ngay_kham} lúc ${detail.gio_kham}`],
                ['Loại khám', EXAM_TYPE_LABEL[detail.loai_kham]],
                ['Phí khám', formatPrice(detail.gia_kham)],
                ['Trạng thái', APPOINTMENT_STATUS_LABEL[detail.status]],
                ['Thanh toán', PAYMENT_STATUS_LABEL[detail.payment_status]],
                ...(detail.loai_kham === 'home' ? [['Kết quả xét nghiệm', detail.ket_qua_url ?? 'Chưa có']] : []),
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
        message={
          confirmItem?.bac_si
            ? `Xác nhận hủy lịch hẹn của "${confirmItem?.benh_nhan}" với ${confirmItem?.bac_si}?`
            : `Xác nhận hủy lịch hẹn của "${confirmItem?.benh_nhan}"?`
        }
        confirmText="Hủy lịch"
        onConfirm={handleCancel}
        onCancel={() => setConfirmItem(null)}
      />

      <ConfirmDialog
        open={!!completeItem}
        title="Đánh dấu hoàn thành"
        message={`Xác nhận lịch hẹn của "${completeItem?.benh_nhan}" với ${completeItem?.bac_si} đã khám xong?`}
        confirmText="Hoàn thành"
        onConfirm={handleComplete}
        onCancel={() => setCompleteItem(null)}
      />

      {/* Modal gán nhân viên lấy mẫu — chỉ cho home + pending */}
      {assignItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold text-slate-800">Gán nhân viên lấy mẫu</h3>
            <p className="mb-4 text-sm text-slate-500">
              Lịch hẹn của "{assignItem.benh_nhan}" — {assignItem.ten_dich_vu}
            </p>
            {homeStaff.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có nhân viên lấy mẫu nào được duyệt.</p>
            ) : (
              <select
                className="input w-full"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="">-- Chọn nhân viên --</option>
                {homeStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.ho_ten}</option>
                ))}
              </select>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => { setAssignItem(null); setSelectedStaffId('') }}
                className="btn-secondary"
              >
                Đóng
              </button>
              <button
                onClick={handleAssignStaff}
                disabled={!selectedStaffId || actionLoading}
                className="btn-primary disabled:opacity-40"
              >
                {actionLoading ? 'Đang lưu...' : 'Xác nhận gán'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nhập kết quả xét nghiệm — chỉ cho home + confirmed */}
      {resultItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold text-slate-800">Nhập kết quả xét nghiệm</h3>
            <p className="mb-4 text-sm text-slate-500">
              Lịch hẹn của "{resultItem.benh_nhan}" — {resultItem.ten_dich_vu}
            </p>
            <label className="input-label">Link file PDF kết quả</label>
            <input
              className="input w-full"
              placeholder="https://..."
              value={resultUrl}
              onChange={(e) => setResultUrl(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Sau khi lưu, lịch hẹn sẽ chuyển sang "Hoàn thành" và bệnh nhân nhận được thông báo.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => { setResultItem(null); setResultUrl('') }}
                className="btn-secondary"
              >
                Đóng
              </button>
              <button
                onClick={handleUploadResult}
                disabled={!resultUrl.trim() || actionLoading}
                className="btn-primary disabled:opacity-40"
              >
                {actionLoading ? 'Đang lưu...' : 'Lưu kết quả'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
