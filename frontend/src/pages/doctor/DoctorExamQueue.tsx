import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Icon from '@/components/admin/icons'
import ExamResultModal from '@/components/doctor/ExamResultModal'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import type { DoctorExamQueueRow, ExamQueueStatus, DoctorAppointmentDetail } from '@/types'
import { formatDate } from '@/utils/format'

const STATUS_LABEL: Record<ExamQueueStatus, string> = {
  dang_cho: 'Đang chờ', da_goi: 'Đã gọi', trong_phong: 'Trong phòng',
  cho_nhap_ho_so: 'Chờ nhập hồ sơ', cho_xac_nhan: 'Chờ bạn xác nhận',
  da_xong: 'Đã xong', bo_luot: 'Bỏ lượt', da_huy: 'Đã hủy',
}
// Badge chỉ nhận màu thuộc union cố định của component — không phải string tuỳ ý.
const STATUS_COLOR: Record<ExamQueueStatus, 'green' | 'red' | 'blue' | 'yellow' | 'gray'> = {
  dang_cho: 'gray', da_goi: 'blue', trong_phong: 'blue',
  cho_nhap_ho_so: 'yellow', cho_xac_nhan: 'green', da_xong: 'green', bo_luot: 'gray', da_huy: 'red',
}
const TH = 'px-4 py-3 text-xs font-semibold text-slate-600'

export default function DoctorExamQueue() {
  const [rows, setRows] = useState<DoctorExamQueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | ExamQueueStatus>('')
  const [active, setActive] = useState<DoctorExamQueueRow | null>(null)
  const [activeAppt, setActiveAppt] = useState<DoctorAppointmentDetail | null>(null)

  function load() {
    setLoading(true); setError(false)
    doctorAppointmentService.getExamQueue()
      .then(setRows).catch(() => setError(true)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  // Chỉ mở modal xác nhận khi tới bước của bác sĩ (đã có ket_qua_id + đang chờ xác nhận).
  async function openConfirm(r: DoctorExamQueueRow) {
    if (!r.appointment_id) {
      // Offline: xác nhận trực tiếp theo ket_qua_id (chưa dựng modal chi tiết offline ở đợt này).
      if (!r.ket_qua_id) return
      await doctorAppointmentService.confirmResultByRecord(r.ket_qua_id)
      load(); return
    }
    setActive(r); setActiveAppt(null)
    try {
      const appt = await doctorAppointmentService.getById(r.appointment_id)
      setActiveAppt(appt)
    } catch { setActive(null) }
  }
  function closeModal() { setActive(null); setActiveAppt(null) }

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter && r.trang_thai_tong_hop !== statusFilter) return false
      if (kw && !r.ten_benh_nhan.toLowerCase().includes(kw)) return false
      return true
    })
  }, [rows, search, statusFilter])

  return (
    <div>
      <PageHeader title="Hồ sơ chờ khám"
        description="Toàn bộ bệnh nhân (đặt online + vãng lai) đã check-in được gán cho bạn. Xác nhận hồ sơ khi y tá đã nhập xong." />

      <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Tìm kiếm</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên bệnh nhân..." className="input w-full" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Trạng thái</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | ExamQueueStatus)} className="input w-auto min-w-[170px]">
            <option value="">Tất cả</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {!loading && !error && <span className="ml-auto text-xs text-slate-400">{filtered.length} lượt</span>}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-600">Không tải được hàng đợi.</p>
          <Button variant="secondary" size="sm" onClick={load}>Thử lại</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
          Chưa có bệnh nhân nào trong hàng đợi.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className={TH}>Bệnh nhân</th>
                  <th className={TH}>Nguồn</th>
                  <th className={TH}>Phòng</th>
                  <th className={TH}>Trạng thái</th>
                  <th className={TH}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.ten_benh_nhan}</p>
                      <p className="text-xs text-slate-400">{formatDate(r.checkin_time)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={r.nguon === 'offline' ? 'yellow' : 'blue'}>{r.nguon === 'offline' ? 'Vãng lai' : 'Đặt online'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.phong_kham ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_COLOR[r.trang_thai_tong_hop]}>{STATUS_LABEL[r.trang_thai_tong_hop]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.trang_thai_tong_hop === 'cho_xac_nhan' ? (
                        <Button variant="success" size="sm" onClick={() => openConfirm(r)}
                          icon={<Icon name="check" className="h-3.5 w-3.5" />}>Xem & xác nhận</Button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {['dang_cho', 'da_goi', 'trong_phong', 'cho_nhap_ho_so'].includes(r.trang_thai_tong_hop) ? 'Y tá đang xử lý' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {active && activeAppt && (
        <ExamResultModal appt={activeAppt} mode="confirm" onClose={closeModal}
          onConfirmed={() => { closeModal(); load() }} onSaved={() => { closeModal(); load() }} />
      )}
    </div>
  )
}
