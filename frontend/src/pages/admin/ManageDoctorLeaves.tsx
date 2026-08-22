import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Badge from '@/components/common/Badge'
import PageHeader from '@/components/common/PageHeader'
import DoctorLeaveApprovalModal from '@/components/receptionist/DoctorLeaveApprovalModal'
import TablePaginationFooter from '@/components/common/TablePaginationFooter'
import Modal from '@/components/common/Modal'
import Icon from '@/components/admin/icons'
import { adminDoctorLeavesService, type AdminDoctorLeave } from '@/services/admin-doctor-leaves.service'
import { DOCTOR_LEAVE_STATUS_COLOR } from '@/utils/constants'

const LEAVE_STATUS_LABEL: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_huy: 'Đã hủy',
}

export default function ManageDoctorLeaves() {
  const [leaves, setLeaves] = useState<AdminDoctorLeave[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approvingLeave, setApprovingLeave] = useState<AdminDoctorLeave | null>(null)
  const [historyLeave, setHistoryLeave] = useState<AdminDoctorLeave | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<string>('')
  
  // Phân trang
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const fetchLeaves = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const filters: any = {}
      if (statusFilter) filters.trang_thai = statusFilter
      if (dateFilter) filters.ngay = dateFilter
      const data = await adminDoctorLeavesService.list(filters)
      setLeaves(data)
      setCurrentPage(1)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách đơn nghỉ phép')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchLeaves()
  }, [fetchLeaves, dateFilter, statusFilter])

  const totalItems = leaves.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const paginatedLeaves = leaves.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <>
      <PageHeader
        title="Đơn nghỉ phép"
        description="Quản lý các yêu cầu xin nghỉ phép của bác sĩ"
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[{ label: 'Tất cả', value: '' }, { label: 'Chờ duyệt', value: 'cho_duyet' }, { label: 'Đã duyệt', value: 'da_duyet' }, { label: 'Từ chối', value: 'tu_choi' }, { label: 'Đã hủy', value: 'da_huy' }].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                statusFilter === tab.value
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={() => {
              setStatusFilter('')
              setDateFilter('')
              fetchLeaves()
            }}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Làm mới
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-4 font-semibold">Bác sĩ</th>
              <th className="p-4 font-semibold">Thời gian nghỉ</th>
              <th className="p-4 font-semibold max-w-[200px]">Lý do</th>
              <th className="p-4 font-semibold">Ghi chú duyệt</th>
              <th className="p-4 font-semibold text-center">Trạng thái</th>
              <th className="p-4 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
                    Đang tải...
                  </div>
                </td>
              </tr>
            ) : paginatedLeaves.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-400">
                  Không tìm thấy đơn nghỉ phép nào.
                </td>
              </tr>
            ) : (
              paginatedLeaves.map((leave) => {
                const tu = new Date(leave.tu_ngay).toLocaleDateString('vi-VN')
                const den = new Date(leave.den_ngay).toLocaleDateString('vi-VN')
                const khoang = tu === den ? tu : `${tu} → ${den}`
                const gio = leave.gio_bat_dau && leave.gio_ket_thuc ? `${leave.gio_bat_dau}–${leave.gio_ket_thuc}` : 'Cả ngày'

                return (
                  <tr key={leave._id} className="transition-colors hover:bg-slate-50/50">
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{leave.bac_si?.ho_ten || 'Không rõ'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{new Date(leave.ngay_tao || '').toLocaleString('vi-VN')}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-700">{khoang}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{gio}</p>
                    </td>
                    <td className="p-4 max-w-[200px] truncate" title={leave.ly_do || ''}>
                      {leave.ly_do}
                    </td>
                    <td className="p-4 max-w-[200px] truncate text-xs text-slate-500" title={leave.ghi_chu || ''}>
                      {leave.ghi_chu || '-'}
                    </td>
                    <td className="p-4 text-center">
                      <Badge color={DOCTOR_LEAVE_STATUS_COLOR[leave.trang_thai] as any}>
                        {LEAVE_STATUS_LABEL[leave.trang_thai] ?? leave.trang_thai}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      {leave.trang_thai === 'cho_duyet' ? (
                        <button
                          type="button"
                          onClick={() => setApprovingLeave(leave)}
                          className="inline-flex items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100"
                        >
                          Duyệt đơn
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setHistoryLeave(leave)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          title="Xem lịch sử"
                        >
                          <Icon name="clock" className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {totalItems > 0 && (
          <TablePaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            currentItemCount={paginatedLeaves.length}
            itemLabel="đơn nghỉ phép"
            pageSize={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {approvingLeave &&
        createPortal(
          <DoctorLeaveApprovalModal
            apiMode="admin"
            leave={approvingLeave}
            onClose={() => setApprovingLeave(null)}
            onDone={() => {
              fetchLeaves()
            }}
          />,
          document.body
        )}

      {/* Modal Lịch sử */}
      <Modal
        isOpen={!!historyLeave}
        onClose={() => setHistoryLeave(null)}
        title="Lịch sử duyệt đơn"
        maxWidth="sm"
      >
        {historyLeave && (
          <div className="p-5 text-sm text-slate-600 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Thời điểm tạo đơn</p>
              <p className="font-medium text-slate-800">
                {historyLeave.ngay_tao ? new Date(historyLeave.ngay_tao).toLocaleString('vi-VN') : 'Không xác định'}
              </p>
            </div>
            
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Trạng thái hiện tại</p>
              <div className="mb-3">
                <Badge color={DOCTOR_LEAVE_STATUS_COLOR[historyLeave.trang_thai] as any}>
                  {LEAVE_STATUS_LABEL[historyLeave.trang_thai] ?? historyLeave.trang_thai}
                </Badge>
              </div>

              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Xử lý bởi</p>
              <p className="font-medium text-slate-800">
                {historyLeave.nguoi_duyet?.ho_ten || 'Hệ thống'}
              </p>
              {historyLeave.thoi_diem_duyet && (
                <p className="mt-1 text-xs text-slate-500">
                  Vào lúc: {new Date(historyLeave.thoi_diem_duyet).toLocaleString('vi-VN')}
                </p>
              )}

              {historyLeave.ghi_chu && (
                <div className="mt-4 pt-4 border-t border-slate-200/60">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Nội dung ghi chú</p>
                  <p className="font-medium text-slate-800 italic whitespace-pre-wrap">"{historyLeave.ghi_chu}"</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
