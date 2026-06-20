import { useCallback, useEffect, useMemo, useState } from 'react'
import { serviceService } from '@/services/service.service'
import type { ServiceItem, ServiceType, ServiceFormData } from '@/types'
import { SERVICE_TYPE_LABEL } from '@/utils/constants'
import { formatPrice } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import ServiceFormModal from '@/components/admin/services/ServiceFormModal'
import ServiceViewModal from '@/components/admin/services/ServiceViewModal'

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_TABS: { value: ServiceType | ''; label: string }[] = [
  { value: '',       label: 'Tất cả' },
  { value: 'clinic', label: 'Phòng khám' },
  { value: 'home',   label: 'Tại nhà' },
]

const TYPE_BADGE_COLOR: Record<ServiceType, 'blue' | 'yellow'> = {
  clinic: 'blue',
  home:   'yellow',
}

type SortKey = 'ma_dich_vu' | 'ten' | 'loai' | 'specialty_ten' | 'gia' | 'thoi_gian_phut' | 'so_bac_si' | 'status'
type SortDir = 'asc' | 'desc'
const NUMERIC_SORT_KEYS: SortKey[] = ['gia', 'thoi_gian_phut', 'so_bac_si']

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManageServices() {
  // ── Danh sách đã lọc (hiển thị trong bảng) ──
  const [services, setServices]         = useState<ServiceItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeType, setActiveType]     = useState<ServiceType | ''>('')
  const [searchInput, setSearchInput]   = useState('')
  const [search, setSearch]             = useState('')

  // ── Toàn bộ list (không bị ảnh hưởng bởi filter, dùng để tính stats) ──
  const [allServices, setAllServices]   = useState<ServiceItem[]>([])

  // ── Modal state ──
  // formTarget: null=đóng, 'new'=Thêm mới, ServiceItem=Sửa
  const [formTarget, setFormTarget]     = useState<ServiceItem | 'new' | null>(null)
  const [viewTarget, setViewTarget]     = useState<ServiceItem | null>(null)
  const [viewLoading, setViewLoading]   = useState(false)
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null)
  const [toast, setToast]               = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [sortKey, setSortKey]           = useState<SortKey>('ma_dich_vu')
  const [sortDir, setSortDir]           = useState<SortDir>('asc')

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Debounce search 300ms — tránh gọi API liên tục khi gõ ──
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── Load danh sách theo filter + search ──
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    serviceService
      .getAll(activeType, search)
      .then((data) => { if (!cancelled) setServices(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeType, search])

  // ── Load toàn bộ list để tính stats ──
  const refreshStats = useCallback(() => {
    serviceService.getAll().then(setAllServices)
  }, [])

  useEffect(() => { refreshStats() }, [refreshStats])

  // ── Stats tính từ toàn bộ list ──
  const stats = useMemo(() => ({
    total:    allServices.length,
    active:   allServices.filter((s) => s.status === 'active').length,
    inactive: allServices.filter((s) => s.status === 'inactive').length,
    clinic:   allServices.filter((s) => s.loai === 'clinic').length,
    home:     allServices.filter((s) => s.loai === 'home').length,
  }), [allServices])

  // ── Sort ──
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => {
      let cmp: number
      if (NUMERIC_SORT_KEYS.includes(sortKey)) {
        cmp = ((a[sortKey] as number) ?? 0) - ((b[sortKey] as number) ?? 0)
      } else {
        cmp = String(a[sortKey] ?? '').localeCompare(
          String(b[sortKey] ?? ''), 'vi', { sensitivity: 'base' }
        )
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [services, sortKey, sortDir])

  // ── Handlers ──
  async function handleSave(data: ServiceFormData, mo_ta?: string) {
    try {
      if (formTarget === 'new') {
        const created = await serviceService.create(data)
        // Chỉ thêm vào list nếu khớp tab đang lọc (hoặc đang xem tất cả)
        setServices((prev) =>
          activeType && created.loai !== activeType ? prev : [...prev, created]
        )
        showToast('Tạo dịch vụ thành công')
      } else if (formTarget) {
        const updated = await serviceService.update(formTarget.id, data, mo_ta)
        setServices((prev) => {
          // Nếu đổi loại và không khớp tab đang lọc → xóa khỏi list hiện tại
          if (activeType && updated.loai !== activeType) {
            return prev.filter((s) => s.id !== updated.id)
          }
          return prev.map((s) => (s.id === updated.id ? updated : s))
        })
        showToast('Cập nhật dịch vụ thành công')
      }
      setFormTarget(null)
      refreshStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Có lỗi xảy ra', 'error')
    }
  }

  async function handleToggleConfirm() {
    if (!toggleTarget) return
    const id = toggleTarget.id
    setToggleTarget(null)
    try {
      const updated = await serviceService.toggle(id)
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      refreshStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái dịch vụ', 'error')
    }
  }

  // Mở modal Xem — gọi getById để lấy đầy đủ dữ liệu + lịch sử thao tác
  async function handleView(s: ServiceItem) {
    setViewLoading(true)
    setViewTarget(s)           // hiển thị modal ngay với data cơ bản
    try {
      const full = await serviceService.getById(s.id)
      setViewTarget(full)      // cập nhật khi có đầy đủ dữ liệu
    } catch {
      showToast('Không thể tải lịch sử thao tác', 'error')
    } finally {
      setViewLoading(false)
    }
  }

  // Đóng modal Xem → mở modal Sửa
  function handleEditFromView(service: ServiceItem) {
    setViewTarget(null)
    setFormTarget(service)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success'
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}
    <div>
      <PageHeader
        title="Quản lý dịch vụ"
        description="Cấu hình dịch vụ khám bệnh và giá trong hệ thống."
      />

      {/* ── Stats bar ── */}
      <div className="mb-4 grid grid-cols-5 gap-3">
        {[
          { label: 'Tổng dịch vụ', value: stats.total,    color: 'text-slate-700' },
          { label: 'Hoạt động',    value: stats.active,   color: 'text-green-600' },
          { label: 'Đã ẩn',        value: stats.inactive, color: 'text-slate-400' },
          { label: 'Phòng khám',   value: stats.clinic,   color: 'text-blue-600'  },
          { label: 'Tại nhà',      value: stats.home,     color: 'text-yellow-600' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="mt-1 text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter + Search + Thêm mới ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Tabs loại */}
        <div className="card flex gap-1 p-1.5">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveType(t.value)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeType === t.value
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Tìm theo tên, mã, mô tả..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input w-full pl-9"
          />
        </div>

        {/* Thêm mới */}
        <button
          onClick={() => setFormTarget('new')}
          className="btn-primary flex items-center gap-1.5"
        >
          <Icon name="plus" className="h-4 w-4" />
          Thêm dịch vụ
        </button>
      </div>

      {/* ── Bảng dịch vụ ── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <SortTh label="Mã DV"        col="ma_dich_vu"     sk={sortKey} sd={sortDir} onSort={handleSort} />
                <SortTh label="Tên dịch vụ"  col="ten"            sk={sortKey} sd={sortDir} onSort={handleSort} />
                <SortTh label="Loại"         col="loai"           sk={sortKey} sd={sortDir} onSort={handleSort} />
                <SortTh label="Chuyên khoa"  col="specialty_ten"  sk={sortKey} sd={sortDir} onSort={handleSort} />
                <SortTh label="Giá"          col="gia"            sk={sortKey} sd={sortDir} onSort={handleSort} />
                <SortTh label="Thời lượng"   col="thoi_gian_phut" sk={sortKey} sd={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 whitespace-nowrap">
                  Lịch áp dụng
                </th>
                <SortTh label="Bác sĩ"       col="so_bac_si"      sk={sortKey} sd={sortDir} onSort={handleSort} />
                <SortTh label="Trạng thái"   col="status"         sk={sortKey} sd={sortDir} onSort={handleSort} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    Đang tải...
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    Không tìm thấy dịch vụ nào.
                  </td>
                </tr>
              ) : (
                sortedServices.map((s) => {
                  // Chỉ mờ phần data, cột action giữ nguyên
                  const dim = s.status === 'inactive' ? 'opacity-40' : ''
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className={`px-4 py-3 font-mono text-xs text-slate-500 ${dim}`}>
                        {s.ma_dich_vu}
                      </td>
                      <td className={`px-4 py-3 ${dim}`}>
                        <div className="font-medium text-slate-800">{s.ten}</div>
                        {s.mo_ta_ngan && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                            {s.mo_ta_ngan}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-3 ${dim}`}>
                        <Badge color={TYPE_BADGE_COLOR[s.loai]}>
                          {SERVICE_TYPE_LABEL[s.loai]}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-slate-500 ${dim}`}>
                        {s.specialty_ten ?? '—'}
                      </td>
                      <td className={`px-4 py-3 font-semibold text-slate-800 ${dim}`}>
                        {formatPrice(s.gia)}
                      </td>
                      <td className={`px-4 py-3 text-slate-600 ${dim}`}>
                        {s.thoi_gian_phut} ph
                      </td>
                      <td className={`px-4 py-3 text-slate-500 ${dim}`}>
                        {s.ngay_ap_dung
                          ? `${s.ngay_ap_dung}, ${s.gio_bat_dau}–${s.gio_ket_thuc}`
                          : '—'}
                      </td>
                      <td className={`px-4 py-3 text-slate-600 ${dim}`}>
                        {s.so_bac_si ?? 0} BS
                      </td>
                      <td className={`px-4 py-3 ${dim}`}>
                        <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                          {s.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
                        </Badge>
                      </td>
                      {/* Cột action — KHÔNG áp opacity dù service inactive */}
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
                })
              )}
            </tbody>
          </table>
        </div>
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
        open={!!toggleTarget}
        title={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ?' : 'Hiện dịch vụ?'}
        message={
          toggleTarget?.status === 'active'
            ? `Dịch vụ "${toggleTarget?.ten}" sẽ bị ẩn. Bệnh nhân không thể đặt thêm lịch mới. Các lịch hẹn đang chờ không bị hủy.`
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

// ─── SortTh — header cột có thể sort ──────────────────────────────────────────
function SortTh({
  label, col, sk, sd, onSort,
}: {
  label: string
  col: SortKey
  sk: SortKey
  sd: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = sk === col
  return (
    <th
      onClick={() => onSort(col)}
      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-100"
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`text-[11px] leading-none ${active ? 'text-brand-500' : 'text-slate-300'}`}>
          {active ? (sd === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </div>
    </th>
  )
}
