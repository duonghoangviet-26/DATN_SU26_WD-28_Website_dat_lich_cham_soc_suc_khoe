import { useEffect, useState } from 'react'
import { serviceService } from '@/services/service.service'
import type { ServiceItem, ServiceType, ServiceStatus, ServiceFormData } from '@/types'
import { SERVICE_TYPE_LABEL } from '@/utils/constants'
import { formatPrice } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import ServiceFormModal from '@/components/admin/services/ServiceFormModal'
import ServiceViewModal from '@/components/admin/services/ServiceViewModal'

// ─── Hằng số ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const TYPE_TABS = [
  { value: '' as const,        label: 'Tất cả' },
  { value: 'related' as const, label: 'Dịch vụ liên quan' },
  { value: 'home' as const,    label: 'Tại nhà' },
]

const STATUS_TABS: { value: ServiceStatus | ''; label: string }[] = [
  { value: '',         label: 'Tất cả' },
  { value: 'active',   label: 'Hoạt động' },
  { value: 'inactive', label: 'Đã ẩn' },
]

const TYPE_BADGE_COLOR: Record<ServiceType, 'blue' | 'yellow'> = {
  related: 'blue',
  home:    'yellow',
}

const TH_SORT  = 'cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-100'
const TH_PLAIN = 'whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500'
const NUMERIC_COLS = ['gia', 'thoi_gian_phut', 'so_bac_si']

// ─── Component chính ──────────────────────────────────────────────────────────
export default function ManageServices() {

  // ── Dữ liệu ─────────────────────────────────────────────────────────────────
  const [services, setServices]       = useState<ServiceItem[]>([])
  const [allServices, setAllServices] = useState<ServiceItem[]>([]) // cho stats (không lọc)
  const [loading, setLoading]         = useState(true)

  // ── Filter và tìm kiếm ──────────────────────────────────────────────────────
  const [activeType, setActiveType]     = useState<ServiceType | ''>('')
  const [activeStatus, setActiveStatus] = useState<ServiceStatus | ''>('')
  const [searchInput, setSearchInput]   = useState('')
  const [search, setSearch]             = useState('')

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [page, setPage]             = useState(1)
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [reloadKey, setReloadKey]   = useState(0)
  function triggerReload() { setReloadKey(k => k + 1) }

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [formTarget, setFormTarget]     = useState<ServiceItem | 'new' | null>(null)
  const [viewTarget, setViewTarget]     = useState<ServiceItem | null>(null)
  const [viewLoading, setViewLoading]   = useState(false)
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null)

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Sắp xếp ─────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState('ma_dich_vu')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ─── Debounce tìm kiếm 300ms ─────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // ─── Reset về trang 1 khi đổi filter ─────────────────────────────────────────
  useEffect(() => { setPage(1) }, [activeType, activeStatus, search])

  // ─── Tải danh sách (có phân trang) ───────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    serviceService
      .getAll(activeType, search, activeStatus, page, PAGE_SIZE)
      .then(({ items, total, totalPages }) => {
        setServices(items)
        setTotal(total)
        setTotalPages(totalPages)
      })
      .catch(() => showToast('Không thể tải danh sách dịch vụ', 'error'))
      .finally(() => setLoading(false))
  }, [activeType, activeStatus, search, page, reloadKey])

  // ─── Tải toàn bộ (không lọc) để tính stats ───────────────────────────────────
  function loadStats() {
    serviceService.getAll('', '', '', 1, 9999).then(({ items }) => setAllServices(items))
  }
  useEffect(() => { loadStats() }, [])

  const stats = {
    total:    allServices.length,
    active:   allServices.filter(s => s.status === 'active').length,
    inactive: allServices.filter(s => s.status === 'inactive').length,
    related:  allServices.filter(s => s.loai === 'related').length,
    home:     allServices.filter(s => s.loai === 'home').length,
  }

  // ─── Sort client-side (trên trang hiện tại) ──────────────────────────────────
  function getSortedServices() {
    return [...services].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey]
      const bv = (b as unknown as Record<string, unknown>)[sortKey]
      let cmp: number
      if (sortKey === 'ma_dich_vu') {
        // Numeric sort: DV001→1, DV010→10, DV1000→1000 (không phải string sort)
        const toNum = (s: unknown) => parseInt(String(s ?? '').replace(/\D/g, ''), 10) || 0
        cmp = toNum(av) - toNum(bv)
      } else if (NUMERIC_COLS.includes(sortKey)) {
        cmp = (Number(av) || 0) - (Number(bv) || 0)
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'vi', { sensitivity: 'base' })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function sortIcon(key: string) {
    if (sortKey !== key) return <span className="text-[11px] text-slate-300">⇅</span>
    return <span className="text-[11px] text-brand-500">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  // ─── Lưu dịch vụ (thêm mới / cập nhật) ──────────────────────────────────────
  async function handleSave(data: ServiceFormData, mo_ta?: string) {
    try {
      if (formTarget === 'new') {
        await serviceService.create(data)
        showToast('Tạo dịch vụ thành công')
      } else if (formTarget) {
        await serviceService.update(formTarget.id, data, mo_ta)
        showToast('Cập nhật dịch vụ thành công')
      }
      setFormTarget(null)
      triggerReload()
      loadStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Có lỗi xảy ra', 'error')
    }
  }

  // ─── Ẩn / Hiện dịch vụ ───────────────────────────────────────────────────────
  async function handleToggleConfirm() {
    if (!toggleTarget) return
    const wasActive = toggleTarget.status === 'active'
    const id        = toggleTarget.id
    setToggleTarget(null)
    try {
      await serviceService.toggle(id)
      showToast(wasActive ? 'Đã ẩn dịch vụ' : 'Đã hiện dịch vụ')
      triggerReload()
      loadStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái', 'error')
    }
  }

  // ─── Xem chi tiết ────────────────────────────────────────────────────────────
  async function handleView(service: ServiceItem) {
    setViewTarget(service)
    setViewLoading(true)
    try {
      const full = await serviceService.getById(service.id)
      setViewTarget(full)
    } catch {
      showToast('Không thể tải lịch sử thao tác', 'error')
    } finally {
      setViewLoading(false)
    }
  }

  function handleEditFromView(service: ServiceItem) {
    setViewTarget(null)
    setFormTarget(service)
  }

  const sortedServices = getSortedServices()

  // ─── Thông báo empty state rõ nguyên nhân ────────────────────────────────────
  function emptyMessage(): string {
    if (search) return `Không tìm thấy dịch vụ khớp với "${search}"`
    if (activeStatus === 'active')   return 'Không có dịch vụ nào đang hoạt động'
    if (activeStatus === 'inactive') return 'Không có dịch vụ nào đang bị ẩn'
    if (activeType) return `Chưa có dịch vụ loại "${TYPE_TABS.find(t => t.value === activeType)?.label ?? activeType}"`
    return 'Chưa có dịch vụ nào'
  }

  function emptyHint(): string {
    if (search || activeStatus || activeType) return 'Thử xóa bộ lọc hoặc tìm kiếm với từ khóa khác'
    return 'Nhấn "+ Thêm dịch vụ" để tạo dịch vụ đầu tiên'
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}

      <div>
        <PageHeader
          title="Quản lý dịch vụ"
          description="Cấu hình dịch vụ khám bệnh và giá trong hệ thống."
        />

        {/* ── Số liệu thống kê ── */}
        <div className="mb-4 grid grid-cols-5 gap-3">
          {[
            { label: 'Tổng dịch vụ', value: stats.total,    color: 'text-slate-700'  },
            { label: 'Hoạt động',    value: stats.active,   color: 'text-green-600'  },
            { label: 'Đã ẩn',        value: stats.inactive, color: 'text-slate-400'  },
            { label: 'Liên quan',    value: stats.related,  color: 'text-blue-600'   },
            { label: 'Tại nhà',      value: stats.home,     color: 'text-yellow-600' },
          ].map((item) => (
            <div key={item.label} className="card p-4 text-center">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="mt-1 text-xs text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filter + Search + Nút thêm ── */}
        <div className="mb-4 flex flex-wrap items-center gap-3">

          {/* Tab lọc loại hình */}
          <div className="card flex gap-1 p-1.5">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveType(tab.value)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeType === tab.value ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab lọc trạng thái */}
          <div className="card flex gap-1 p-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveStatus(tab.value)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeStatus === tab.value
                    ? tab.value === 'inactive' ? 'bg-slate-500 text-white'
                      : tab.value === 'active' ? 'bg-green-500 text-white'
                      : 'bg-brand-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Ô tìm kiếm */}
          <div className="relative min-w-[220px] flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã, mô tả..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input w-full pl-9"
            />
          </div>

          <button
            onClick={() => setFormTarget('new')}
            className="btn-primary flex items-center gap-1.5"
          >
            <Icon name="plus" className="h-4 w-4" />
            Thêm dịch vụ
          </button>
        </div>

        {/* ── Bảng ── */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th onClick={() => handleSort('ma_dich_vu')} className={TH_SORT}>
                    <div className="flex items-center gap-1">Mã DV {sortIcon('ma_dich_vu')}</div>
                  </th>
                  <th onClick={() => handleSort('ten')} className={TH_SORT}>
                    <div className="flex items-center gap-1">Tên dịch vụ {sortIcon('ten')}</div>
                  </th>
                  <th onClick={() => handleSort('loai')} className={TH_SORT}>
                    <div className="flex items-center gap-1">Loại {sortIcon('loai')}</div>
                  </th>
                  <th onClick={() => handleSort('specialty_ten')} className={TH_SORT}>
                    <div className="flex items-center gap-1">Chuyên khoa {sortIcon('specialty_ten')}</div>
                  </th>
                  <th onClick={() => handleSort('gia')} className={TH_SORT}>
                    <div className="flex items-center gap-1">Giá {sortIcon('gia')}</div>
                  </th>
                  <th onClick={() => handleSort('thoi_gian_phut')} className={TH_SORT}>
                    <div className="flex items-center gap-1">Thời lượng {sortIcon('thoi_gian_phut')}</div>
                  </th>
                  <th className={TH_PLAIN}>Lịch áp dụng</th>
                  <th onClick={() => handleSort('so_bac_si')} className={TH_SORT}>
                    <div className="flex items-center gap-1">Bác sĩ {sortIcon('so_bac_si')}</div>
                  </th>
                  <th onClick={() => handleSort('status')} className={TH_SORT}>
                    <div className="flex items-center gap-1">Trạng thái {sortIcon('status')}</div>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">Đang tải...</td>
                  </tr>
                )}

                {!loading && sortedServices.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-5xl">📋</span>
                        <p className="text-base font-medium text-slate-600">{emptyMessage()}</p>
                        <p className="text-sm text-slate-400">{emptyHint()}</p>
                        {(search || activeStatus || activeType) && (
                          <button
                            onClick={() => { setSearchInput(''); setActiveType(''); setActiveStatus('') }}
                            className="mt-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            Xóa tất cả bộ lọc
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && sortedServices.map((s) => {
                  const dim = s.status === 'inactive' ? 'opacity-40' : ''
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className={`px-4 py-3 font-mono text-xs text-slate-500 ${dim}`}>{s.ma_dich_vu}</td>

                      <td className={`px-4 py-3 ${dim}`}>
                        <div className="font-medium text-slate-800">{s.ten}</div>
                        {s.mo_ta_ngan && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{s.mo_ta_ngan}</div>
                        )}
                      </td>

                      <td className={`px-4 py-3 ${dim}`}>
                        <Badge color={TYPE_BADGE_COLOR[s.loai]}>{SERVICE_TYPE_LABEL[s.loai]}</Badge>
                      </td>

                      <td className={`px-4 py-3 text-slate-500 ${dim}`}>{s.specialty_ten ?? '—'}</td>

                      <td className={`px-4 py-3 font-semibold text-slate-800 ${dim}`}>{formatPrice(s.gia)}</td>

                      <td className={`px-4 py-3 text-slate-600 ${dim}`}>
                        {s.thoi_gian_phut != null ? `${s.thoi_gian_phut} ph` : '—'}
                      </td>

                      <td className={`px-4 py-3 text-slate-500 ${dim}`}>
                        {s.ngay_ap_dung ? `${s.ngay_ap_dung}, ${s.gio_bat_dau}–${s.gio_ket_thuc}` : '—'}
                      </td>

                      <td className={`px-4 py-3 text-slate-600 ${dim}`}>
                        {s.loai === 'home' ? `${s.so_bac_si ?? 0} BS` : '—'}
                      </td>

                      <td className={`px-4 py-3 ${dim}`}>
                        <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                          {s.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleView(s)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                          >
                            Xem
                          </button>
                          <button
                            onClick={() => setFormTarget(s)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => setToggleTarget(s)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                              s.status === 'active'
                                ? 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                                : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {s.status === 'active' ? 'Ẩn' : 'Hiện'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs text-slate-500">
                {total} dịch vụ · Trang {page}/{totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="rounded px-2 py-1 text-xs text-slate-500 disabled:opacity-30 hover:bg-slate-100"
                >
                  «
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  ← Trước
                </button>
                <span className="min-w-[32px] px-2 text-center text-sm font-medium text-slate-700">
                  {page}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded border px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Tiếp →
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="rounded px-2 py-1 text-xs text-slate-500 disabled:opacity-30 hover:bg-slate-100"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Modals ── */}
        <ServiceFormModal
          open={formTarget !== null}
          service={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSave={handleSave}
        />

        <ServiceViewModal
          open={viewTarget !== null}
          service={viewTarget}
          loadingLog={viewLoading}
          onClose={() => setViewTarget(null)}
          onEdit={handleEditFromView}
        />

        <ConfirmDialog
          open={toggleTarget !== null}
          title={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ?' : 'Hiện dịch vụ?'}
          message={
            toggleTarget?.status === 'active'
              ? `Dịch vụ "${toggleTarget?.ten}" sẽ bị ẩn. Bệnh nhân không thể đặt thêm lịch. Lịch hẹn hiện có không bị hủy.`
              : `Dịch vụ "${toggleTarget?.ten}" sẽ hiển thị trở lại. Bệnh nhân có thể đặt lịch.`
          }
          confirmText={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ' : 'Hiện dịch vụ'}
          danger={toggleTarget?.status === 'active'}
          onConfirm={handleToggleConfirm}
          onCancel={() => setToggleTarget(null)}
        />
      </div>
    </>
  )
}
