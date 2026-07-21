import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { nurseService } from '@/services/nurse.service'
import type { NurseQueueItem, AppointmentStatus, KetQuaKhamStatus } from '@/types'
import { APPOINTMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/utils/constants'
import { formatDate } from '@/utils/format'

const STATUS_COLOR: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  confirmed: 'blue', checked_in: 'blue', in_progress: 'yellow',
  waiting_record: 'yellow', waiting_doctor_confirm: 'yellow', completed: 'green',
  cancelled: 'red', no_show: 'red', skipped: 'gray', pending: 'gray',
}

const PAYMENT_COLOR: Record<string, 'yellow' | 'blue' | 'gray'> = {
  unpaid: 'yellow', partial: 'yellow', paid: 'blue', refunded: 'gray',
}

const KET_QUA_LABEL: Record<KetQuaKhamStatus, string> = {
  ban_nhap: 'Nháp', cho_xac_nhan: 'Chờ xác nhận', da_xac_nhan: 'Đã xác nhận', yeu_cau_chinh_sua: 'Cần sửa',
}
const KET_QUA_COLOR: Record<KetQuaKhamStatus, 'yellow' | 'green' | 'red' | 'gray'> = {
  ban_nhap: 'gray', cho_xac_nhan: 'yellow', da_xac_nhan: 'green', yeu_cau_chinh_sua: 'red',
}

const TH = 'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'
const LIMIT = 20

// Ngày LOCAL (tránh lệch múi giờ khi dùng toISOString UTC).
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function NurseQueue() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const todayStr = localToday()

  const [items, setItems] = useState<NurseQueueItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Nhận bộ lọc ban đầu từ URL (điều hướng từ trang Ca làm việc / thẻ Dashboard).
  const [filterDate, setFilterDate] = useState(searchParams.get('date') || todayStr)
  const [filterStatus, setFilterStatus] = useState<'' | AppointmentStatus>((searchParams.get('status') as AppointmentStatus) || '')
  const [searchInput, setSearchInput] = useState('')
  const [appliedQ, setAppliedQ] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(false)
    nurseService.getQueue({ date: filterDate, status: filterStatus, q: appliedQ, page, limit: LIMIT })
      .then((res) => { setItems(res.items); setTotal(res.total) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [filterDate, filterStatus, appliedQ, page])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  function changeDate(v: string) { setFilterDate(v); setPage(1) }
  function changeStatus(v: '' | AppointmentStatus) { setFilterStatus(v); setPage(1) }
  function submitSearch(e: React.FormEvent) { e.preventDefault(); setAppliedQ(searchInput.trim()); setPage(1) }
  function resetFilters() {
    setFilterDate(todayStr); setFilterStatus(''); setSearchInput(''); setAppliedQ(''); setPage(1)
  }

  return (
    <div>
      <PageHeader
        title="Hàng đợi bệnh nhân"
        description="Bệnh nhân thuộc ca bạn phụ trách — sắp theo giờ hẹn."
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Ngày</label>
          <input type="date" value={filterDate} onChange={(e) => changeDate(e.target.value)} className="input w-auto" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Trạng thái</label>
          <select
            value={filterStatus}
            onChange={(e) => changeStatus(e.target.value as '' | AppointmentStatus)}
            className="input w-auto min-w-[170px]"
          >
            <option value="">Tất cả</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="checked_in">Đã check-in</option>
            <option value="in_progress">Đang khám</option>
            <option value="waiting_record">Chờ nhập hồ sơ</option>
            <option value="waiting_doctor_confirm">Chờ bác sĩ xác nhận</option>
            <option value="completed">Hoàn thành</option>
            <option value="skipped">Bỏ lượt</option>
          </select>
        </div>
        <form onSubmit={submitSearch} className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Tìm kiếm</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tên bệnh nhân / mã lịch hẹn"
              className="input w-auto min-w-[220px]"
            />
          </div>
          <button type="submit" className="btn-secondary text-sm">Tìm</button>
        </form>
        <button onClick={resetFilters} className="btn-secondary text-sm">Đặt lại</button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được hàng đợi. Vui lòng thử lại sau.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className={TH}>Giờ hẹn</th>
                  <th className={TH}>Bệnh nhân</th>
                  <th className={TH}>Tuổi/Giới tính</th>
                  <th className={TH}>Bác sĩ</th>
                  <th className={TH}>Thanh toán</th>
                  <th className={TH}>Trạng thái</th>
                  <th className={TH}>Hồ sơ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Icon name="calendar" className="h-10 w-10 text-slate-200" />
                        <p className="text-base font-medium text-slate-500">Không có bệnh nhân nào khớp bộ lọc.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => navigate(`/nurse/appointments/${q.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{q.gio_kham}</div>
                        <div className="text-xs text-slate-400">{formatDate(q.ngay_kham)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{q.benh_nhan}</p>
                        <p className="text-xs text-slate-400">{q.ma_lich_hen ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {q.tuoi !== undefined || q.gioi_tinh
                          ? [q.tuoi !== undefined ? `${q.tuoi} tuổi` : null, q.gioi_tinh ?? null].filter(Boolean).join(' · ')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{q.bac_si ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge color={PAYMENT_COLOR[q.payment_status]}>{PAYMENT_STATUS_LABEL[q.payment_status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={STATUS_COLOR[q.status] ?? 'gray'}>{APPOINTMENT_STATUS_LABEL[q.status] ?? q.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {q.da_co_ket_qua && q.ket_qua_status
                          ? <Badge color={KET_QUA_COLOR[q.ket_qua_status]}>{KET_QUA_LABEL[q.ket_qua_status]}</Badge>
                          : <span className="text-xs text-slate-400">Chưa nhập</span>}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/nurse/appointments/${q.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          <Icon name="eye" className="h-3 w-3" /> Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {total > LIMIT && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-500">Trang {page}/{totalPages} · {total} lịch</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary text-sm disabled:opacity-40"
                >← Trước</button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn-secondary text-sm disabled:opacity-40"
                >Sau →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
