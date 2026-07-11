import type { AppointmentItem, AppointmentStatus } from '@/types'
import { APPOINTMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL, SERVICE_TYPE_LABEL } from '@/utils/constants'
import { formatPrice } from '@/utils/format'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useState } from 'react'

const STATUS_COLOR: Record<AppointmentStatus, 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow', confirmed: 'blue', checked_in: 'blue', in_progress: 'yellow',
  waiting_doctor_confirm: 'yellow', completed: 'green', cancelled: 'red', no_show: 'red',
}

const PAYMENT_COLOR: Record<string, 'yellow' | 'green' | 'gray'> = {
  unpaid: 'yellow', paid: 'green', refunded: 'gray',
}

interface Props {
  appointments: AppointmentItem[]
  loading: boolean
  onView: (a: AppointmentItem) => void
  onHistory: (a: AppointmentItem) => void
  onCancel: (a: AppointmentItem) => void
  onReschedule: (a: AppointmentItem) => void
}

export default function AppointmentList({ appointments, loading, onView, onHistory, onCancel, onReschedule }: Props) {
  const [confirmItem, setConfirmItem] = useState<AppointmentItem | null>(null)

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Bệnh nhân</th>
              <th className="px-4 py-3 font-medium">Bác sĩ</th>
              <th className="px-4 py-3 font-medium">Ngày — Giờ</th>
              <th className="px-4 py-3 font-medium">Loại khám</th>
              <th className="px-4 py-3 font-medium">Giá</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Thanh toán</th>
              <th className="px-4 py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
            ) : appointments.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Không tìm thấy lịch hẹn.</td></tr>
            ) : appointments.map((a) => (
              <tr key={a._id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {a.benh_nhan}
                  {a.sdt_benh_nhan && <div className="text-xs font-normal text-slate-500">{a.sdt_benh_nhan}</div>}
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{a.bac_si}</p>
                  <p className="text-xs text-slate-400">{a.chuyen_khoa}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{a.ngay_kham}</p>
                  <p className="text-xs text-slate-400">{a.gio_kham}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge color={a.loai_kham === 'clinic' ? 'blue' : a.loai_kham === 'home' ? 'yellow' : 'green'}>
                    {SERVICE_TYPE_LABEL[a.loai_kham]}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">{formatPrice(a.gia_kham)}</td>
                <td className="px-4 py-3">
                  <Badge color={STATUS_COLOR[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge color={PAYMENT_COLOR[a.payment_status]}>{PAYMENT_STATUS_LABEL[a.payment_status]}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onView(a)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      <Icon name="eye" className="h-3 w-3" /> Xem
                    </button>
                    <button
                      onClick={() => onHistory(a)}
                      className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-600 transition-colors hover:bg-purple-100"
                    >
                      <Icon name="clock" className="h-3 w-3" /> Lịch sử
                    </button>
                    {(a.status === 'pending' || a.status === 'confirmed') && (
                      <button
                        onClick={() => onReschedule(a)}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100"
                      >
                        <Icon name="calendar" className="h-3 w-3" /> Dời
                      </button>
                    )}
                    {(a.status === 'pending' || a.status === 'confirmed') && (
                      <button
                        onClick={() => setConfirmItem(a)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                      >
                        <Icon name="x" className="h-3 w-3" /> Hủy
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!confirmItem}
        danger
        title="Hủy lịch hẹn"
        message={`Xác nhận hủy lịch hẹn của "${confirmItem?.benh_nhan}" với ${confirmItem?.bac_si}?`}
        confirmText="Hủy lịch"
        onConfirm={() => {
          if (confirmItem) onCancel(confirmItem)
          setConfirmItem(null)
        }}
        onCancel={() => setConfirmItem(null)}
      />
    </div>
  )
}
