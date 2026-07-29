import { useEffect, useState } from 'react'
import {
  BillingCase,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'

function money(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value) + ' đ'
}

function sourceLabel(source: BillingCase['source']) {
  return source === 'online' ? 'Đặt trước' : 'Vãng lai'
}

export default function Payments() {
  const [cases, setCases] = useState<BillingCase[]>([])
  const [selected, setSelected] = useState<BillingCase | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'tien_mat' | 'chuyen_khoan'>('tien_mat')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadCases() {
    setLoading(true)
    try {
      setCases(await receptionistPatientIntakeService.listBillingCases())
      setError('')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải danh sách chờ thanh toán')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCases() }, [])

  async function selectCase(caseItem: BillingCase) {
    setError(''); setMessage('')
    try {
      setSelected(await receptionistPatientIntakeService.getBillingCase(caseItem.id, caseItem.source))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải chi tiết hóa đơn')
    }
  }

  async function createInvoice() {
    if (!selected) return
    setSaving(true); setError('')
    try {
      const fresh = await receptionistPatientIntakeService.createBillingInvoice(selected.id, selected.source, paymentMethod)
      setSelected(fresh)
      setMessage(paymentMethod === 'tien_mat' ? 'Đã lập hóa đơn và ghi nhận tiền mặt.' : 'Đã lập hóa đơn, đang chờ xác nhận chuyển khoản.')
      await loadCases()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể lập hóa đơn')
    } finally {
      setSaving(false)
    }
  }

  async function resolveTransfer(action: 'confirm' | 'cancel') {
    if (!selected?.pending_payment) return
    setSaving(true); setError('')
    try {
      const fresh = action === 'confirm'
        ? await receptionistPatientIntakeService.confirmBillingPayment(selected.id, selected.source, selected.pending_payment.id)
        : await receptionistPatientIntakeService.cancelBillingPayment(selected.id, selected.source, selected.pending_payment.id)
      setSelected(fresh)
      setMessage(action === 'confirm' ? 'Đã xác nhận chuyển khoản.' : 'Đã hủy giao dịch chuyển khoản chờ xác nhận.')
      await loadCases()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể xử lý giao dịch')
    } finally {
      setSaving(false)
    }
  }

  async function printReceipt() {
    if (!selected) return
    setSaving(true); setError('')
    try {
      await receptionistPatientIntakeService.markBillingReceiptPrinted(selected.id, selected.source)
      window.print()
      setMessage('Đã ghi nhận in/giao hóa đơn.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Chưa thể in hóa đơn')
    } finally {
      setSaving(false)
    }
  }

  const invoice = selected?.invoice ?? null

  return (
    <div className="min-h-full bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Thu ngân · Online + Walk-in</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-800">Thanh toán & hóa đơn</h2>
          <p className="mt-1 text-sm text-slate-500">Chỉ nhận các khoản phí khám và dịch vụ đã được bác sĩ xác nhận.</p>
        </div>
        <button type="button" onClick={loadCases} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Tải lại</button>
      </div>

      {message && <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 print:hidden">{message}</p>}
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 print:hidden">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-bold text-slate-800">Ca chờ thanh toán</h3>
            <p className="mt-1 text-xs text-slate-500">Bao gồm ca đặt trước còn công nợ và ca vãng lai đã có hồ sơ khám xác nhận.</p>
          </div>
          {loading ? <p className="p-5 text-sm text-slate-500">Đang tải...</p> : cases.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Không có ca nào đang chờ thanh toán.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {cases.map((caseItem) => (
                <button key={`${caseItem.source}:${caseItem.id}`} type="button" onClick={() => selectCase(caseItem)} className={`w-full p-4 text-left transition hover:bg-slate-50 ${selected?.id === caseItem.id && selected.source === caseItem.source ? 'bg-brand-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{caseItem.ten_benh_nhan}</p>
                      <p className="mt-1 text-xs text-slate-500">{caseItem.so_dien_thoai || 'Không có số liên hệ'} · {sourceLabel(caseItem.source)}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">{caseItem.invoice?.so_hoa_don || 'Chưa lập hóa đơn'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:mx-auto print:max-w-xl print:border-0 print:shadow-none">
          {!selected ? <p className="py-12 text-center text-sm text-slate-500 print:hidden">Chọn một ca để xem hóa đơn.</p> : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hóa đơn {sourceLabel(selected.source)}</p>
                  <h3 className="mt-1 font-bold text-slate-800">{selected.ten_benh_nhan}</h3>
                  <p className="mt-1 text-xs text-slate-500">{selected.so_dien_thoai || 'Không có số liên hệ'}</p>
                </div>
                {invoice?.so_hoa_don && <span className="text-sm font-semibold text-slate-700">{invoice.so_hoa_don}</span>}
              </div>

              <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between"><span>Phí khám</span><strong>{money(invoice?.tong_tien_kham || 0)}</strong></div>
                {selected.dich_vu_chi_dinh.map((service) => <div key={String(service.service_id)} className="flex justify-between text-slate-600"><span>{service.ten} × {service.so_luong}</span><strong>{money(service.thanh_tien)}</strong></div>)}
                <div className="flex justify-between"><span>Phát sinh</span><strong>{money(invoice?.tong_tien_phat_sinh || 0)}</strong></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><span>Tổng thanh toán</span><strong>{money(invoice?.tong_thanh_toan || 0)}</strong></div>
                <div className="flex justify-between text-emerald-700"><span>Đã thu</span><strong>{money(invoice?.tong_da_thu || 0)}</strong></div>
                <div className="flex justify-between text-rose-700"><span>Còn phải thu</span><strong>{money(invoice?.con_phai_thu || 0)}</strong></div>
              </div>

              {selected.pending_payment && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
                  <p className="font-semibold">Đang chờ xác nhận chuyển khoản</p>
                  <p className="mt-1">Số tiền: {money(selected.pending_payment.so_tien)} · Mã giao dịch: {selected.pending_payment.ma_giao_dich || selected.pending_payment.id}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={saving} onClick={() => resolveTransfer('confirm')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Xác nhận đã nhận tiền</button>
                    <button type="button" disabled={saving} onClick={() => resolveTransfer('cancel')} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-60">Hủy giao dịch</button>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3 print:hidden">
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm">
                  <option value="tien_mat">Tiền mặt</option>
                  <option value="chuyen_khoan">Chuyển khoản</option>
                </select>
                <button type="button" disabled={saving || !!selected.pending_payment || invoice?.trang_thai_hoa_don === 'da_thanh_toan_du'} onClick={createInvoice} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                  {saving ? 'Đang lưu...' : invoice ? 'Thu phần còn lại' : 'Lập hóa đơn & thu tiền'}
                </button>
                {invoice?.trang_thai_hoa_don === 'da_thanh_toan_du' && <button type="button" disabled={saving} onClick={printReceipt} className="min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">In / giao hóa đơn</button>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
