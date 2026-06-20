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

  // ── Handlers ──
  async function handleSave(data: ServiceFormData, mo_ta?: string) {
    if (formTarget === 'new') {
      const created = await serviceService.create(data)
      setServices((prev) => [...prev, created])
    } else if (formTarget) {
      const updated = await serviceService.update(formTarget.id, data, mo_ta)
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    }
    setFormTarget(null)
    refreshStats()
  }

  async function handleToggleConfirm() {
    if (!toggleTarget) return
    const id = toggleTarget.id
    setToggleTarget(null)
    const updated = await serviceService.toggle(id)
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    refreshStats()
  }

  // Mở modal Xem — gọi getById để lấy đầy đủ dữ liệu + lịch sử thao tác
  async function handleView(s: ServiceItem) {
    setViewLoading(true)
    setViewTarget(s)           // hiển thị modal ngay với data cơ bản
    try {
      const full = await serviceService.getById(s.id)
      setViewTarget(full)      // cập nhật khi có đầy đủ dữ liệu
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
            placeholder="Tìm theo tên dịch vụ..."
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
                {[
                  'Mã DV', 'Tên dịch vụ', 'Loại', 'Chuyên khoa',
                  'Giá', 'Thời lượng', 'Lịch áp dụng', 'Bác sĩ', 'Trạng thái', '',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500"
                  >
                    {h}
                  </th>
                ))}
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
                services.map((s) => {
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
  )
}
