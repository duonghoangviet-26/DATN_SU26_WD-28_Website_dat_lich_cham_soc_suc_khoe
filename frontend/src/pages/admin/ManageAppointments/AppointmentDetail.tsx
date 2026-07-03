import type { AppointmentItem } from '@/types'
import { APPOINTMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL, SERVICE_TYPE_LABEL } from '@/utils/constants'
import { formatPrice } from '@/utils/format'
import Icon from '@/components/admin/icons'

interface Props {
  detail: AppointmentItem | null
  loading: boolean
  onClose: () => void
}

export default function AppointmentDetail({ detail, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Chi tiết lịch hẹn</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Đang tải chi tiết...</div>
        ) : detail ? (
          <>
            <dl className="space-y-3 text-sm">
              {[
                ['Bệnh nhân', detail.benh_nhan],
                ['ID tài khoản', detail.user_id || 'Không có'],
                ['SĐT', detail.sdt_benh_nhan || 'Không có'],
                ['Bác sĩ', detail.bac_si],
                ['Ngày khám', `${detail.ngay_kham} lúc ${detail.gio_kham}`],
                ['Loại khám', SERVICE_TYPE_LABEL[detail.loai_kham]],
                ['Dịch vụ', detail.chuyen_khoa],
                ['Địa chỉ (nếu khám tại nhà)', detail.dia_chi_kham || '-'],
                ['Lý do khám', detail.ly_do_kham || '-'],
                ['Phí khám', formatPrice(detail.gia_kham)],
                ['Trạng thái', APPOINTMENT_STATUS_LABEL[detail.status]],
                ['Thanh toán', PAYMENT_STATUS_LABEL[detail.payment_status]],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <dt className="shrink-0 text-slate-500">{label}</dt>
                  <dd className="break-words text-right font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            <button onClick={onClose} className="btn-secondary mt-6 w-full">Đóng</button>
          </>
        ) : (
          <>
            <div className="py-12 text-center text-sm text-slate-400">Không tải được chi tiết lịch hẹn.</div>
            <button onClick={onClose} className="btn-secondary mt-6 w-full">Đóng</button>
          </>
        )}
      </div>
    </div>
  )
}
