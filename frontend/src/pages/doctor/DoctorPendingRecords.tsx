import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Icon from '@/components/admin/icons'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { examinationService } from '@/services/examination.service'
import type { DoctorPendingRecord, ExaminationResult, KetQuaKhamStatus } from '@/types'
import { formatDate, formatDateTime } from '@/utils/format'
import { KET_QUA_KHAM_STATUS_COLOR } from '@/utils/constants'

const KET_QUA_STATUS_LABEL: Record<KetQuaKhamStatus, string> = {
  ban_nhap: 'Nháp',
  cho_xac_nhan: 'Chờ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  yeu_cau_chinh_sua: 'Cần chỉnh sửa',
}

// Header bảng: đủ tương phản, không viết hoa toàn bộ (đồng bộ với DoctorAppointments.tsx).
const TH = 'px-4 py-3 text-xs font-semibold text-slate-600'

// ─── Modal xem chi tiết hồ sơ (chỉ xem — xác nhận/yêu cầu chỉnh sửa thực hiện ở
// trang Lịch hẹn của tôi, màn Chi tiết lịch hẹn) ──────────────────────────────
function RecordViewModal({ record, onClose }: { record: DoctorPendingRecord; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ExaminationResult | null>(null)

  useEffect(() => {
    examinationService.getByAppointment(record.appointment_id)
      .then(setResult)
      .finally(() => setLoading(false))
  }, [record.appointment_id])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="font-semibold text-slate-800">Hồ sơ khám</p>
            <p className="text-sm text-slate-500">
              {record.benh_nhan} · {formatDate(record.ngay_kham)}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-slate-400">Đang tải...</div>
        ) : !result ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
            <Icon name="file-text" className="h-8 w-8 text-slate-200" />
            <p className="text-sm">Không tìm thấy nội dung hồ sơ.</p>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5 text-sm">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dịch vụ</p>
                <p className="mt-0.5 text-slate-700">{record.ten_dich_vu ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Y tá nhập</p>
                <p className="mt-0.5 text-slate-700">{record.nguoi_nhap ?? 'Không rõ'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Trạng thái</p>
                <p className="mt-0.5">
                  <Badge color={KET_QUA_KHAM_STATUS_COLOR[record.status]}>{KET_QUA_STATUS_LABEL[record.status]}</Badge>
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chẩn đoán</p>
              <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{result.chan_doan}</p>
            </div>

            {result.huong_dan_dieu_tri && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hướng dẫn điều trị</p>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{result.huong_dan_dieu_tri}</p>
              </div>
            )}

            {result.ghi_chu && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ghi chú</p>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{result.ghi_chu}</p>
              </div>
            )}

            {result.ngay_tai_kham && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ngày tái khám</p>
                <p className="mt-0.5 text-slate-700">{formatDate(result.ngay_tai_kham)}</p>
              </div>
            )}

            {result.thuoc.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Đơn thuốc</p>
                <ul className="space-y-1.5">
                  {result.thuoc.map((t) => (
                    <li key={t.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{t.ten_thuoc}</span>
                      {t.lieu_luong && <span> · {t.lieu_luong}</span>}
                      {t.tan_suat && <span> · {t.tan_suat}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lịch sử thay đổi — đối chiếu sau này khi hồ sơ đã được xác nhận hoặc yêu cầu chỉnh sửa */}
            {result.lich_su_sua && result.lich_su_sua.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Lịch sử thay đổi</p>
                <ul className="space-y-2">
                  {result.lich_su_sua.map((h, i) => {
                    const nguoiThucHien = typeof h.nguoi_sua_id === 'object' ? h.nguoi_sua_id?.ho_ten : undefined
                    return (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                        <div>
                          <p className="text-slate-700">{h.noi_dung ?? 'Cập nhật hồ sơ'}</p>
                          <p className="mt-0.5 text-slate-400">
                            {formatDateTime(h.thoi_diem_sua)}
                            {nguoiThucHien && ` · ${nguoiThucHien}`}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button type="button" onClick={onClose} className="btn-secondary">Đóng</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
  const [viewing, setViewing] = useState<DoctorPendingRecord | null>(null)

  // Bộ lọc — thuần client-side, dữ liệu đã tải đủ (cả lịch sử đã xử lý) trong 1 lần gọi.
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | KetQuaKhamStatus>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function load() {
    setLoading(true)
    setError(false)
    // status='all' — bao gồm cả hồ sơ đã xác nhận/cần chỉnh sửa để bác sĩ tra cứu lại sau này,
    // khác với lời gọi không tham số ở DoctorDashboard (chỉ đếm hồ sơ đang chờ xử lý).
    doctorAppointmentService.listPendingResults('all')
      .then(setRecords)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

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
        description="Hồ sơ khám cần bạn xác nhận, và tra cứu lại hồ sơ đã xử lý trước đây."
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
                      <Button
                        variant="secondary"
                        size="sm"
                        className="whitespace-nowrap"
                        onClick={() => setViewing(r)}
                        icon={<Icon name="eye" className="h-3.5 w-3.5" />}
                      >
                        Chi tiết
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewing && <RecordViewModal record={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
