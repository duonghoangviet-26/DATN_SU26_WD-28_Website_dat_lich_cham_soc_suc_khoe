import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { serviceService } from '@/services/service.service'
import { specialtyService } from '@/services/specialty.service'
import type { SpecialtyBrowseItem } from '@/services/specialty.service'
import type { ServiceItem, ServiceStatus, ServiceFormData } from '@/types'
import { formatPrice } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import ServiceFormModal from '@/components/admin/services/ServiceFormModal'
import ServiceViewModal from '@/components/admin/services/ServiceViewModal'

// ─── Hằng số ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const STATUS_TABS: { value: ServiceStatus | ''; label: string }[] = [
  { value: '',         label: 'Tất cả' },
  { value: 'active',   label: 'Hoạt động' },
  { value: 'inactive', label: 'Đã ẩn' },
]

// Tầng 1 — "dịch vụ lớn": cố định trong code (xem 2026-07-03-admin-service-hierarchy-design.md §2).
// Thêm dịch vụ lớn mới sau này (VD: "Khám tổng quát") chỉ cần thêm 1 GroupKey + nhánh UI tương ứng.
type GroupKey = 'clinic' | 'home'

// ─── Component chính ──────────────────────────────────────────────────────────
export default function ManageServices() {
  const navigate = useNavigate()

  // ── Stats — toàn bộ dịch vụ, không lọc (dùng cho số liệu tổng quan + đếm dịch vụ liên quan/khoa) ──
  const [allServices, setAllServices] = useState<ServiceItem[]>([])
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

  function countRelated(specialtyId: string) {
    return allServices.filter(s => s.loai === 'related' && s.specialty_id === specialtyId).length
  }

  // ── Tầng 1 — nhóm dịch vụ lớn đang mở ──
  const [expandedGroup, setExpandedGroup] = useState<GroupKey | null>(null)

  // ── Tầng 2 (nhánh Khám chuyên khoa) — danh sách chuyên khoa active ──
  const [specialties, setSpecialties] = useState<SpecialtyBrowseItem[]>([])
  useEffect(() => {
    specialtyService.getAllActive().then(setSpecialties).catch(() => {})
  }, [])

  // ── Tầng 2 (nhánh Khám tại nhà) — "Xét nghiệm" mở rộng thêm bảng DichVu loai='home' ──
  const [homeExpanded, setHomeExpanded] = useState(false)

  const [homeServices, setHomeServices]       = useState<ServiceItem[]>([])
  const [homeLoading, setHomeLoading]         = useState(false)
  const [homeStatus, setHomeStatus]           = useState<ServiceStatus | ''>('')
  const [homeSearchInput, setHomeSearchInput] = useState('')
  const [homeSearch, setHomeSearch]           = useState('')
  const [homePage, setHomePage]               = useState(1)
  const [homeTotal, setHomeTotal]             = useState(0)
  const [homeTotalPages, setHomeTotalPages]   = useState(1)
  const [homeReloadKey, setHomeReloadKey]     = useState(0)
  function triggerHomeReload() { setHomeReloadKey(k => k + 1) }

  useEffect(() => {
    const timer = setTimeout(() => setHomeSearch(homeSearchInput), 300)
    return () => clearTimeout(timer)
  }, [homeSearchInput])

  useEffect(() => { setHomePage(1) }, [homeStatus, homeSearch])

  useEffect(() => {
    if (!homeExpanded) return
    setHomeLoading(true)
    serviceService
      .getAll('home', homeSearch, homeStatus, homePage, PAGE_SIZE)
      .then(({ items, total, totalPages }) => {
        setHomeServices(items)
        setHomeTotal(total)
        setHomeTotalPages(totalPages)
      })
      .catch(() => showToast('Không thể tải danh sách dịch vụ tại nhà', 'error'))
      .finally(() => setHomeLoading(false))
  }, [homeExpanded, homeStatus, homeSearch, homePage, homeReloadKey])

  // ── Modal state — dùng chung cho tạo/sửa dịch vụ "Xét nghiệm" tại nhà ──
  const [formTarget, setFormTarget]     = useState<ServiceItem | 'new' | null>(null)
  const [viewTarget, setViewTarget]     = useState<ServiceItem | null>(null)
  const [viewLoading, setViewLoading]   = useState(false)
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null)

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

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
      triggerHomeReload()
      loadStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Có lỗi xảy ra', 'error')
    }
  }

  async function handleToggleConfirm() {
    if (!toggleTarget) return
    const wasActive = toggleTarget.status === 'active'
    const id = toggleTarget.id
    setToggleTarget(null)
    try {
      await serviceService.toggle(id)
      showToast(wasActive ? 'Đã ẩn dịch vụ' : 'Đã hiện dịch vụ')
      triggerHomeReload()
      loadStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái', 'error')
    }
  }

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

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
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
          description="Cấu hình dịch vụ khám bệnh và giá trong hệ thống — tổ chức theo dịch vụ lớn → dịch vụ con."
        />

        {/* ── Số liệu thống kê ── */}
        <div className="mb-6 grid grid-cols-5 gap-3">
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

        {/* ── TẦNG 1 — Dịch vụ lớn ── */}
        <div className="space-y-4">

          {/* --- Khám chuyên khoa --- */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setExpandedGroup(g => g === 'clinic' ? null : 'clinic')}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏥</span>
                <div>
                  <div className="font-semibold text-slate-800">Khám chuyên khoa</div>
                  <div className="text-xs text-slate-400">{specialties.length} chuyên khoa · {stats.related} dịch vụ liên quan</div>
                </div>
              </div>
              <span className="text-slate-400">{expandedGroup === 'clinic' ? '▾' : '▸'}</span>
            </button>

            {expandedGroup === 'clinic' && (
              <div className="divide-y divide-slate-100 border-t">
                {specialties.length === 0 && (
                  <div className="px-5 py-6 text-center text-sm text-slate-400">Chưa có chuyên khoa nào đang hoạt động</div>
                )}
                {specialties.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => navigate(`/admin/services/chuyen-khoa/${sp.slug}`)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{sp.icon_url}</span>
                      <span className="font-medium text-slate-700">{sp.ten}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{countRelated(String(sp.id))} dịch vụ liên quan</span>
                      <span>{sp.so_bac_si} bác sĩ</span>
                      <span className="text-slate-300">›</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* --- Khám tại nhà --- */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setExpandedGroup(g => g === 'home' ? null : 'home')}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏠</span>
                <div>
                  <div className="font-semibold text-slate-800">Khám tại nhà</div>
                  <div className="text-xs text-slate-400">{stats.home} dịch vụ xét nghiệm</div>
                </div>
              </div>
              <span className="text-slate-400">{expandedGroup === 'home' ? '▾' : '▸'}</span>
            </button>

            {expandedGroup === 'home' && (
              <div className="border-t">
                {/* Xét nghiệm — hoạt động đầy đủ */}
                <div>
                  <button
                    onClick={() => setHomeExpanded(v => !v)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🧪</span>
                      <span className="font-medium text-slate-700">Xét nghiệm</span>
                      <Badge color="green">{stats.home} dịch vụ</Badge>
                    </div>
                    <span className="text-slate-400">{homeExpanded ? '▾' : '▸'}</span>
                  </button>

                  {homeExpanded && (
                    <div className="border-t bg-slate-50/50 px-5 py-4">
                      {/* Filter + search + thêm */}
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <div className="card flex gap-1 p-1.5">
                          {STATUS_TABS.map((tab) => (
                            <button
                              key={tab.value}
                              onClick={() => setHomeStatus(tab.value)}
                              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                homeStatus === tab.value
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
                        <div className="relative min-w-[220px] flex-1">
                          <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Tìm theo tên, mã, mô tả..."
                            value={homeSearchInput}
                            onChange={(e) => setHomeSearchInput(e.target.value)}
                            className="input w-full bg-white pl-9"
                          />
                        </div>
                        <button onClick={() => setFormTarget('new')} className="btn-primary flex items-center gap-1.5">
                          <Icon name="plus" className="h-4 w-4" />
                          Thêm dịch vụ
                        </button>
                      </div>

                      {/* Bảng */}
                      <div className="card overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left">
                              <tr>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Mã DV</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Tên dịch vụ</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Giá</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Khu vực phục vụ</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Nhân sự</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Trạng thái</th>
                                <th className="px-4 py-3" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {homeLoading && (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
                              )}
                              {!homeLoading && homeServices.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Chưa có dịch vụ xét nghiệm tại nhà nào</td></tr>
                              )}
                              {!homeLoading && homeServices.map((s) => {
                                const dim = s.status === 'inactive' ? 'opacity-40' : ''
                                return (
                                  <tr key={s.id} className="hover:bg-slate-50">
                                    <td className={`px-4 py-3 font-mono text-xs text-slate-500 ${dim}`}>{s.ma_dich_vu}</td>
                                    <td className={`px-4 py-3 ${dim}`}>
                                      <div className="font-medium text-slate-800">{s.ten}</div>
                                      {s.mo_ta_ngan && <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{s.mo_ta_ngan}</div>}
                                    </td>
                                    <td className={`px-4 py-3 font-semibold text-slate-800 ${dim}`}>{formatPrice(s.gia)}</td>
                                    <td className={`px-4 py-3 text-slate-500 ${dim}`}>
                                      {s.khu_vuc && s.khu_vuc.length > 0 ? s.khu_vuc.join(', ') : '—'}
                                    </td>
                                    <td className={`px-4 py-3 text-slate-600 ${dim}`}>{s.so_bac_si ?? 0} nhân viên</td>
                                    <td className={`px-4 py-3 ${dim}`}>
                                      <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                                        {s.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-end gap-1">
                                        <button onClick={() => handleView(s)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600">Xem</button>
                                        <button onClick={() => setFormTarget(s)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">Sửa</button>
                                        <button
                                          onClick={() => setToggleTarget(s)}
                                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
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

                        {!homeLoading && homeTotal > 0 && (
                          <div className="flex items-center justify-between border-t px-4 py-3">
                            <span className="text-xs text-slate-500">{homeTotal} dịch vụ · Trang {homePage}/{homeTotalPages}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setHomePage(p => Math.max(1, p - 1))} disabled={homePage === 1} className="rounded border px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50">← Trước</button>
                              <span className="min-w-[32px] px-2 text-center text-sm font-medium text-slate-700">{homePage}</span>
                              <button onClick={() => setHomePage(p => Math.min(homeTotalPages, p + 1))} disabled={homePage === homeTotalPages} className="rounded border px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50">Tiếp →</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Khám trực tiếp — placeholder, chưa hoạt động trong phạm vi DATN */}
                <div className="flex items-center justify-between border-t px-5 py-3.5 opacity-60">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🩺</span>
                    <span className="font-medium text-slate-500">Khám trực tiếp</span>
                    <Badge color="gray">0 dịch vụ</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Icon name="lock" className="h-3.5 w-3.5" />
                    Sắp ra mắt
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Modals — dùng chung cho dịch vụ "Xét nghiệm" tại nhà ── */}
        <ServiceFormModal
          open={formTarget !== null}
          service={formTarget === 'new' ? null : formTarget}
          initialLoai="home"
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
              ? `Dịch vụ "${toggleTarget?.ten}" sẽ bị ẩn. Bệnh nhân không thể đặt thêm lịch.` +
                (toggleTarget?.active_appointments
                  ? ` Có ${toggleTarget.active_appointments} lịch hẹn đang chờ — các lịch đó không bị hủy.`
                  : ' Lịch hẹn hiện có không bị hủy.')
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
