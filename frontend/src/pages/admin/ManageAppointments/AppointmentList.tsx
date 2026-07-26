import { useState } from 'react'

import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import type { AppointmentItem, AppointmentStatus } from '@/types'
import { APPOINTMENT_STATUS_LABEL, EXAM_TYPE_LABEL, PAYMENT_STATUS_LABEL } from '@/utils/constants'
import { formatAdminValue } from '@/utils/adminDisplay'
import { formatPrice } from '@/utils/format'

const STATUS_COLOR: Record<AppointmentStatus, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'yellow',
  confirmed: 'blue',
  checked_in: 'blue',
  in_progress: 'green',
  waiting_record: 'yellow',
  waiting_doctor_confirm: 'yellow',
  completed: 'green',
  cancelled: 'red',
  no_show: 'gray',
  skipped: 'gray',
}

const PAYMENT_COLOR: Record<string, 'yellow' | 'green' | 'red' | 'gray'> = {
  unpaid: 'yellow',
  partial: 'yellow',
  paid: 'green',
  refunded: 'gray',
}

interface Props {
  appointments: AppointmentItem[]
  loading: boolean
  onView: (a: AppointmentItem) => void
  onHistory: (a: AppointmentItem) => void
  onCancel: (a: AppointmentItem, reason: string) => void
  onReschedule: (a: AppointmentItem) => void
  onRestore: (a: AppointmentItem) => void
  onHardDelete: (a: AppointmentItem) => void
}

interface ActionIconButtonProps {
  label: string
  icon: string
  title: string
  className: string
  onClick: () => void
}

function ActionIconButton({ label, icon, title, className, onClick }: ActionIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-1 ${className}`}
    >
      <Icon name={icon} className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

export default function AppointmentList({
  appointments,
  loading,
  onView,
  onHistory,
  onCancel,
  onReschedule,
  onRestore,
  onHardDelete,
}: Props) {
  const [confirmItem, setConfirmItem] = useState<AppointmentItem | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitCancel() {
    if (!confirmItem || !cancelReason.trim()) {
      return
    }

    try {
      setSubmitting(true)
      await onCancel(confirmItem, cancelReason.trim())
      setConfirmItem(null)
      setCancelReason('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Mã lịch</th>
              <th className="px-4 py-3 font-medium">Bệnh nhân</th>
              <th className="px-4 py-3 font-medium">Bác sĩ</th>
              <th className="px-4 py-3 font-medium">Ngày giờ</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Thanh toán</th>
              <th className="px-4 py-3 font-medium">Cảnh báo</th>
              <th className="w-[188px] px-4 py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  Đang tải...
                </td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  Không tìm thấy lịch hẹn.
                </td>
              </tr>
            ) : appointments.map((appointment) => (
              <tr key={appointment._id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{appointment.ma_lich_hen || 'Chưa có mã'}</p>
                  <p className="text-xs text-slate-400">{EXAM_TYPE_LABEL[appointment.loai_kham] || formatAdminValue('loai_kham', appointment.loai_kham)}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-800">{appointment.benh_nhan}</p>
                    {appointment.dat_ho && (
                      <Badge color="blue">Đặt hộ</Badge>
                    )}
                  </div>
                  {appointment.dat_ho && appointment.nguoi_dat_ho_ten && appointment.nguoi_dat_ho_ten !== appointment.benh_nhan && (
                    <p className="text-xs font-medium text-blue-600">Người đặt hộ: {appointment.nguoi_dat_ho_ten}</p>
                  )}
                  <p className="text-xs text-slate-500">{appointment.sdt_benh_nhan || 'Chưa có số điện thoại'}</p>
                  {appointment.dat_ho && appointment.nguoi_dat_sdt && appointment.nguoi_dat_sdt !== appointment.sdt_benh_nhan && (
                    <p className="text-xs text-blue-500">SĐT người đặt hộ: {appointment.nguoi_dat_sdt}</p>
                  )}
                  {appointment.hinh_thuc_dat_lich && (
                    <p className="text-xs text-slate-400">Kênh tạo: {formatAdminValue('hinh_thuc_dat_lich', appointment.hinh_thuc_dat_lich)}</p>
                  )}
                  {appointment.user_email && (
                    <p className="text-xs text-slate-400">{appointment.user_email}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{appointment.bac_si}</p>
                  <p className="text-xs text-slate-400">{appointment.chuyen_khoa}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{appointment.ngay_kham}</p>
                  <p className="text-xs text-slate-400">{appointment.gio_kham}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{formatPrice(appointment.gia_kham)}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge color={STATUS_COLOR[appointment.status]}>
                    {APPOINTMENT_STATUS_LABEL[appointment.status] || formatAdminValue('status', appointment.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge color={PAYMENT_COLOR[appointment.payment_status] || 'gray'}>
                    {PAYMENT_STATUS_LABEL[appointment.payment_status] || formatAdminValue('payment_status', appointment.payment_status)}
                  </Badge>
                  {appointment.invoice?.so_hoa_don && (
                    <p className="mt-1 text-xs text-slate-400">{appointment.invoice.so_hoa_don}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {appointment.canh_bao?.unpaid && <Badge color="yellow">Chưa thanh toán</Badge>}
                    {appointment.canh_bao?.rescheduled_multiple_times && <Badge color="red">Đổi nhiều lần</Badge>}
                    {appointment.canh_bao?.missing_linkage && <Badge color="gray">Thiếu liên kết</Badge>}
                    {appointment.status === 'cancelled' && appointment.ly_do_huy && (
                      <Badge color="red">Có lý do hủy</Badge>
                    )}
                  </div>
                </td>
                <td className="w-[188px] px-4 py-3 align-middle">
                  <div className="ml-auto flex w-[172px] flex-wrap justify-end gap-2">
                    <ActionIconButton
                      label="Xem chi tiết"
                      title="Xem chi tiết"
                      icon="eye"
                      onClick={() => onView(appointment)}
                      className="border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-200"
                    />
                    <ActionIconButton
                      label="Lịch sử"
                      title="Lịch sử"
                      icon="clock"
                      onClick={() => onHistory(appointment)}
                      className="border-purple-200 bg-purple-50 text-purple-600 hover:border-purple-300 hover:bg-purple-100 focus:ring-purple-200"
                    />
                    {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
                      <>
                        <ActionIconButton
                          label="Dời lịch"
                          title="Dời lịch"
                          icon="calendar"
                          onClick={() => onReschedule(appointment)}
                          className="border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-300 hover:bg-blue-100 focus:ring-blue-200"
                        />
                        <ActionIconButton
                          label="Hủy lịch"
                          title="Hủy lịch"
                          icon="x"
                          onClick={() => setConfirmItem(appointment)}
                          className="border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 focus:ring-red-200"
                        />
                      </>
                    )}
                    {appointment.status === 'cancelled' && (
                      <ActionIconButton
                        label="Khôi phục"
                        title="Khôi phục"
                        icon="refresh-cw"
                        onClick={() => onRestore(appointment)}
                        className="border-green-200 bg-green-50 text-green-600 hover:border-green-300 hover:bg-green-100 focus:ring-green-200"
                      />
                    )}
                    {appointment.status === 'cancelled' && (
                      <ActionIconButton
                        label="Xóa cứng"
                        title="Xóa cứng"
                        icon="trash"
                        onClick={() => onHardDelete(appointment)}
                        className="border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 focus:ring-red-200"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Hủy lịch hẹn</h3>
            <p className="mt-2 text-sm text-slate-600">
              Xác nhận hủy lịch hẹn của "{confirmItem.benh_nhan}" với {confirmItem.bac_si}.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Lý do hủy <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                className="input w-full resize-none"
                placeholder="Nhập lý do hủy lịch..."
                disabled={submitting}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setConfirmItem(null)
                  setCancelReason('')
                }}
                className="btn-secondary"
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button
                onClick={submitCancel}
                className="btn-danger"
                disabled={submitting || !cancelReason.trim()}
              >
                {submitting ? 'Đang hủy...' : 'Hủy lịch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
