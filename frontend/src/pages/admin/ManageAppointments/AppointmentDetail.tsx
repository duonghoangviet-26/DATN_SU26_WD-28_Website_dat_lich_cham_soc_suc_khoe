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
    ['Ma lich hen', detail.ma_lich_hen || 'Chua co du lieu'],
    ['Benh nhan', detail.benh_nhan],
    ['Loai dat lich', detail.loai_dat_lich === 'proxy' ? 'Dat ho' : 'Tu dat'],
    ['Nguoi dat ho', detail.nguoi_dat_ho_ten || 'Khong co'],
    ['SDT nguoi dat ho', detail.nguoi_dat_sdt || 'Khong co'],
    ['ID tai khoan', detail.user_id || 'Khong co'],
    ['ID thanh vien', detail.member_id || 'Khong co'],
    ['Email', detail.user_email || 'Khong co'],
    ['SDT benh nhan', detail.sdt_benh_nhan || 'Khong co'],
    ['Kenh tao lich', detail.hinh_thuc_dat_lich || 'Khong co'],
    ['Bac si', detail.bac_si || 'Khong tim thay bac si'],
    ['Chuyen khoa / dich vu', detail.chuyen_khoa || 'Khong tim thay chuyen khoa'],
    ['Ngay kham', `${detail.ngay_kham} luc ${detail.gio_kham}`],
    ['Loai kham', EXAM_TYPE_LABEL[detail.loai_kham]],
    ['Dia chi kham', detail.dia_chi_kham || 'Chua co du lieu'],
    ['Ly do kham', detail.ly_do_kham || 'Chua co du lieu'],
    ['Phi kham', formatPrice(detail.gia_kham)],
    ['Trang thai lich', APPOINTMENT_STATUS_LABEL[detail.status]],
    ['Trang thai thanh toan', PAYMENT_STATUS_LABEL[detail.payment_status]],
    ['So lan thay doi', String(detail.so_lan_thay_doi ?? 0)],
    ['Ly do huy', detail.ly_do_huy || 'Khong co'],
    ['Huy boi', detail.huy_boi || 'Khong co'],
    ['Thoi diem huy', detail.thoi_diem_huy ? new Date(detail.thoi_diem_huy).toLocaleString('vi-VN') : 'Khong co'],
    ['Ghi chu le tan', detail.ghi_chu_le_tan || 'Chua co du lieu'],
    ['Ghi chu tiep nhan', detail.ghi_chu_tiep_nhan || 'Chua co du lieu'],
    ['So hoa don', detail.invoice?.so_hoa_don || 'Chua co hoa don'],
    ['Trang thai hoa don', detail.invoice?.trang_thai_hoa_don || 'Chua co hoa don'],
    ['Tong thanh toan', detail.invoice?.tong_thanh_toan != null ? formatPrice(detail.invoice.tong_thanh_toan) : 'Chua co hoa don'],
  ] : []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <h3 className="text-lg font-semibold text-slate-800">Chi tiet lich hen</h3>
            <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-700">
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">Dang tai chi tiet...</div>
          ) : detail ? (
            <>
              <div className="overflow-y-auto px-5 py-5 sm:px-6">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  {rows.map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                      <dd className="mt-1 break-words font-medium text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                <button onClick={onClose} className="btn-secondary w-full">Dong</button>
              </div>
            </>
          ) : (
            <>
              <div className="px-6 py-12 text-center text-sm text-slate-400">Khong tai duoc chi tiet lich hen.</div>
              <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                <button onClick={onClose} className="btn-secondary w-full">Dong</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
