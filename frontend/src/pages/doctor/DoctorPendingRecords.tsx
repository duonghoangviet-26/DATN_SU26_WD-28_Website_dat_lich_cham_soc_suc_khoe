import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Icon from '@/components/admin/icons'
import ExamResultModal from '@/components/doctor/ExamResultModal'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import type { DoctorPendingRecord, DoctorAppointmentDetail, KetQuaKhamStatus } from '@/types'
import { formatDate } from '@/utils/format'
import { KET_QUA_KHAM_STATUS_COLOR } from '@/utils/constants'

const KET_QUA_STATUS_LABEL: Record<KetQuaKhamStatus, string> = {
  ban_nhap: 'Nháp',
  cho_xac_nhan: 'Chờ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  yeu_cau_chinh_sua: 'Cần chỉnh sửa',
}

// Header bảng: đủ tương phản, không viết hoa toàn bộ (đồng bộ với DoctorAppointments.tsx).
const TH = 'px-4 py-3 text-xs font-semibold text-slate-600'

const STATUS_FILTER_OPTIONS: { value: '' | KetQuaKhamStatus; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'cho_xac_nhan', label: 'Chờ xác nhận' },
  { value: 'da_xac_nhan', label: 'Đã xác nhận' },
  { value: 'yeu_cau_chinh_sua', label: 'Cần chỉnh sửa' },
]

export default function DoctorPendingRecords() {
  const [records, setRecords] = useState<DoctorPendingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Hồ sơ đang mở: `active` là dòng được chọn, `activeAppt` là chi tiết lịch hẹn đã tải (chứa
  // thông tin bệnh nhân đầy đủ — dị ứng/bệnh nền/tuổi... để bác sĩ chẩn đoán & kê thuốc an toàn).
  const [active, setActive] = useState<DoctorPendingRecord | null>(null)
  const [activeAppt, setActiveAppt] = useState<DoctorAppointmentDetail | null>(null)
  const [openError, setOpenError] = useState(false)

  // Bộ lọc — thuần client-side, dữ liệu đã tải đủ (cả lịch sử đã xử lý) trong 1 lần gọi.
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | KetQuaKhamStatus>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function load() {
    setLoading(true)
    setError(false)
    // status='all' — gồm cả hồ sơ đã xác nhận/cần chỉnh sửa để bác sĩ tra cứu lại sau này,
    // khác lời gọi không tham số ở DoctorDashboard (chỉ đếm hồ sơ đang chờ xử lý).
    doctorAppointmentService.listPendingResults('all')
      .then(setRecords)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Mở modal xử lý: tải chi tiết lịch hẹn (getById) để có đủ thông tin bệnh nhân cho modal.
  async function openRecord(r: DoctorPendingRecord) {
    setActive(r)
    setActiveAppt(null)
    setOpenError(false)
    try {
      const appt = await doctorAppointmentService.getById(r.appointment_id)
      setActiveAppt(appt)
    } catch {
      setOpenError(true)
    }
  }

  function closeModal() {
    setActive(null)
    setActiveAppt(null)
    setOpenError(false)
  }

  const hasFilter = !!(search || statusFilter || fromDate || toDate)

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return records.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false
      if (fromDate && r.ngay_kham.slice(0, 10) < fromDate) return false
      if (toDate && r.ngay_kham.slice(0, 10) > toDate) return false
      if (keyword) {
        const haystack = `${r.benh_nhan} ${r.ten_dich_vu ?? ''} ${r.nguoi_nhap ?? ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
  }, [records, search, statusFilter, fromDate, toDate])

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setFromDate('')
    setToDate('')
  }

  return (
    <div>
      <PageHeader
        title="Hồ sơ chờ xác nhận"
        description="Xem thông tin bệnh nhân, chỉnh sửa nếu cần rồi xác nhận hồ sơ khám ngay tại đây."
      />

      {/* ── Bộ lọc ── */}
      <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Tìm kiếm</label>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tên bệnh nhân, dịch vụ, y tá nhập..."
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
          <label className="mb-1 block text-xs font-semibold text-slate-500">Từ ngày khám</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input w-auto" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Đến ngày khám</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input w-auto" />
        </div>

        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>Xóa lọc</Button>
        )}

        {!loading && !error && (
          <span className="ml-auto text-xs text-slate-400">{filtered.length} hồ sơ</span>
        )}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được danh sách hồ sơ. Vui lòng thử lại sau.</p>
          <Button variant="secondary" size="sm" onClick={load}>Thử lại</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white">
          <Icon name="file-text" className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {hasFilter ? 'Không có hồ sơ nào khớp với bộ lọc.' : 'Chưa có hồ sơ nào.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] table-fixed text-sm">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[24%]" />
                <col className="w-[22%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className={TH}>Ngày khám</th>
                  <th className={TH}>Tên bệnh nhân</th>
                  <th className={TH}>Dịch vụ</th>
                  <th className={TH}>Y tá nhập</th>
                  <th className={TH}>Trạng thái hồ sơ</th>
                  <th className={TH}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 align-top text-slate-700">{formatDate(r.ngay_kham)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                          {r.benh_nhan.charAt(0)}
                        </div>
                        <p className="truncate font-medium text-slate-800">{r.benh_nhan}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      <p className="truncate" title={r.ten_dich_vu ?? undefined}>{r.ten_dich_vu ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      <p className="truncate">{r.nguoi_nhap ?? 'Không rõ'}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge color={KET_QUA_KHAM_STATUS_COLOR[r.status]}>{KET_QUA_STATUS_LABEL[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {r.status === 'cho_xac_nhan' ? (
                        <Button
                          variant="success"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() => openRecord(r)}
                          icon={<Icon name="check" className="h-3.5 w-3.5" />}
                        >
                          Xử lý
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() => openRecord(r)}
                          icon={<Icon name="eye" className="h-3.5 w-3.5" />}
                        >
                          Chi tiết
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

      {/* Đang tải chi tiết hồ sơ trước khi mở modal */}
      {active && !activeAppt && !openError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="rounded-2xl bg-white px-8 py-6 text-sm text-slate-400 shadow-xl">Đang tải hồ sơ...</div>
        </div>
      )}

      {active && openError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <Icon name="alert-circle" className="mx-auto h-8 w-8 text-red-400" />
            <p className="mt-2 text-sm text-slate-600">Không tải được hồ sơ. Vui lòng thử lại.</p>
            <button onClick={closeModal} className="btn-secondary mt-4">Đóng</button>
          </div>
        </div>
      )}

      {active && activeAppt && (
        <ExamResultModal
          appt={activeAppt}
          mode="confirm"
          onClose={closeModal}
          onConfirmed={() => { closeModal(); load() }}
          onSaved={() => { closeModal(); load() }}
        />
      )}
    </div>
  )
}
