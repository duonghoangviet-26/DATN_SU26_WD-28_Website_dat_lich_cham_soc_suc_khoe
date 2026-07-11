import { useEffect, useState } from 'react'

import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import { appointmentService } from '@/services/appointment.service'
import type { AppointmentHistoryItem, AppointmentItem, AppointmentStatus } from '@/types'
import { APPOINTMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/utils/constants'

interface Props {
  appointment: AppointmentItem
  onClose: () => void
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  doctor: 'bg-blue-100 text-blue-700',
  user: 'bg-green-100 text-green-700',
  system: 'bg-slate-100 text-slate-700',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  doctor: 'Bác sĩ',
  user: 'Bệnh nhân',
  system: 'Hệ thống',
}

const STATUS_COLOR: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'yellow',
  confirmed: 'blue',
  checked_in: 'blue',
  in_progress: 'green',
  completed: 'green',
  cancelled: 'red',
  no_show: 'gray',
  unpaid: 'yellow',
  partial: 'yellow',
  paid: 'green',
  refunded: 'gray',
}

export default function AppointmentHistoryModal({ appointment, onClose }: Props) {
  const [history, setHistory] = useState<AppointmentHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    appointmentService.getAppointmentHistory(appointment._id)
      .then(setHistory)
      .catch((nextError) => setError(nextError?.response?.data?.message || 'Lỗi tải lịch sử'))
      .finally(() => setLoading(false))
  }, [appointment._id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Lịch sử thay đổi</h3>
            <p className="text-sm text-slate-500">
              Lịch hẹn của <span className="font-medium text-slate-700">{appointment.benh_nhan}</span> với bác sĩ <span className="font-medium text-slate-700">{appointment.bac_si}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {loading ? (
            <div className="py-10 text-center text-slate-400">Đang tải lịch sử...</div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">{error}</div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center text-slate-400">Chưa có lịch sử thay đổi nào.</div>
          ) : (
            <div className="relative ml-4 space-y-8 border-l-2 border-slate-200">
              {history.map((item) => (
                <div key={item._id} className="relative pl-6">
                  <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white bg-blue-500" />

                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{item.nguoi_thuc_hien}</span>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[item.vai_tro]}`}>
                        {ROLE_LABELS[item.vai_tro] || item.vai_tro}
                      </span>
                    </div>
                    <time className="text-xs text-slate-500">
                      {new Date(item.thoi_diem).toLocaleString('vi-VN')}
                    </time>
                  </div>

                  {item.nguoi_thuc_hien_email && (
                    <div className="mb-3 text-xs text-slate-500">{item.nguoi_thuc_hien_email}</div>
                  )}

                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
                    {item.tu_trang_thai !== item.den_trang_thai && item.den_trang_thai && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-slate-600">Trạng thái khám:</span>
                        {item.tu_trang_thai ? (
                          <Badge color={STATUS_COLOR[item.tu_trang_thai] || 'gray'}>
                            {APPOINTMENT_STATUS_LABEL[item.tu_trang_thai as AppointmentStatus] || item.tu_trang_thai}
                          </Badge>
                        ) : (
                          <span className="italic text-slate-400">Mới tạo</span>
                        )}
                        <Icon name="arrow-right" className="h-3 w-3 text-slate-400" />
                        <Badge color={STATUS_COLOR[item.den_trang_thai] || 'gray'}>
                          {APPOINTMENT_STATUS_LABEL[item.den_trang_thai as AppointmentStatus] || item.den_trang_thai}
                        </Badge>
                      </div>
                    )}

                    {item.tu_payment_status !== item.den_payment_status && item.den_payment_status && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-slate-600">Thanh toán:</span>
                        {item.tu_payment_status ? (
                          <Badge color={STATUS_COLOR[item.tu_payment_status] || 'gray'}>
                            {PAYMENT_STATUS_LABEL[item.tu_payment_status] || item.tu_payment_status}
                          </Badge>
                        ) : (
                          <span className="italic text-slate-400">Mới tạo</span>
                        )}
                        <Icon name="arrow-right" className="h-3 w-3 text-slate-400" />
                        <Badge color={STATUS_COLOR[item.den_payment_status] || 'gray'}>
                          {PAYMENT_STATUS_LABEL[item.den_payment_status] || item.den_payment_status}
                        </Badge>
                      </div>
                    )}

                    {(item.ngay_kham_cu || item.ngay_kham_moi) && (
                      <div className="mb-2 text-slate-600">
                        <span className="font-medium text-slate-700">Dời lịch:</span>{' '}
                        {item.ngay_kham_cu || '-'} {item.gio_kham_cu || ''} {'->'} {item.ngay_kham_moi || '-'} {item.gio_kham_moi || ''}
                      </div>
                    )}

                    {item.loai_thay_doi && (
                      <div className="mb-2 text-slate-600">
                        <span className="font-medium text-slate-700">Loại thay đổi:</span> {item.loai_thay_doi}
                      </div>
                    )}

                    {(item.ly_do_thay_doi || item.ly_do) && (
                      <div className="mt-3 border-t border-slate-200 pt-2">
                        <span className="font-medium text-slate-700">Ghi chú/Lý do: </span>
                        <span className="text-slate-600">{item.ly_do_thay_doi || item.ly_do}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
