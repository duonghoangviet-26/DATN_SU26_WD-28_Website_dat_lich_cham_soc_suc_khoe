import { useEffect, useState } from 'react'
import {
  BillingCase,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'

type PaymentView = 'pending' | 'paid'
type PendingScope = 'today' | 'all'

function money(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`
}

function sourceLabel(source: BillingCase['source']) {
  return source === 'online' ? 'Đặt trước' : 'Khách tại quầy'
}

function methodLabel(method: 'tien_mat' | 'chuyen_khoan') {
  return method === 'tien_mat' ? 'Tiền mặt' : 'Chuyển khoản'
}

function paymentStatusLabel(status: BillingCase['payments'][number]['status']) {
  if (status === 'paid') return 'Đã thanh toán'
  if (status === 'pending') return 'Chờ xác nhận'
  if (status === 'failed') return 'Đã hủy'
  return 'Đã hoàn tiền'
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function lineLabel(type: string) {
  return type === 'phi_kham' ? 'Phí khám' : 'Dịch vụ chỉ định'
}

function formatCaseDate(value?: string | null) {
  if (!value) return 'Chưa rõ ngày'
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function Payments() {
  const [view, setView] = useState<PaymentView>('pending')
  const [pendingScope, setPendingScope] = useState<PendingScope>('today')
  const [cases, setCases] = useState<BillingCase[]>([])
  const [selected, setSelected] = useState<BillingCase | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'tien_mat' | 'chuyen_khoan'>('tien_mat')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadCases(targetView = view, targetScope = pendingScope) {
    setLoading(true)
    try {
      setCases(await receptionistPatientIntakeService.listBillingCases(targetView, targetView === 'pending' ? targetScope : 'all'))
      setError('')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải danh sách thu ngân')
    } finally {
      setLoading(false)
    }
  }

  // loadCases dùng state phạm vi hiện tại; chỉ tải dữ liệu một lần khi mở màn hình.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadCases() }, [])

  async function changeView(nextView: PaymentView) {
    if (nextView === view) return
    setView(nextView)
    setSelected(null)
    setMessage('')
    await loadCases(nextView)
  }

  async function changePendingScope(nextScope: PendingScope) {
    if (nextScope === pendingScope) return
    setPendingScope(nextScope)
    setSelected(null)
    setMessage('')
    await loadCases('pending', nextScope)
  }

  async function selectCase(caseItem: BillingCase) {
    setError('')
    setMessage('')
    try {
      setSelected(await receptionistPatientIntakeService.getBillingCase(caseItem.id, caseItem.source))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải chi tiết hóa đơn')
    }
  }

  async function createInvoice() {
    if (!selected || selected.billing_summary.con_phai_thu <= 0) return
    setSaving(true)
    setError('')
    try {
      const fresh = await receptionistPatientIntakeService.createBillingInvoice(selected.id, selected.source, paymentMethod)
      setSelected(fresh)
      setMessage(paymentMethod === 'tien_mat'
        ? 'Đã ghi nhận thu tiền mặt theo số còn phải thu trên hóa đơn.'
        : 'Đã tạo yêu cầu chuyển khoản. Chỉ xác nhận sau khi đối chiếu giao dịch.')
      await loadCases()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tạo hoặc cập nhật hóa đơn')
    } finally {
      setSaving(false)
    }
  }

  async function resolveTransfer(action: 'confirm' | 'cancel') {
    if (!selected?.pending_payment) return
    setSaving(true)
    setError('')
    try {
      const fresh = action === 'confirm'
        ? await receptionistPatientIntakeService.confirmBillingPayment(selected.id, selected.source, selected.pending_payment.id)
        : await receptionistPatientIntakeService.cancelBillingPayment(selected.id, selected.source, selected.pending_payment.id)
      setSelected(fresh)
      setMessage(action === 'confirm'
        ? 'Đã xác nhận tiền chuyển khoản. Hóa đơn đã được cập nhật.'
        : 'Đã hủy yêu cầu chuyển khoản. Bạn có thể tạo lại khi cần.')
      await loadCases()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể xử lý giao dịch')
    } finally {
      setSaving(false)
    }
  }

  async function printReceipt() {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      const fresh = await receptionistPatientIntakeService.markBillingReceiptPrinted(selected.id, selected.source)
      setSelected(fresh)
      window.print()
      setMessage('Đã ghi nhận in hoặc giao lại hóa đơn.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Chưa thể in hóa đơn')
    } finally {
      setSaving(false)
    }
  }

  const summary = selected?.billing_summary
  const invoice = selected?.invoice ?? null
  const isPaid = summary?.trang_thai_hoa_don === 'da_thanh_toan_du'
  const actionLabel = !summary
    ? 'Chọn ca khám'
    : paymentMethod === 'tien_mat'
      ? `Xác nhận thu tiền mặt ${money(summary.con_phai_thu)}`
      : `Tạo yêu cầu chuyển khoản ${money(summary.con_phai_thu)}`

  return (
    <div className="min-h-full bg-slate-50 p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand-700">Thu ngân</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Hóa đơn và thanh toán</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Số tiền chỉ được lấy từ phí khám và dịch vụ bác sĩ đã xác nhận trong hồ sơ bệnh án.
          </p>
        </div>
        <button type="button" onClick={() => void loadCases()} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          Tải lại
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 print:hidden">
        {view === 'pending' && (
          <div className="flex rounded-lg border border-slate-200 p-1" role="group" aria-label="Phạm vi ca chờ thu">
            <button type="button" aria-pressed={pendingScope === 'today'} onClick={() => void changePendingScope('today')} className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${pendingScope === 'today' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              Hôm nay
            </button>
            <button type="button" aria-pressed={pendingScope === 'all'} onClick={() => void changePendingScope('all')} className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${pendingScope === 'all' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              Tất cả còn phải thu
            </button>
          </div>
        )}
        <div className="flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Danh sách hóa đơn">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'pending'}
            onClick={() => void changeView('pending')}
            className={`rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${view === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Chờ thu
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'paid'}
            onClick={() => void changeView('paid')}
            className={`rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${view === 'paid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Đã thanh toán
          </button>
        </div>
        <p className="text-sm text-slate-600"><strong className="text-slate-900">{cases.length}</strong> {view === 'pending' ? 'ca cần xử lý' : 'hóa đơn đã hoàn tất'}</p>
      </div>

      {message && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 print:hidden">{message}</p>}
      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 print:hidden">{error}</p>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] xl:gap-6">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white print:hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">{view === 'pending' ? 'Ca khám chờ thu tiền' : 'Lịch sử hóa đơn đã thanh toán'}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {view === 'pending'
                ? 'Chọn một ca để kiểm tra chi tiết trước khi ghi nhận thanh toán.'
                : 'Có thể tra cứu, đối chiếu và in lại hóa đơn đã hoàn tất.'}
            </p>
          </div>
          {loading ? <p className="p-5 text-sm text-slate-600">Đang tải danh sách...</p> : cases.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-medium text-slate-700">{view === 'pending' ? 'Không có ca nào cần thu tiền.' : 'Chưa có hóa đơn đã thanh toán.'}</p>
              <p className="mt-1 text-sm text-slate-500">{view === 'pending' ? 'Các ca sẽ xuất hiện tại đây sau khi bác sĩ xác nhận hồ sơ.' : 'Các hóa đơn hoàn tất sẽ được lưu để tra cứu tại đây.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cases.map((caseItem) => {
                const caseSummary = caseItem.billing_summary
                const active = selected?.id === caseItem.id && selected.source === caseItem.source
                return (
                  <button
                    key={`${caseItem.source}:${caseItem.id}`}
                    type="button"
                    onClick={() => void selectCase(caseItem)}
                    aria-pressed={active}
                    className={`w-full px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{caseItem.ten_benh_nhan}</p>
                        <p className="mt-1 truncate text-xs text-slate-600">{caseItem.so_dien_thoai || 'Không có số liên hệ'} · {sourceLabel(caseItem.source)}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatCaseDate(caseItem.ngay_kham)}{caseItem.gio_kham ? ` · ${caseItem.gio_kham}` : ''} · {caseItem.invoice?.so_hoa_don || 'Chưa lập hóa đơn'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-bold ${view === 'paid' ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {money(view === 'paid' ? caseSummary.tong_da_thu : caseSummary.con_phai_thu)}
                        </p>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${view === 'paid' ? 'bg-emerald-100 text-emerald-800' : caseItem.pending_payment ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          {view === 'paid' ? 'Đã thanh toán' : caseItem.pending_payment ? 'Chờ chuyển khoản' : 'Chưa thu'}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 print:mx-auto print:max-w-xl print:border-0 print:p-0">
          {!selected || !summary ? (
            <div className="py-20 text-center print:hidden">
              <p className="font-medium text-slate-700">Chọn một ca khám để kiểm tra hóa đơn</p>
              <p className="mt-1 text-sm text-slate-500">Chi tiết phí khám, dịch vụ chỉ định và lịch sử giao dịch sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-sm font-semibold text-brand-700">{sourceLabel(selected.source)}</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{selected.ten_benh_nhan}</h2>
                  <p className="mt-1 text-sm text-slate-600">{selected.so_dien_thoai || 'Không có số liên hệ'}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-slate-700">{invoice?.so_hoa_don || 'CHƯA LẬP HÓA ĐƠN'}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isPaid ? 'bg-emerald-100 text-emerald-800' : selected.pending_payment ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                    {isPaid ? 'Đã thanh toán đủ' : selected.pending_payment ? 'Chờ xác nhận chuyển khoản' : 'Chưa thu tiền'}
                  </span>
                </div>
              </div>

              {summary.source === 'medical_record' && (
                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900 print:hidden">
                  Đây là số tiền xem trước từ hồ sơ bệnh án đã xác nhận. Khi thu tiền, hệ thống sẽ lập hóa đơn với đúng các mục bên dưới.
                </div>
              )}

              <div className="mt-5 divide-y divide-slate-100 text-sm">
                {summary.chi_tiet_thu_phi.map((line, index) => (
                  <div key={`${line.service_id || line.ten}-${index}`} className="flex items-start justify-between gap-5 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{line.ten}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{lineLabel(line.loai || 'dich_vu')} · {money(line.so_tien || line.don_gia || 0)} × {line.so_luong}</p>
                    </div>
                    <strong className="shrink-0 text-slate-900">{money(line.thanh_tien)}</strong>
                  </div>
                ))}
              </div>

              <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between gap-4 text-slate-700"><dt>Tổng thanh toán</dt><dd className="font-semibold text-slate-900">{money(summary.tong_thanh_toan)}</dd></div>
                <div className="flex justify-between gap-4 text-emerald-800"><dt>Đã thu</dt><dd className="font-semibold">{money(summary.tong_da_thu)}</dd></div>
                <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base text-slate-900"><dt className="font-semibold">Còn phải thu</dt><dd className="font-bold">{money(summary.con_phai_thu)}</dd></div>
              </dl>

              {selected.pending_payment && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
                  <p className="font-semibold">Đối chiếu trước khi xác nhận</p>
                  <p className="mt-1 leading-6">{money(selected.pending_payment.so_tien)} · {selected.pending_payment.ma_giao_dich || selected.pending_payment.id}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={saving} onClick={() => void resolveTransfer('confirm')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60">Xác nhận đã nhận tiền</button>
                    <button type="button" disabled={saving} onClick={() => void resolveTransfer('cancel')} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-60">Hủy yêu cầu</button>
                  </div>
                </div>
              )}

              {selected.payments.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <h3 className="font-semibold text-slate-900">Lịch sử giao dịch</h3>
                  <div className="mt-2 divide-y divide-slate-100 text-sm">
                    {selected.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between gap-4 py-2.5">
                        <div>
                          <p className="font-medium text-slate-800">{methodLabel(payment.phuong_thuc)} · {paymentStatusLabel(payment.status)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{payment.ma_giao_dich || payment.id} · {formatDateTime(payment.ngay_thanh_toan || payment.ngay_tao)}</p>
                        </div>
                        <strong className={payment.status === 'paid' ? 'text-emerald-700' : 'text-slate-700'}>{money(payment.so_tien)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isPaid && !selected.pending_payment && summary.con_phai_thu > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-5 print:hidden">
                  <label htmlFor="payment-method" className="text-sm font-semibold text-slate-900">Phương thức thanh toán</label>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <select id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
                      <option value="tien_mat">Tiền mặt</option>
                      <option value="chuyen_khoan">Chuyển khoản</option>
                    </select>
                    <button type="button" disabled={saving} onClick={() => void createInvoice()} className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
                      {saving ? 'Đang ghi nhận...' : actionLabel}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Số tiền không thể sửa tại đây để tránh lệch với hồ sơ bệnh án và hóa đơn.</p>
                </div>
              )}

              {isPaid && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 print:hidden">
                  <p className="text-sm font-medium text-emerald-800">Hóa đơn đã thanh toán đủ.</p>
                  <button type="button" disabled={saving} onClick={() => void printReceipt()} className="min-h-10 rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-60">In / giao lại hóa đơn</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
