import { useEffect, useMemo, useState } from 'react'
import {
  ActivityLogRow,
  receptionistActivityLogService,
} from '@/services/receptionist-activity-log.service'
import { EmptyBlock, PageShell, ReceptionistHeader, TableFrame } from '@/components/receptionist/ReceptionistUI'
import TablePaginationFooter from '@/components/common/TablePaginationFooter'
import Icon from '@/components/admin/icons'

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

function ngayThangPhut(value: string) {
  const d = new Date(value)
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function homNayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function text(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function money(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  return amount.toLocaleString('vi-VN') + ' đ'
}

function paymentMethod(value: unknown) {
  const method = text(value)
  if (method === 'tien_mat') return 'tiền mặt'
  if (method === 'chuyen_khoan') return 'chuyển khoản'
  return method
}

function joinParts(parts: Array<string | null>) {
  return parts.filter(Boolean).join(', ')
}

function formatActivityDetail(row: ActivityLogRow) {
  const detail = row.chi_tiet ?? {}
  const patientName = row.ten_khach || text(detail.ten_benh_nhan) || text(detail.ten_khach) || 'bệnh nhân'
  const queueCode = text(detail.ma_so_thu_tu)
  const room = text(detail.phong_kham)
  const appointmentCode = text(detail.ma_lich_hen)
  const invoiceCode = text(detail.ma_hoa_don) || text(detail.so_hoa_don)
  const total = money(detail.tong_tien)
  const amount = money(detail.so_tien)
  const method = paymentMethod(detail.hinh_thuc)
  const examTime = text(detail.gio_kham)
  const reason = text(detail.ly_do) || text(detail.ly_do_doi)

  switch (row.hanh_dong) {
    case 'LT_CHECK_IN':
      return joinParts([
        `Tiếp nhận ${patientName} vào hàng đợi khám`,
        queueCode ? `số thứ tự ${queueCode}` : null,
        room ? `phòng ${room}` : null,
        appointmentCode ? `lịch ${appointmentCode}` : null,
      ])
    case 'LT_TAO_KHACH_VANG_LAI':
      return joinParts([
        `Tạo lượt khám trực tiếp cho ${patientName}`,
        queueCode ? `số thứ tự ${queueCode}` : null,
        examTime ? `khung ${examTime}` : null,
        room ? `phòng ${room}` : null,
      ])
    case 'LT_HUY_CHECK_IN':
      return joinParts([
        `Hủy lượt tiếp nhận của ${patientName}`,
        reason ? `lý do: ${reason}` : null,
      ])
    case 'LT_LAP_HOA_DON':
      return joinParts([
        `Lập hóa đơn${invoiceCode ? ` ${invoiceCode}` : ''} cho ${patientName}`,
        total ? `tổng ${total}` : null,
        detail.so_khoan ? `${detail.so_khoan} khoản thu` : null,
      ])
    case 'LT_XAC_NHAN_THANH_TOAN':
      return joinParts([
        `Xác nhận thu ${amount ?? 'tiền'} của ${patientName}`,
        method ? `hình thức ${method}` : null,
        invoiceCode ? `hóa đơn ${invoiceCode}` : null,
      ])
    case 'LT_DOI_LICH':
      return joinParts([
        `Đổi lịch khám cho ${patientName}`,
        text(detail.ngay_kham) || examTime ? `sang ${[text(detail.ngay_kham), examTime].filter(Boolean).join(' lúc ')}` : null,
        reason ? `lý do: ${reason}` : null,
      ])
    case 'LT_HUY_LICH':
      return joinParts([
        `Hủy lịch khám của ${patientName}`,
        reason ? `lý do: ${reason}` : null,
      ])
    case 'LT_GOI_KHACH':
      return joinParts([
        `Gọi điện cho ${patientName}`,
        text(detail.ket_qua) ? `kết quả: ${text(detail.ket_qua)}` : null,
      ])
    case 'LT_IN_PHIEU_STT':
      return joinParts([
        `In phiếu số thứ tự cho ${patientName}`,
        queueCode ? `số ${queueCode}` : null,
      ])
    default:
      return row.nhan_hanh_dong
  }
}

export default function ActivityLog() {
  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tuNgay, setTuNgay] = useState(homNayISO())
  const [denNgay, setDenNgay] = useState(homNayISO())
  const [tuKhoa, setTuKhoa] = useState('')
  const [nhom, setNhom] = useState('')
  const [nguoiId, setNguoiId] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)

  // Danh sách gợi ý người dùng (có thể phải gọi API riêng hoặc gộp chung từ log trả về)
  const [nguoiTrong, setNguoiTrong] = useState<Array<[string, string]>>([])

  useEffect(() => {
    // Reset về trang 1 khi các filter thay đổi
    setPage(1)
  }, [tuNgay, denNgay, tuKhoa, nhom, nguoiId])

  useEffect(() => {
    setLoading(true)
    setError('')
    receptionistActivityLogService
      .list({
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        tu_khoa: tuKhoa || undefined,
        nhom: nhom || undefined,
        nguoi_id: nguoiId || undefined,
        page,
        limit,
      })
      .then((result) => {
        setRows(result.rows)
        setTotal(result.total || 0)
        
        // Cập nhật người thực hiện nếu lấy được người mới từ log
        const map = new Map<string, string>(nguoiTrong)
        let changed = false
        result.rows.forEach((r) => {
          if (r.nguoi_thuc_hien_id && !map.has(r.nguoi_thuc_hien_id)) {
            map.set(r.nguoi_thuc_hien_id, r.nguoi_thuc_hien)
            changed = true
          }
        })
        if (changed) {
          setNguoiTrong([...map.entries()])
        }
      })
      .catch((e) => setError(e?.response?.data?.message || 'Không tải được nhật ký'))
      .finally(() => setLoading(false))
  }, [tuNgay, denNgay, tuKhoa, nhom, nguoiId, page, limit])

  const totalPages = Math.ceil(total / limit)

  return (
    <PageShell>
      <ReceptionistHeader
        eyebrow="Vận hành · Bàn giao ca"
        title="Nhật ký ca trực lễ tân"
        description="Ai đã thao tác với khách nào, lúc nào. Dùng khi bàn giao ca hoặc làm thay đồng nghiệp nghỉ."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Từ ngày
          <input
            type="date"
            value={tuNgay}
            onChange={(e) => setTuNgay(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Đến ngày
          <input
            type="date"
            value={denNgay}
            onChange={(e) => setDenNgay(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <label className="grid gap-1 text-sm font-semibold text-slate-700 w-full md:w-auto flex-1 max-w-sm">
          Tìm kiếm
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Tên khách, tên nhân viên..."
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </label>

        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Nhóm việc
          <select
            value={nhom}
            onChange={(e) => setNhom(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Tất cả</option>
            {Object.entries(NHAN_NHOM).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Người trực
          <select
            value={nguoiId}
            onChange={(e) => setNguoiId(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Tất cả</option>
            {nguoiTrong.map(([id, ten]) => (
              <option key={id} value={id}>{ten}</option>
            ))}
          </select>
        </label>

      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <TableFrame>
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Thời gian</th>
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
              <tr><td colSpan={5} className="px-4 py-6"><EmptyBlock>Không tìm thấy thao tác nào phù hợp.</EmptyBlock></td></tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-500">{ngayThangPhut(row.thoi_diem)}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{row.nguoi_thuc_hien}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.nhom ? MAU_NHOM[row.nhom] : 'bg-slate-100 text-slate-600'}`}>
                    {row.nhan_hanh_dong}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.ten_khach ?? '—'}</td>
                <td className="max-w-xl px-4 py-3 text-xs leading-5 text-slate-600">
                  {formatActivityDetail(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePaginationFooter
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          currentItemCount={rows.length}
          itemLabel="thao tác"
          onPageChange={setPage}
          pageSize={limit}
        />
      </TableFrame>
    </PageShell>
  )
}
