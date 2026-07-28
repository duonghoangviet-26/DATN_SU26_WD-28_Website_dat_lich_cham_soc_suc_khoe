import { useEffect, useState } from 'react'
import {
  OfflineInvoice,
  OfflinePendingPayment,
  OfflineQueueSummary,
  OfflineRelatedService,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'

function money(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value) + ' đ'
}

function dateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function Payments() {
  const [queues, setQueues] = useState<OfflineQueueSummary[]>([])
  const [selected, setSelected] = useState<OfflineQueueSummary | null>(null)
  const [invoice, setInvoice] = useState<OfflineInvoice | null>(null)
  const [pendingPayment, setPendingPayment] = useState<OfflinePendingPayment | null>(null)
  const [services, setServices] = useState<OfflineRelatedService[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'tien_mat' | 'chuyen_khoan'>('tien_mat')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadQueues() {
    setLoading(true)
    try {
      setQueues(await receptionistPatientIntakeService.listOfflineQueues())
      setError('')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Khong the tai danh sach luot kham')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadQueues() }, [])

  async function selectQueue(queue: OfflineQueueSummary) {
    setSelected(queue)
    setMessage('')
    setError('')
    try {
      const [invoiceData, serviceData] = await Promise.all([
        receptionistPatientIntakeService.getOfflineInvoice(queue.id),
        receptionistPatientIntakeService.listRelatedServices(queue.specialty_id),
      ])
      const loadedInvoice = invoiceData.invoice
      setInvoice(loadedInvoice)
      setPendingPayment(invoiceData.pending_payment)
      setServices(serviceData)
      setSelectedServices((loadedInvoice?.chi_tiet_thu_phi ?? [])
        .filter((line) => line.loai === 'dich_vu' && line.service_id)
        .map((line) => String(line.service_id)))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Khong the tai hoa don')
    }
  }

  async function collectPayment() {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      const result = await receptionistPatientIntakeService.createOfflineInvoice(selected.id, {
        dich_vu_phat_sinh: selectedServices.map((service_id) => ({ service_id, so_luong: 1 })),
        phuong_thuc: paymentMethod,
      })
      setInvoice(result.invoice)
      setPendingPayment(result.pending_payment)
      setMessage(paymentMethod === 'tien_mat' ? 'Da lap hoa don va thu tien mat' : 'Da lap hoa don, cho xac nhan chuyen khoan')
      await loadQueues()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Khong the lap hoa don')
    } finally {
      setSaving(false)
    }
  }

  async function resolvePendingPayment(action: 'confirm' | 'cancel') {
    if (!selected || !pendingPayment) return
    setSaving(true)
    setError('')
    try {
      const result = action === 'confirm'
        ? await receptionistPatientIntakeService.confirmOfflinePayment(selected.id, pendingPayment.id)
        : await receptionistPatientIntakeService.cancelOfflinePayment(selected.id, pendingPayment.id)
      setInvoice(result.invoice)
      setPendingPayment(null)
      setMessage(action === 'confirm' ? 'Da xac nhan chuyen khoan' : 'Da huy giao dich chuyen khoan')
      await loadQueues()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Khong the xu ly giao dich')
    } finally {
      setSaving(false)
    }
  }

  function toggleService(id: string) {
    setSelectedServices((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id])
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Offline · Thu ngan</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-800">Thanh toan & Thu ngan</h2>
          <p className="mt-1 text-sm text-slate-500">Lap hoa don sau kham, bo sung dich vu phat sinh va thu phan con thieu.</p>
        </div>
        <button type="button" onClick={loadQueues} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Tai lai</button>
      </div>

      {message && <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-bold text-slate-800">Luot cho lap hoa don</h3>
            <p className="mt-1 text-xs text-slate-500">Chi hien thi luot offline da ket thuc hoac dang cho dich vu.</p>
          </div>
          {loading ? <p className="p-5 text-sm text-slate-500">Dang tai...</p> : queues.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Chua co luot offline can thanh toan.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {queues.map((queue) => (
                <button key={queue.id} type="button" onClick={() => selectQueue(queue)} className={`w-full p-4 text-left transition hover:bg-slate-50 ${selected?.id === queue.id ? 'bg-brand-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{queue.ten_benh_nhan}</p>
                      <p className="mt-1 text-xs text-slate-500">{queue.so_dien_thoai || 'Khong co so dien thoai'} · {dateTime(queue.checkin_time)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${queue.invoice?.trang_thai_hoa_don === 'da_thanh_toan_du' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {queue.invoice?.so_hoa_don || 'Chua lap'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? <p className="py-12 text-center text-sm text-slate-500">Chon mot luot kham de xem hoa don.</p> : (
            <>
              <h3 className="font-bold text-slate-800">{selected.ten_benh_nhan}</h3>
              <p className="mt-1 text-xs text-slate-500">Trang thai luot: {selected.trang_thai}</p>
              <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between"><span>Phi kham</span><strong>{money(invoice?.tong_tien_kham || 0)}</strong></div>
                <div className="flex justify-between"><span>Phat sinh</span><strong>{money(invoice?.tong_tien_phat_sinh || 0)}</strong></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><span>Tong thanh toan</span><strong>{money(invoice?.tong_thanh_toan || 0)}</strong></div>
                <div className="flex justify-between text-emerald-700"><span>Da thu</span><strong>{money(invoice?.tong_da_thu || 0)}</strong></div>
                <div className="flex justify-between text-rose-700"><span>Con phai thu</span><strong>{money(invoice?.con_phai_thu || 0)}</strong></div>
              </div>

              {pendingPayment && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Dang cho xac nhan chuyen khoan</p>
                  <p className="mt-1">So tien: {money(pendingPayment.so_tien)} · Ma giao dich: {pendingPayment.ma_giao_dich || pendingPayment.id}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={saving} onClick={() => resolvePendingPayment('confirm')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Xac nhan da nhan tien</button>
                    <button type="button" disabled={saving} onClick={() => resolvePendingPayment('cancel')} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-60">Huy giao dich</button>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-700">Dich vu phat sinh</p>
                <div className="space-y-2">
                  {services.map((service) => (
                    <label key={service._id} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm hover:border-brand-300">
                      <span><input type="checkbox" checked={selectedServices.includes(service._id)} onChange={() => toggleService(service._id)} className="mr-2" />{service.ten}</span>
                      <strong>{money(service.gia)}</strong>
                    </label>
                  ))}
                  {services.length === 0 && <p className="text-xs text-slate-500">Chua co dich vu lien quan dang hoat dong.</p>}
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm">
                  <option value="tien_mat">Tien mat</option>
                  <option value="chuyen_khoan">Chuyen khoan</option>
                </select>
                <button type="button" disabled={saving || !!pendingPayment} onClick={collectPayment} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                  {saving
                    ? 'Dang luu...'
                    : !invoice || invoice.con_phai_thu
                      ? 'Lap hoa don & thu tien'
                      : 'Cap nhat hoa don'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
