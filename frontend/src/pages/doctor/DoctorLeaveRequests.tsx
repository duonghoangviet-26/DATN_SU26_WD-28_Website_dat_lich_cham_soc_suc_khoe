import { useEffect, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Toast from '@/components/common/Toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import { doctorLeaveService } from '@/services/doctor-leave.service'
import type { DoctorLeaveRequest } from '@/types'
import { formatDate, toLocalDateStr } from '@/utils/format'

const STATUS_LABEL: Record<DoctorLeaveRequest['trang_thai'], string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_huy: 'Đã hủy',
}
const STATUS_COLOR: Record<DoctorLeaveRequest['trang_thai'], 'yellow' | 'green' | 'red' | 'gray'> = {
  cho_duyet: 'yellow', da_duyet: 'green', tu_choi: 'red', da_huy: 'gray',
}

const TH_PLAIN = 'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'

function khungGioLabel(r: DoctorLeaveRequest): string {
  return r.gio_bat_dau && r.gio_ket_thuc ? `${r.gio_bat_dau} – ${r.gio_ket_thuc}` : 'Cả ngày'
}

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

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được danh sách yêu cầu nghỉ. Vui lòng thử lại sau.</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white">
          <Icon name="calendar" className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Bạn chưa gửi yêu cầu nghỉ nào.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className={TH_PLAIN}>Ngày nghỉ</th>
                  <th className={TH_PLAIN}>Ca / khung giờ</th>
                  <th className={TH_PLAIN}>Lý do</th>
                  <th className={TH_PLAIN}>Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{formatDate(r.tu_ngay)}</td>
                    <td className="px-4 py-3 text-slate-600">{khungGioLabel(r)}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={r.ly_do ?? ''}>{r.ly_do ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_COLOR[r.trang_thai]}>{STATUS_LABEL[r.trang_thai]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.trang_thai === 'cho_duyet' && (
                        <button
                          onClick={() => setCancelId(r.id)}
                          disabled={cancelLoading === r.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Icon name="x" className="h-3 w-3" />
                          {cancelLoading === r.id ? 'Đang hủy...' : 'Hủy yêu cầu'}
                        </button>
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
