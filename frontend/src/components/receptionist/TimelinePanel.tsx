import { useEffect, useState } from 'react'
import { receptionistTimelineService, TimelineRow } from '@/services/receptionist-timeline.service'
import { appointmentStatusLabel, paymentLabel } from '@/utils/receptionistLabels'

const FIELD_LABELS: Record<string, string> = {
  ho_ten: 'Họ tên',
  so_dien_thoai: 'Số điện thoại',
  ngay_sinh: 'Ngày sinh',
  ngay_kham: 'Ngày khám',
  gioi_tinh: 'Giới tính',
  nhom_mau: 'Nhóm máu',
  di_ung: 'Dị ứng',
  benh_nen: 'Bệnh nền',
  dia_chi: 'Địa chỉ',
  ghi_chu: 'Ghi chú',
  status: 'Trạng thái tài khoản',
  trang_thai: 'Trạng thái',
  payment_status: 'Thanh toán',
  gio_kham: 'Giờ khám',
  ly_do_doi: 'Lý do đổi',
  'primary_member.ngay_sinh': 'Ngày sinh',
  'primary_member.gioi_tinh': 'Giới tính',
  'primary_member.nhom_mau': 'Nhóm máu',
  'primary_member.di_ung': 'Dị ứng',
  'primary_member.benh_nen': 'Bệnh nền',
}

function formatValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Chưa cập nhật'
  if (field.endsWith('ngay_sinh') || field === 'ngay_kham') {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('vi-VN')
  }
  if (field.endsWith('gioi_tinh')) {
    return ({ nam: 'Nam', nu: 'Nữ', khac: 'Khác' } as Record<string, string>)[String(value)] ?? String(value)
  }
  if (field === 'trang_thai' || field === 'status') {
    return appointmentStatusLabel(String(value))
  }
  if (field === 'payment_status') {
    return paymentLabel(String(value))
  }
  return String(value)
}

interface TimelinePanelProps {
  loai: 'ho_so' | 'lich_hen'
  id: string
  title?: string
  onClose: () => void
}

function TimelineRowItem({ row }: { row: TimelineRow }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          {row.nhan}
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {row.nguoi.ho_ten || 'Không rõ người thực hiện'}{row.nguoi.vai_tro ? ` · ${row.nguoi.vai_tro}` : ''}
          </span>
        </p>
        <span className="text-xs text-slate-500">{new Date(row.thoi_diem).toLocaleString('vi-VN')}</span>
      </div>
      {row.ly_do && <p className="mt-2 text-sm text-slate-600">Lý do: {row.ly_do}</p>}
      {row.thay_doi.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {row.thay_doi.filter((item) => item.truong !== 'doctor_id').map((item) => (
            <div key={item.truong} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
              <span className="font-semibold">{FIELD_LABELS[item.truong] || item.truong}:</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 line-through">{formatValue(item.truong, item.cu)}</span>
              <span>→</span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">{formatValue(item.truong, item.moi)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TimelinePanel({ loai, id, title, onClose }: TimelinePanelProps) {
  const [rows, setRows] = useState<TimelineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const request = loai === 'ho_so'
      ? receptionistTimelineService.getForHoSo(id)
      : receptionistTimelineService.getForLichHen(id)
    request
      .then((result) => {
        if (!cancelled) setRows(result.rows)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError?.response?.data?.message || 'Không thể tải lịch sử')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loai, id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{title || 'Lịch sử thao tác'}</h3>
            <p className="mt-1 text-sm text-slate-500">Gộp thao tác của lễ tân và admin trên cùng đối tượng.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>

        {loading && <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải lịch sử...</div>}
        {!loading && error && <p className="mt-6 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Chưa có thao tác nào được ghi nhận.</div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="mt-5 space-y-3">
            {rows.map((row, index) => (
              <TimelineRowItem key={`${row.nguon}-${row.thoi_diem}-${index}`} row={row} />
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
