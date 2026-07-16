import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Toast from '@/components/common/Toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import { doctorLeaveService } from '@/services/doctor-leave.service'
import type { DoctorLeaveRequest } from '@/types'
import { formatDate, toLocalDateStr } from '@/utils/format'
import { DOCTOR_LEAVE_STATUS_COLOR } from '@/utils/constants'

const STATUS_LABEL: Record<DoctorLeaveRequest['trang_thai'], string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_huy: 'Đã hủy',
}

// Header bảng: đồng bộ với DoctorAppointments.tsx / DoctorPendingRecords.tsx.
const TH = 'px-4 py-3 text-xs font-semibold text-slate-600'

function khungGioLabel(r: DoctorLeaveRequest): string {
  return r.gio_bat_dau && r.gio_ket_thuc ? `${r.gio_bat_dau} – ${r.gio_ket_thuc}` : 'Cả ngày'
}

const STATUS_FILTER_OPTIONS: { value: '' | DoctorLeaveRequest['trang_thai']; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'cho_duyet', label: 'Chờ duyệt' },
  { value: 'da_duyet', label: 'Đã duyệt' },
  { value: 'tu_choi', label: 'Từ chối' },
  { value: 'da_huy', label: 'Đã hủy' },
]

// ─── Modal tạo yêu cầu nghỉ mới ────────────────────────────────────────────────
function CreateLeaveModal({
  submitting,
  onSubmit,
  onClose,
}: {
  submitting: boolean
  onSubmit: (data: { ngay: string; ly_do: string; gio_bat_dau: string | null; gio_ket_thuc: string | null }) => void
  onClose: () => void
}) {
  const today = toLocalDateStr()
  const [ngay, setNgay] = useState(today)
  const [caLoai, setCaLoai] = useState<'ca_ngay' | 'khung_gio'>('ca_ngay')
  const [gioBatDau, setGioBatDau] = useState('08:00')
  const [gioKetThuc, setGioKetThuc] = useState('12:00')
  const [lyDo, setLyDo] = useState('')

  const gioHopLe = caLoai === 'ca_ngay' || gioKetThuc > gioBatDau
  const canSubmit = !!ngay && !!lyDo.trim() && gioHopLe

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit({
      ngay,
      ly_do: lyDo.trim(),
      gio_bat_dau: caLoai === 'khung_gio' ? gioBatDau : null,
      gio_ket_thuc: caLoai === 'khung_gio' ? gioKetThuc : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-semibold text-slate-800">Gửi yêu cầu nghỉ mới</h2>
        <p className="mt-0.5 text-sm text-slate-500">Yêu cầu sẽ được gửi tới Admin duyệt.</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="input-label">
              Ngày nghỉ <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              className="input mt-1"
              min={today}
              value={ngay}
              onChange={(e) => setNgay(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="input-label">
              Ca nghỉ <span className="text-red-400">*</span>
            </label>
            <div className="mt-1 flex gap-4 text-sm text-slate-600">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={caLoai === 'ca_ngay'}
                  onChange={() => setCaLoai('ca_ngay')}
                  disabled={submitting}
                />
                Cả ngày
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={caLoai === 'khung_gio'}
                  onChange={() => setCaLoai('khung_gio')}
                  disabled={submitting}
                />
                Khung giờ cụ thể
              </label>
            </div>
            {caLoai === 'khung_gio' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  className="input"
                  value={gioBatDau}
                  onChange={(e) => setGioBatDau(e.target.value)}
                  disabled={submitting}
                />
                <span className="text-slate-400">–</span>
                <input
                  type="time"
                  className="input"
                  value={gioKetThuc}
                  onChange={(e) => setGioKetThuc(e.target.value)}
                  disabled={submitting}
                />
              </div>
            )}
            {caLoai === 'khung_gio' && !gioHopLe && (
              <p className="mt-1 text-xs text-red-500">Giờ kết thúc phải sau giờ bắt đầu.</p>
            )}
          </div>

          <div>
            <label className="input-label">
              Lý do <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              className="input mt-1 resize-none"
              placeholder="VD: Có việc gia đình đột xuất..."
              value={lyDo}
              onChange={(e) => setLyDo(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>Đóng</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="btn-primary disabled:opacity-40"
          >
            {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DoctorLeaveRequests() {
  const [requests, setRequests] = useState<DoctorLeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Bộ lọc — thuần client-side, doctorLeaveService.list() đã trả toàn bộ lịch sử của bác sĩ.
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | DoctorLeaveRequest['trang_thai']>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
  }

  function loadRequests() {
    setLoading(true)
    setError(false)
    doctorLeaveService.list()
      .then(setRequests)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(loadRequests, [])

  const hasFilter = !!(search || statusFilter || fromDate || toDate)

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return requests.filter((r) => {
      if (statusFilter && r.trang_thai !== statusFilter) return false
      if (fromDate && r.tu_ngay < fromDate) return false
      if (toDate && r.tu_ngay > toDate) return false
      if (keyword && !(r.ly_do ?? '').toLowerCase().includes(keyword)) return false
      return true
    })
  }, [requests, search, statusFilter, fromDate, toDate])

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setFromDate('')
    setToDate('')
  }

  async function handleCreate(data: { ngay: string; ly_do: string; gio_bat_dau: string | null; gio_ket_thuc: string | null }) {
    setCreating(true)
    try {
      const created = await doctorLeaveService.create(data.ngay, data.ngay, data.ly_do, data.gio_bat_dau, data.gio_ket_thuc)
      setRequests((prev) => [created, ...prev])
      setShowCreate(false)
      showToast('Đã gửi yêu cầu nghỉ — chờ Admin duyệt')
    } catch (err) {
      showToast((err as Error).message || 'Không thể gửi yêu cầu nghỉ', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleCancel(id: string) {
    setCancelId(null)
    setCancelLoading(id)
    try {
      const updated = await doctorLeaveService.cancel(id)
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)))
      showToast('Đã hủy yêu cầu nghỉ')
    } catch (err) {
      showToast((err as Error).message || 'Không thể hủy yêu cầu', 'error')
    } finally {
      setCancelLoading(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Xin nghỉ"
        description="Gửi yêu cầu nghỉ tới Admin và theo dõi trạng thái duyệt."
      >
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Icon name="calendar" className="h-4 w-4" /> Gửi yêu cầu mới
        </button>
      </PageHeader>

      {toast && <Toast key={toast.message + Date.now()} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Bộ lọc — để tra cứu lại yêu cầu đã gửi trước đây ── */}
      <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Tìm kiếm</label>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo lý do..."
              className="input w-full pl-9"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="input w-auto min-w-[170px]"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Từ ngày nghỉ</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input w-auto" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Đến ngày nghỉ</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input w-auto" />
        </div>

        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>Xóa lọc</Button>
        )}

        {!loading && !error && (
          <span className="ml-auto text-xs text-slate-400">{filtered.length} yêu cầu</span>
        )}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được danh sách yêu cầu nghỉ. Vui lòng thử lại sau.</p>
          <Button variant="secondary" size="sm" onClick={loadRequests}>Thử lại</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white">
          <Icon name="calendar" className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {hasFilter ? 'Không có yêu cầu nào khớp với bộ lọc.' : 'Bạn chưa gửi yêu cầu nghỉ nào.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-[34%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className={TH}>Ngày nghỉ</th>
                  <th className={TH}>Ca / khung giờ</th>
                  <th className={TH}>Lý do</th>
                  <th className={TH}>Trạng thái</th>
                  <th className={TH}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 align-top text-slate-700">{formatDate(r.tu_ngay)}</td>
                    <td className="px-4 py-3 align-top text-slate-600">{khungGioLabel(r)}</td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      <p className="truncate" title={r.ly_do ?? ''}>{r.ly_do ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge color={DOCTOR_LEAVE_STATUS_COLOR[r.trang_thai]}>{STATUS_LABEL[r.trang_thai]}</Badge>
                      {/* Ghi chú xử lý của Admin — chỉ hiện khi đã duyệt/từ chối và có ghi chú */}
                      {r.ghi_chu && (r.trang_thai === 'da_duyet' || r.trang_thai === 'tu_choi') && (
                        <p className="mt-1 max-w-[180px] truncate text-xs text-slate-400" title={r.ghi_chu}>
                          {r.ghi_chu}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {r.trang_thai === 'cho_duyet' && (
                        <Button
                          variant="danger"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() => setCancelId(r.id)}
                          disabled={cancelLoading === r.id}
                          icon={<Icon name="x" className="h-3.5 w-3.5" />}
                        >
                          {cancelLoading === r.id ? 'Đang hủy...' : 'Hủy yêu cầu'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateLeaveModal
          submitting={creating}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      <ConfirmDialog
        open={cancelId !== null}
        title="Hủy yêu cầu nghỉ"
        message="Bạn có chắc chắn muốn hủy yêu cầu nghỉ này?"
        confirmText="Hủy yêu cầu"
        danger
        onConfirm={() => cancelId && handleCancel(cancelId)}
        onCancel={() => setCancelId(null)}
      />
    </div>
  )
}
