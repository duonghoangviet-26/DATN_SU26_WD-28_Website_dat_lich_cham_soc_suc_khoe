import { useEffect, useState } from 'react'
import {
  EmergencyReportRow,
  receptionistEmergencyReportService,
} from '@/services/receptionist-emergency-report.service'
import {
  EmptyBlock, PageShell, ReceptionistHeader, StatusBadge, TableFrame,
} from '@/components/receptionist/ReceptionistUI'

const NHAN_TRANG_THAI: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' }> = {
  cho_dieu_phoi: { label: 'Chờ điều phối bác sĩ', tone: 'warning' },
  dang_cho: { label: 'Đang chờ khám', tone: 'info' },
  da_goi: { label: 'Đã gọi', tone: 'info' },
  trong_phong: { label: 'Đang khám', tone: 'brand' },
  cho_dich_vu: { label: 'Chờ dịch vụ', tone: 'brand' },
  hoan_thanh: { label: 'Đã khám xong', tone: 'success' },
  skipped: { label: 'Bỏ lượt', tone: 'neutral' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
}

function homNayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function gioPhut(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

// C6/D78 — biên bản ca khẩn cuối ngày: lễ tân xem lại toàn bộ lượt đã đánh dấu "Cấp cứu / ưu
// tiên khẩn" trong ngày, kèm bác sĩ phụ trách và trạng thái xử lý hiện tại, phục vụ bàn giao ca
// và đối chiếu khi cần. Dữ liệu lấy từ nhật ký thao tác, không có bảng riêng.
export default function EmergencyReport() {
  const [rows, setRows] = useState<EmergencyReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ngay, setNgay] = useState(homNayISO())

  useEffect(() => {
    setLoading(true)
    setError('')
    receptionistEmergencyReportService
      .list(ngay)
      .then(setRows)
      .catch((e) => setError(e?.response?.data?.message || 'Không tải được biên bản ca khẩn'))
      .finally(() => setLoading(false))
  }, [ngay])

  return (
    <PageShell>
      <ReceptionistHeader
        eyebrow="Vận hành · Cấp cứu"
        title="Biên bản ca khẩn"
        description="Toàn bộ lượt tiếp nhận được đánh dấu Cấp cứu / ưu tiên khẩn trong ngày — lý do, bác sĩ phụ trách và trạng thái xử lý hiện tại."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Ngày
          <input
            type="date"
            value={ngay}
            onChange={(e) => setNgay(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <span className="ml-auto text-sm text-slate-500">{rows.length} ca cấp cứu</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <TableFrame>
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Giờ tiếp nhận</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Bệnh nhân</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Lý do cấp cứu</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Người tiếp nhận</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Bác sĩ phụ trách</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6"><EmptyBlock>Không có ca cấp cứu nào trong ngày này.</EmptyBlock></td></tr>
            )}
            {!loading && rows.map((row) => {
              const trangThai = row.trang_thai_hien_tai ? NHAN_TRANG_THAI[row.trang_thai_hien_tai] : null
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">{gioPhut(row.thoi_diem_tiep_nhan)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{row.ten_benh_nhan ?? '—'}</p>
                    <p className="text-xs text-slate-400">
                      {[row.so_dien_thoai, row.ma_so_thu_tu ? `STT ${row.ma_so_thu_tu}` : null].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs leading-5 text-slate-700">{row.ly_do_cap_cuu ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.nguoi_tiep_nhan}</td>
                  <td className="px-4 py-3 text-slate-700">{row.bac_si_phu_trach ?? <span className="text-slate-400">Chưa điều phối</span>}</td>
                  <td className="px-4 py-3">
                    {trangThai ? <StatusBadge tone={trangThai.tone}>{trangThai.label}</StatusBadge> : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableFrame>
    </PageShell>
  )
}
