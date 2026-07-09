import Icon from '@/components/admin/icons'
import type { AppointmentItem } from '@/types'
import { APPOINTMENT_STATUS_LABEL, EXAM_TYPE_LABEL, PAYMENT_STATUS_LABEL } from '@/utils/constants'
import { formatPrice } from '@/utils/format'

interface Props {
  detail: AppointmentItem | null
  loading: boolean
  onClose: () => void
}

export default function AppointmentDetail({ detail, loading, onClose }: Props) {
  const rows = detail ? [
    ['Mã lịch hẹn', detail.ma_lich_hen || 'Chưa có dữ liệu'],
    ['Bệnh nhân', detail.benh_nhan],
    ['ID tài khoản', detail.user_id || 'Không có'],
    ['Email', detail.user_email || 'Không có'],
    ['SĐT', detail.sdt_benh_nhan || 'Không có'],
    ['Bác sĩ', detail.bac_si || 'Không tìm thấy bác sĩ'],
    ['Chuyên khoa', detail.chuyen_khoa || 'Không tìm thấy chuyên khoa'],
    ['Ngày khám', `${detail.ngay_kham} lúc ${detail.gio_kham}`],
    ['Loại khám', EXAM_TYPE_LABEL[detail.loai_kham]],
    ['Địa chỉ khám', detail.dia_chi_kham || 'Chưa có dữ liệu'],
    ['Lý do khám', detail.ly_do_kham || 'Chưa có dữ liệu'],
    ['Phí khám', formatPrice(detail.gia_kham)],
    ['Trạng thái lịch', APPOINTMENT_STATUS_LABEL[detail.status]],
    ['Trạng thái thanh toán', PAYMENT_STATUS_LABEL[detail.payment_status]],
    ['Số lần thay đổi', String(detail.so_lan_thay_doi ?? 0)],
    ['Lý do hủy', detail.ly_do_huy || 'Không có'],
    ['Hủy bởi', detail.huy_boi || 'Không có'],
    ['Thời điểm hủy', detail.thoi_diem_huy ? new Date(detail.thoi_diem_huy).toLocaleString('vi-VN') : 'Không có'],
    ['Ghi chú lễ tân', detail.ghi_chu_le_tan || 'Chưa có dữ liệu'],
    ['Ghi chú tiếp nhận', detail.ghi_chu_tiep_nhan || 'Chưa có dữ liệu'],
    ['Số hóa đơn', detail.invoice?.so_hoa_don || 'Chưa có hóa đơn'],
    ['Trạng thái hóa đơn', detail.invoice?.trang_thai_hoa_don || 'Chưa có hóa đơn'],
    ['Tổng thanh toán', detail.invoice?.tong_thanh_toan != null ? formatPrice(detail.invoice.tong_thanh_toan) : 'Chưa có hóa đơn'],
  ] : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
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
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words font-medium text-slate-800">{value}</dd>
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
