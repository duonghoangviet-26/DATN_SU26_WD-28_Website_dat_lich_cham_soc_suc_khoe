import { useEffect, useMemo, useState } from 'react'
import {
  ActivityLogRow,
  receptionistActivityLogService,
} from '@/services/receptionist-activity-log.service'

const NHAN_NHOM: Record<string, string> = {
  tiep_nhan: 'Tiếp nhận',
  thanh_toan: 'Thanh toán',
  lich_hen: 'Lịch hẹn',
  lien_he: 'Liên hệ',
}

const MAU_NHOM: Record<string, string> = {
  tiep_nhan: 'bg-blue-50 text-blue-700',
  thanh_toan: 'bg-emerald-50 text-emerald-700',
  lich_hen: 'bg-amber-50 text-amber-700',
  lien_he: 'bg-violet-50 text-violet-700',
}

function gioPhut(value: string) {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function homNayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ActivityLog() {
  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ngay, setNgay] = useState(homNayISO())
  const [nhom, setNhom] = useState('')
  const [nguoiId, setNguoiId] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    receptionistActivityLogService
      .list({ ngay, nhom: nhom || undefined, nguoi_id: nguoiId || undefined })
      .then((result) => setRows(result.rows))
      .catch((e) => setError(e?.response?.data?.message || 'Không tải được nhật ký'))
      .finally(() => setLoading(false))
  }, [ngay, nhom, nguoiId])

  // Danh sách người trực suy từ chính dữ liệu — không cần API riêng.
  const nguoiTrong = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach((r) => {
      if (r.nguoi_thuc_hien_id) map.set(r.nguoi_thuc_hien_id, r.nguoi_thuc_hien)
    })
    return [...map.entries()]
  }, [rows])

  return (
    <div className="min-h-full bg-slate-50 p-4 lg:p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
          Vận hành · Bàn giao ca
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nhật ký ca trực</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ai đã thao tác với khách nào, lúc nào. Dùng khi bàn giao ca hoặc làm thay đồng nghiệp nghỉ.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-600">
          Ngày
          <input
            type="date"
            value={ngay}
            onChange={(e) => setNgay(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>

        <label className="text-sm font-medium text-slate-600">
          Nhóm việc
          <select
            value={nhom}
            onChange={(e) => setNhom(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Tất cả</option>
            {Object.entries(NHAN_NHOM).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-600">
          Người trực
          <select
            value={nguoiId}
            onChange={(e) => setNguoiId(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Tất cả</option>
            {nguoiTrong.map(([id, ten]) => (
              <option key={id} value={id}>{ten}</option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-sm text-slate-500">{rows.length} thao tác</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Giờ</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Người thực hiện</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Hành động</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Khách hàng</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                Chưa có thao tác nào trong ngày này.
              </td></tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{gioPhut(row.thoi_diem)}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{row.nguoi_thuc_hien}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.nhom ? MAU_NHOM[row.nhom] : 'bg-slate-100 text-slate-600'}`}>
                    {row.nhan_hanh_dong}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.ten_khach ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {row.chi_tiet
                    ? Object.entries(row.chi_tiet)
                        .filter(([, v]) => v !== null && v !== '' && v !== undefined)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
