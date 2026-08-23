import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react'
import TablePaginationFooter from '@/components/common/TablePaginationFooter'
import {
  BillingCase,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'
import { PageShell, ReceptionistHeader } from '@/components/receptionist/ReceptionistUI'
import InvoiceReceiptTemplate from '@/components/receptionist/InvoiceReceiptTemplate'
import { printInvoice } from '@/utils/printInvoice'

type PaymentView = 'pending' | 'paid'
type BillingScope = 'today' | 'all'

const PAGE_SIZE = 8

function money(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`
}

function sourceLabel(source: BillingCase['source']) {
  return source === 'online' ? 'Đặt lịch online' : 'Khách tại quầy'
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

function lineLabel(type: string) {
  return type === 'phi_kham' ? 'Phí khám trả trước' : 'Dịch vụ phát sinh sau khám'
}

function paymentTypeLabel(type: BillingCase['payments'][number]['loai_thanh_toan']) {
  return type === 'thanh_toan_bo_sung' ? 'Thanh toán thêm sau khám' : 'Phí khám trả trước'
}

function formatCaseDate(value?: string | null) {
  if (!value) return 'Chưa rõ ngày'
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isOverdueCase(caseItem: BillingCase): boolean {
  if (!caseItem.ngay_kham) return false
  const examDay = new Date(caseItem.ngay_kham)
  examDay.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return examDay.getTime() < today.getTime()
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function matchesSearch(caseItem: BillingCase, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystacks = [
    caseItem.ten_benh_nhan,
    caseItem.so_dien_thoai,
    caseItem.invoice?.so_hoa_don,
    ...caseItem.payments.map((payment) => payment.ma_giao_dich),
  ]
  return haystacks.some((value) => value?.toLowerCase().includes(q))
}

function casePaymentLabel(caseItem: BillingCase, view: PaymentView) {
  if (view === 'paid') return 'Đã đối chiếu đủ hóa đơn'
  if (caseItem.pending_payment) return 'Chờ xác nhận chuyển khoản'
  if (caseItem.billing_summary.con_phai_thu_sau_kham > 0 && caseItem.billing_summary.tong_da_thu_truoc > 0) {
    return 'Còn dịch vụ phát sinh cần thu'
  }
  if (caseItem.billing_summary.tong_da_thu_truoc > 0) return 'Đã thu trước, chờ đối chiếu'
  return 'Chờ thu sau khám'
}

function statusTone(caseItem: BillingCase, view: PaymentView) {
  if (view === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (caseItem.pending_payment) return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className={`flex min-h-[108px] flex-col justify-between rounded-lg border px-4 py-4 ${tone || 'border-slate-200 bg-white'}`}>
      <p className="text-[12px] font-medium leading-5 text-slate-500">{label}</p>
      <p className="mt-3 text-[28px] font-bold leading-none text-slate-950">{value}</p>
    </div>
  )
}

function SectionTitle({
  index,
  title,
  hint,
}: {
  index: number
  title: string
  hint: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{index}</span>
      <div>
        <h3 className="text-base font-bold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{hint}</p>
      </div>
    </div>
  )
}

export default function Payments() {
  const [view, setView] = useState<PaymentView>('pending')
  // Mặc định 'all': lọc theo hôm nay từng khiến ca chưa được lễ tân đối chiếu (đặc biệt case
  // đã thanh toán online, "còn phải thu" = 0đ) biến mất khỏi danh sách "Chờ thu" khi qua ngày,
  // dẫn tới bị bỏ quên vô thời hạn dù hóa đơn thật sự chưa được xác nhận thu ngân.
  const [scope, setScope] = useState<BillingScope>('all')
  const [cases, setCases] = useState<BillingCase[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<BillingCase | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'tien_mat' | 'chuyen_khoan'>('tien_mat')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadCases(targetView = view, targetScope = scope) {
    setLoading(true)
    try {
      setCases(await receptionistPatientIntakeService.listBillingCases(targetView, targetScope))
      setError('')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải danh sách thu ngân')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function changeView(nextView: PaymentView) {
    if (nextView === view) return
    setView(nextView)
    setSelected(null)
    setMessage('')
    setPage(1)
    await loadCases(nextView, scope)
  }

  async function changeScope(nextScope: BillingScope) {
    if (nextScope === scope) return
    setScope(nextScope)
    setSelected(null)
    setMessage('')
    setPage(1)
    await loadCases(view, nextScope)
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
    if (!selected) return
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
        : 'Đã hủy yêu cầu chuyển khoản. Có thể tạo lại khi cần.')
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
      // Doi 1 tick de #invoice-print nhan du lieu `fresh` truoc khi in — tranh in nham
      // ban hoa don cu (hoac rong) do setSelected chua kip render lai.
      requestAnimationFrame(() => printInvoice())
      setMessage('Đã ghi nhận in hoặc giao lại hóa đơn.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Chưa thể in hóa đơn')
    } finally {
      setSaving(false)
    }
  }

  const filteredCases = useMemo(
    () => cases.filter((caseItem) => matchesSearch(caseItem, searchQuery)),
    [cases, searchQuery],
  )
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE))
  const paginatedCases = filteredCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const summary = selected?.billing_summary
  const invoice = selected?.invoice ?? null
  const isCashierConfirmed = selected?.da_xac_nhan_thu_ngan === true || summary?.da_xac_nhan_thu_ngan === true
  const needsCashierConfirmation = Boolean(summary && !isCashierConfirmed)
  const todayLabel = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const pendingCount = filteredCases.filter((item) => !item.billing_summary.da_xac_nhan_thu_ngan).length
  const transferCount = filteredCases.filter((item) => Boolean(item.pending_payment)).length
  const remainingTotal = filteredCases.reduce((sum, item) => sum + Number(item.billing_summary.con_phai_thu || 0), 0)
  // Ca đã qua ngày khám nhưng vẫn chưa được lễ tân xác nhận thu ngân — dễ bị quên vì mọi nơi
  // khác trong hệ thống (trang bệnh nhân, màn khám bác sĩ) đã hiển thị "đã thanh toán" từ trước.
  const overdueCases = view === 'pending' ? filteredCases.filter(isOverdueCase) : []
  const actionLabel = !summary
    ? 'Chọn ca khám'
    : summary.con_phai_thu <= 0
      ? 'Xác nhận đã đối chiếu (0đ)'
      : paymentMethod === 'tien_mat'
        ? `Xác nhận thu tiền mặt ${money(summary.con_phai_thu)}`
        : `Tạo yêu cầu chuyển khoản ${money(summary.con_phai_thu)}`

  return (
    <PageShell>
        <InvoiceReceiptTemplate data={selected} />

        <ReceptionistHeader
          eyebrow="Viện phí & hóa đơn"
          title="Thanh toán tại quầy"
          description="Tra cứu hóa đơn, đối chiếu khoản thu và xác nhận thanh toán."
          metrics={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label={scope === 'today' ? `Ca đang xem · ${todayLabel}` : 'Ca đang xem'}
                value={`${pendingCount} ca`}
              />
              <MetricTile
                label="Quá hạn xác nhận"
                value={`${overdueCases.length} ca`}
                tone={overdueCases.length > 0 ? 'border-rose-200 bg-rose-50/80' : 'border-slate-200 bg-white'}
              />
              <MetricTile
                label="Chờ chuyển khoản"
                value={`${transferCount} GD`}
                tone="border-amber-200 bg-amber-50/80"
              />
              <MetricTile
                label="Tổng còn phải thu"
                value={money(remainingTotal)}
                tone="border-cyan-200 bg-cyan-50/80"
              />
            </div>
          }
        />

        {(message || error) && (
          <div className="grid gap-3">
            {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{message}</p>}
            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{error}</p>}
          </div>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm theo tên bệnh nhân, số điện thoại, số hóa đơn hoặc mã giao dịch"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>

            <div className="flex shrink-0 rounded-lg bg-slate-100 p-1">
              <button type="button" onClick={() => void changeScope('today')} className={`min-w-[92px] rounded-md px-3 py-2 text-sm font-semibold transition ${scope === 'today' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                Hôm nay
              </button>
              <button type="button" onClick={() => void changeScope('all')} className={`min-w-[92px] rounded-md px-3 py-2 text-sm font-semibold transition ${scope === 'all' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                Tất cả
              </button>
            </div>

            <div className="flex shrink-0 rounded-lg bg-slate-100 p-1">
              <button type="button" onClick={() => void changeView('pending')} className={`min-w-[104px] rounded-md px-3 py-2 text-sm font-semibold transition ${view === 'pending' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                Chờ thu
              </button>
              <button type="button" onClick={() => void changeView('paid')} className={`min-w-[128px] rounded-md px-3 py-2 text-sm font-semibold transition ${view === 'paid' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                Đã thanh toán
              </button>
            </div>

            <button type="button" onClick={() => void loadCases()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <RefreshCcw className="h-4 w-4" />
              Tải lại
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">Danh sách đang thao tác</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {view === 'pending'
                    ? 'Chọn ca cần thu để mở bàn thao tác.'
                    : 'Chọn hóa đơn đã hoàn tất để kiểm tra lại hoặc in lại.'}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{filteredCases.length} ca</span>
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-sm text-slate-500">Đang tải danh sách...</div>
          ) : filteredCases.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-medium text-slate-700">
                {view === 'pending'
                  ? (scope === 'today' ? 'Không có ca nào hôm nay cần thu.' : 'Không có ca nào cần thu.')
                  : (scope === 'today' ? 'Chưa có hóa đơn nào hôm nay đã thanh toán.' : 'Chưa có hóa đơn đã thanh toán.')}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {scope === 'today' ? `Danh sách đang lọc theo ${todayLabel}.` : 'Thử đổi bộ lọc hoặc tải lại để lấy dữ liệu mới nhất.'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden border-b border-slate-100 bg-slate-50/80 px-5 py-3 lg:block">
                <div className="grid grid-cols-[56px_minmax(220px,1.4fr)_minmax(200px,1fr)_minmax(200px,1fr)_140px] gap-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                  <span>STT</span>
                  <span>Bệnh nhân</span>
                  <span>Trạng thái</span>
                  <span>Lịch / hóa đơn</span>
                  <span className="text-right">{view === 'paid' ? 'Đã thu' : 'Còn phải thu'}</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {paginatedCases.map((caseItem, index) => {
                  const active = selected?.id === caseItem.id && selected?.source === caseItem.source
                  return (
                    <button
                      key={`${caseItem.source}:${caseItem.id}`}
                      type="button"
                      onClick={() => void selectCase(caseItem)}
                      className={`w-full px-5 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="grid gap-3 lg:grid-cols-[56px_minmax(220px,1.4fr)_minmax(200px,1fr)_minmax(200px,1fr)_140px] lg:items-center lg:gap-4">
                        <div className="flex lg:block">
                          <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {(page - 1) * PAGE_SIZE + index + 1}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-slate-950">{caseItem.ten_benh_nhan}</p>
                          <p className="mt-1 text-xs text-slate-500">{caseItem.so_dien_thoai || 'Không có số liên hệ'}</p>
                        </div>

                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(caseItem, view)}`}>
                            {casePaymentLabel(caseItem, view)}
                          </span>
                          {view === 'pending' && isOverdueCase(caseItem) && (
                            <span className="ml-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">
                              Quá hạn xác nhận
                            </span>
                          )}
                          <p className="mt-2 text-xs text-slate-500">{sourceLabel(caseItem.source)}</p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700">
                            {formatCaseDate(caseItem.ngay_kham)}
                            {caseItem.gio_kham ? ` · ${caseItem.gio_kham}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {caseItem.invoice?.so_hoa_don || 'Chưa lập hóa đơn'}
                          </p>
                        </div>

                        <div className="text-left lg:text-right">
                          <p className={`text-base font-bold ${view === 'paid' ? 'text-emerald-700' : 'text-slate-950'}`}>
                            {money(view === 'paid' ? caseItem.billing_summary.tong_da_thu : caseItem.billing_summary.con_phai_thu)}
                          </p>
                          <p className="mt-1 text-[11px] font-medium text-slate-500">{view === 'paid' ? 'Đã thu' : 'Còn phải thu'}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <TablePaginationFooter
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredCases.length}
                currentItemCount={paginatedCases.length}
                itemLabel="ca"
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </section>

      {selected && summary && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20 backdrop-blur-[1px] print:hidden" onMouseDown={() => setSelected(null)}>
          <aside
            className="flex h-full w-full max-w-[880px] flex-col overflow-hidden bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-brand-700">{sourceLabel(selected.source)}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{selected.ten_benh_nhan}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selected.so_dien_thoai || 'Không có số liên hệ'} · {formatCaseDate(selected.ngay_kham)}
                  {selected.gio_kham ? ` · ${selected.gio_kham}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Đóng chi tiết thanh toán"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 md:grid-cols-4">
                <MetricTile label="Số hóa đơn" value={invoice?.so_hoa_don || 'Chưa lập'} />
                <MetricTile label="Tổng hóa đơn" value={money(summary.tong_thanh_toan)} />
                <MetricTile label="Đã thu" value={money(summary.tong_da_thu)} tone="border-emerald-200 bg-emerald-50" />
                <MetricTile label="Còn phải thu" value={money(summary.con_phai_thu)} tone={summary.con_phai_thu > 0 ? 'border-amber-200 bg-amber-50' : 'border-brand-100 bg-brand-50'} />
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <SectionTitle
                      index={1}
                      title="Đối chiếu số tiền phải thu"
                      hint="Kiểm tra phí khám, dịch vụ phát sinh và số còn thiếu trước khi xác nhận."
                    />

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <MetricTile label="Phí khám" value={money(summary.tong_tien_kham)} />
                      <MetricTile label="Dịch vụ phát sinh" value={money(summary.tong_tien_phat_sinh)} />
                      <MetricTile label="Cần thu sau khám" value={money(summary.con_phai_thu_sau_kham)} tone={summary.con_phai_thu_sau_kham > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'} />
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <h3 className="font-semibold text-slate-950">Chi tiết thu phí</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {summary.chi_tiet_thu_phi.map((line, index) => (
                        <div key={`${line.service_id || line.ten}-${index}`} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                          <div>
                            <p className="font-medium text-slate-900">{line.ten}</p>
                            <p className="mt-1 text-xs text-slate-500">{lineLabel(line.loai || 'dich_vu')} · {money(line.so_tien || line.don_gia || 0)} × {line.so_luong}</p>
                          </div>
                          <strong className="shrink-0 text-slate-950">{money(line.thanh_tien)}</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <h3 className="font-semibold text-slate-950">Lịch sử giao dịch</h3>
                    </div>
                    {selected.payments.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-500">Chưa có giao dịch nào được ghi nhận.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {selected.payments.map((payment) => (
                          <div key={payment.id} className="px-4 py-3 text-sm">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-medium text-slate-900">{paymentTypeLabel(payment.loai_thanh_toan)}</p>
                                <p className="mt-1 text-xs text-slate-500">{methodLabel(payment.phuong_thuc)} · {paymentStatusLabel(payment.status)}</p>
                              </div>
                              <strong className={payment.status === 'paid' ? 'text-emerald-700' : 'text-slate-800'}>{money(payment.so_tien)}</strong>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">{payment.ma_giao_dich || payment.id} · {formatDateTime(payment.ngay_thanh_toan || payment.ngay_tao)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <SectionTitle
                    index={2}
                    title="Thao tác thu ngân"
                    hint="Chỉ hiện hành động phù hợp với ca đang chọn."
                  />

                  {selected.pending_payment ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-start gap-3">
                          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                          <div>
                            <p className="font-semibold text-amber-950">Chờ xác nhận chuyển khoản</p>
                            <p className="mt-1 text-sm text-amber-900">{money(selected.pending_payment.so_tien)} · {selected.pending_payment.ma_giao_dich || selected.pending_payment.id}</p>
                            <p className="mt-2 text-xs leading-5 text-amber-800">Chỉ xác nhận sau khi đối chiếu tiền vào thực tế.</p>
                          </div>
                        </div>
                      </div>

                      <button type="button" disabled={saving} onClick={() => void resolveTransfer('confirm')} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60">
                        <CheckCircle2 className="h-4 w-4" />
                        Xác nhận đã nhận tiền
                      </button>

                      <button type="button" disabled={saving} onClick={() => void resolveTransfer('cancel')} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60">
                        <AlertCircle className="h-4 w-4" />
                        Hủy yêu cầu chuyển khoản
                      </button>
                    </div>
                  ) : needsCashierConfirmation ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">Số tiền cần xử lý</p>
                        <p className="mt-2 text-2xl font-bold text-slate-950">{money(summary.con_phai_thu)}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {summary.con_phai_thu > 0 ? 'Chọn phương thức rồi xác nhận. Hệ thống sẽ lập hoặc cập nhật hóa đơn.' : 'Ca này đã đủ tiền. Bấm xác nhận để hoàn tất thu ngân.'}
                        </p>
                      </div>

                      {summary.con_phai_thu > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">Phương thức thanh toán</p>
                          <div className="mt-3 grid gap-2">
                            <button type="button" onClick={() => setPaymentMethod('tien_mat')} className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition ${paymentMethod === 'tien_mat' ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-slate-50'}`}>
                              <span className="flex items-center gap-2 font-semibold"><CircleDollarSign className="h-4 w-4" />Tiền mặt</span>
                              {paymentMethod === 'tien_mat' && <CheckCircle2 className="h-4 w-4 text-brand-700" />}
                            </button>
                            <button type="button" onClick={() => setPaymentMethod('chuyen_khoan')} className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition ${paymentMethod === 'chuyen_khoan' ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-slate-50'}`}>
                              <span className="flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4" />Chuyển khoản</span>
                              {paymentMethod === 'chuyen_khoan' && <CheckCircle2 className="h-4 w-4 text-brand-700" />}
                            </button>
                          </div>
                        </div>
                      )}

                      <button type="button" disabled={saving} onClick={() => void createInvoice()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60">
                        {paymentMethod === 'tien_mat' ? <CreditCard className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                        {saving ? 'Đang ghi nhận...' : actionLabel}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                          <div>
                            <p className="font-semibold text-emerald-950">Ca này đã hoàn tất thu ngân</p>
                            <p className="mt-1 text-sm text-emerald-900">Hóa đơn đã thanh toán đủ và đã được xác nhận.</p>
                          </div>
                        </div>
                      </div>

                      <button type="button" disabled={saving} onClick={() => void printReceipt()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-60">
                        <FileSpreadsheet className="h-4 w-4" />
                        In / giao lại hóa đơn
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </aside>
        </div>
      )}
    </PageShell>
  )
}
