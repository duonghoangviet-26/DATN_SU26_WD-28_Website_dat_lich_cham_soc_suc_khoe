import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import TablePaginationFooter from '@/components/common/TablePaginationFooter'
import ExamHistoryDetailModal from '@/components/doctor/ExamHistoryDetailModal'
import { doctorExamSessionService } from '@/services/doctor-exam-session.service'
import type { ExamHistoryRow } from '@/services/doctor-exam-session.service'
import { formatDateTime, formatPrice, toLocalDateStr, NHAN_KET_CUC_THAT } from '@/utils/format'

const TH = 'px-4 py-3 text-xs font-semibold text-slate-600'

const NHAN_THANH_TOAN: Record<string, { label: string; color: 'green' | 'yellow' | 'red' | 'gray' }> = {
  chua_thanh_toan: { label: 'Chưa thanh toán', color: 'red' },
  da_dat_coc: { label: 'Đã đặt cọc', color: 'yellow' },
  da_thanh_toan_du: { label: 'Đã thanh toán', color: 'green' },
  qua_han: { label: 'Quá hạn', color: 'red' },
}

// C4 — "Bệnh nhân đã khám": tách khỏi trang "Hồ sơ chờ khám" để bảng chờ không bị bệnh nhân
// đã xong chiếm chỗ; tra cứu theo ngày hoặc theo tên/SĐT (nới tự động 90 ngày khi tìm kiếm).
export default function DoctorExamHistory() {
  const [date, setDate] = useState(toLocalDateStr())
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<ExamHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null)

  // Phân trang 10 bệnh nhân / 1 trang
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  function load() {
    setLoading(true); setError(false)
    const q = search.trim()
    doctorExamSessionService
      .listHistory(q ? { q } : { date })
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [date, search])

  useEffect(() => {
    setCurrentPage(1)
  }, [date, search])

  const totalItems = rows.length
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1
  const safePage = Math.min(currentPage, totalPages)

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, safePage])

  return (
    <div>
      <PageHeader title="Bệnh nhân đã khám"
        description="Toàn bộ hồ sơ đã hoàn tất và xác nhận. Xem lại nội dung đã nhập, tình trạng thanh toán, hoặc đính chính khi cần." />

      <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Ngày khám</label>
          <input type="date" value={date} disabled={!!search.trim()}
            onChange={(e) => setDate(e.target.value)} className="input w-auto disabled:opacity-40" />
        </div>
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Tìm theo tên hoặc số điện thoại</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập tên hoặc SĐT để tìm trong 90 ngày gần nhất..." className="input w-full" />
        </div>
        {!loading && !error && <span className="ml-auto text-xs text-slate-400">{rows.length} bệnh nhân</span>}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-600">Không tải được danh sách.</p>
          <button type="button" onClick={load} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">Thử lại</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
          <p>{search.trim() ? 'Không tìm thấy bệnh nhân phù hợp.' : 'Chưa có bệnh nhân nào hoàn tất khám trong ngày này.'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className={TH}>Bệnh nhân</th>
                  <th className={TH}>Giờ hoàn tất</th>
                  <th className={TH}>Chẩn đoán</th>
                  <th className={TH}>Kết cục</th>
                  <th className={TH}>Thanh toán</th>
                  <th className={TH}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((r) => {
                  const payment = r.trang_thai_hoa_don ? NHAN_THANH_TOAN[r.trang_thai_hoa_don] : null
                  return (
                    <tr key={r.queue_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.ten_benh_nhan}</p>
                        <p className="text-xs text-slate-400">
                          {[r.so_dien_thoai, r.nguon === 'offline' ? 'Vãng lai' : 'Đặt online'].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(r.thoi_diem_xac_nhan)}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-700">{r.chan_doan}</td>
                      <td className="px-4 py-3">
                        <span className={r.ket_cuc !== 'dieu_tri_thuong' ? 'font-semibold text-amber-700' : 'text-slate-600'}>
                          {NHAN_KET_CUC_THAT[r.ket_cuc] ?? r.ket_cuc}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {payment ? <Badge color={payment.color}>{payment.label}</Badge> : <span className="text-xs text-slate-400">—</span>}
                        {r.tong_thanh_toan != null && (
                          <p className="mt-0.5 text-xs text-slate-400">{formatPrice(r.tong_thanh_toan)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setActiveQueueId(r.queue_id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <Icon name="eye" className="h-3.5 w-3.5" /> Xem hồ sơ
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <TablePaginationFooter
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={totalItems}
            currentItemCount={paginatedRows.length}
            pageSize={PAGE_SIZE}
            itemLabel="bệnh nhân"
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {activeQueueId && (
        <ExamHistoryDetailModal queueId={activeQueueId} onClose={() => setActiveQueueId(null)}
          onAmended={() => { load() }} />
      )}
    </div>
  )
}
