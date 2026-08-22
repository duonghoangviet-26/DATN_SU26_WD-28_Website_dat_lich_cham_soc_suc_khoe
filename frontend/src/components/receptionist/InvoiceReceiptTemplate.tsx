import { BillingCase } from '@/services/receptionist-patient-intake.service'

interface Props {
  data: BillingCase | null
}

function money(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`
}

function sourceLabel(source: BillingCase['source']) {
  return source === 'online' ? 'Đặt lịch online' : 'Khách tại quầy'
}

function methodLabel(method: 'tien_mat' | 'chuyen_khoan') {
  return method === 'tien_mat' ? 'Tiền mặt' : 'Chuyển khoản'
}

function lineUnitPrice(line: BillingCase['billing_summary']['chi_tiet_thu_phi'][number]) {
  return line.don_gia ?? line.so_tien ?? 0
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function InvoiceReceiptTemplate({ data }: Props) {
  if (!data) return null
  const summary = data.billing_summary
  const paidPayments = data.payments.filter((payment) => payment.status === 'paid')

  return (
    <div id="invoice-print" className="hidden print:block w-full bg-white p-8 text-black font-sans">
      <style type="text/css" media="print">
        {`
          @page { size: A4; margin: 14mm; }
          body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
        `}
      </style>

      <div className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wide">ViteFamily</h1>
          <p className="mt-1 text-sm text-gray-600">Phòng khám Chăm sóc Sức khỏe Gia đình</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold uppercase">Hóa đơn thanh toán</p>
          <p className="mt-1 text-sm">Số: <strong>{data.invoice?.so_hoa_don || 'Chưa lập'}</strong></p>
          <p className="text-xs text-gray-500">Ngày in: {formatDateTime(new Date().toISOString())}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p><span className="text-gray-500">Bệnh nhân:</span> <strong>{data.ten_benh_nhan}</strong></p>
          <p className="mt-1"><span className="text-gray-500">Số điện thoại:</span> {data.so_dien_thoai || '—'}</p>
        </div>
        <div className="text-right">
          <p><span className="text-gray-500">Nguồn:</span> {sourceLabel(data.source)}</p>
          <p className="mt-1">
            <span className="text-gray-500">Ngày khám:</span> {formatDate(data.ngay_kham)}
            {data.gio_kham ? ` · ${data.gio_kham}` : ''}
          </p>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-2">Khoản mục</th>
            <th className="py-2 text-right">SL</th>
            <th className="py-2 text-right">Đơn giá</th>
            <th className="py-2 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {summary.chi_tiet_thu_phi.map((line, index) => (
            <tr key={`${line.service_id || line.ten}-${index}`} className="border-b border-gray-200">
              <td className="py-2">{line.ten}</td>
              <td className="py-2 text-right">{line.so_luong}</td>
              <td className="py-2 text-right">{money(lineUnitPrice(line))}</td>
              <td className="py-2 text-right font-medium">{money(line.thanh_tien)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-72 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Phí khám:</span>
            <span>{money(summary.tong_tien_kham)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Dịch vụ phát sinh:</span>
            <span>{money(summary.tong_tien_phat_sinh)}</span>
          </div>
          <div className="flex justify-between border-t border-black pt-1.5 text-base font-bold">
            <span>Tổng cộng:</span>
            <span>{money(summary.tong_thanh_toan)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Đã thu:</span>
            <span>{money(summary.tong_da_thu)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Còn phải thu:</span>
            <span>{money(summary.con_phai_thu)}</span>
          </div>
        </div>
      </div>

      {paidPayments.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold">Chi tiết các lần thu</p>
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-400 text-left text-gray-600">
                <th className="py-1.5">Thời điểm</th>
                <th className="py-1.5">Hình thức</th>
                <th className="py-1.5">Mã giao dịch</th>
                <th className="py-1.5 text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {paidPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-100">
                  <td className="py-1.5">{formatDateTime(payment.ngay_thanh_toan || payment.ngay_tao)}</td>
                  <td className="py-1.5">{methodLabel(payment.phuong_thuc)}</td>
                  <td className="py-1.5">{payment.ma_giao_dich || payment.id}</td>
                  <td className="py-1.5 text-right">{money(payment.so_tien)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-10 flex justify-between text-sm">
        <div className="text-center">
          <p className="font-semibold">Bệnh nhân</p>
          <p className="mt-1 text-xs text-gray-500">(Ký, ghi rõ họ tên)</p>
        </div>
        <div className="text-center">
          <p className="font-semibold">Lễ tân thu ngân</p>
          <p className="mt-1 text-xs text-gray-500">(Ký, ghi rõ họ tên)</p>
        </div>
      </div>

      <p className="mt-10 text-center text-[11px] italic text-gray-500">
        Cảm ơn quý khách đã sử dụng dịch vụ tại ViteFamily!
      </p>
    </div>
  )
}
