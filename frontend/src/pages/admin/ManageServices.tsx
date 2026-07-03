import { useEffect, useState } from 'react'
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

// ─── Hằng số dùng trong trang ─────────────────────────────────────────────────

// Các tab lọc theo loại hình dịch vụ
const TYPE_TABS = [
  { value: '' as const,       label: 'Tất cả' },
  { value: 'clinic' as const, label: 'Phòng khám' },
  { value: 'home' as const,   label: 'Tại nhà' },
]

// Màu badge tương ứng với từng loại hình
const TYPE_BADGE_COLOR: Record<ServiceType, 'blue' | 'yellow'> = {
  clinic: 'blue',
  home:   'yellow',
}

// CSS dùng chung cho ô header có thể click sort
const TH_SORT = 'cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-100'

// CSS cho ô header không sort (Lịch áp dụng, cột actions)
const TH_PLAIN = 'whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500'

// Các cột sắp xếp theo số (thay vì so sánh chữ)
const NUMERIC_COLS = ['gia', 'thoi_gian_phut', 'so_bac_si']

// ─── Component chính ──────────────────────────────────────────────────────────
export default function ManageServices() {

  // ── Dữ liệu ─────────────────────────────────────────────────────────────────
  const [services, setServices]       = useState<ServiceItem[]>([]) // danh sách đang hiển thị trong bảng
  const [allServices, setAllServices] = useState<ServiceItem[]>([]) // toàn bộ (dùng để tính stats góc trên)
  const [loading, setLoading]         = useState(true)

  // ── Filter và tìm kiếm ──────────────────────────────────────────────────────
  const [activeType, setActiveType]   = useState<ServiceType | ''>('')
  const [searchInput, setSearchInput] = useState('') // giá trị đang gõ trong ô tìm kiếm
  const [search, setSearch]           = useState('') // giá trị thực sự gửi lên API (cập nhật sau 300ms)

  // ── Trạng thái các Modal ────────────────────────────────────────────────────
  // formTarget = null → modal đóng
  // formTarget = 'new' → mở form thêm mới
  // formTarget = ServiceItem → mở form sửa dịch vụ đó
  const [formTarget, setFormTarget]     = useState<ServiceItem | 'new' | null>(null)
  const [viewTarget, setViewTarget]     = useState<ServiceItem | null>(null) // modal xem chi tiết
  const [viewLoading, setViewLoading]   = useState(false)                    // đang tải lịch sử
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null) // đang chờ xác nhận ẩn/hiện

  // ── Thông báo toast ─────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ── Sắp xếp theo cột ────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState('ma_dich_vu') // tên field đang sort
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc') // chiều sort

  // ─────────────────────────────────────────────────────────────────────────────
  // Hiện thông báo toast rồi tự tắt sau 3 giây
  // ─────────────────────────────────────────────────────────────────────────────
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Debounce tìm kiếm: đợi 300ms sau khi gõ phím cuối mới gửi API
  // Tránh gọi API liên tục khi người dùng đang gõ từng chữ
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer) // hủy timer nếu người dùng tiếp tục gõ
  }, [searchInput])

  // ─────────────────────────────────────────────────────────────────────────────
  // Tải danh sách dịch vụ mỗi khi tab loại hoặc từ khoá tìm kiếm thay đổi
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    serviceService
      .getAll(activeType, search)
      .then((data) => setServices(data))
      .catch(() => showToast('Không thể tải danh sách dịch vụ', 'error'))
      .finally(() => setLoading(false))
  }, [activeType, search])

  // ─────────────────────────────────────────────────────────────────────────────
  // Tải toàn bộ dịch vụ (không lọc) để tính số liệu thống kê góc trên
  // Gọi khi trang mở lần đầu và sau mỗi lần thêm/sửa/ẩn/hiện
  // ─────────────────────────────────────────────────────────────────────────────
  function loadStats() {
    serviceService.getAll().then((data) => setAllServices(data))
  }

  useEffect(() => {
    loadStats()
  }, []) // [] = chỉ chạy 1 lần khi trang được mở

  // Tính các con số thống kê từ toàn bộ danh sách
  const stats = {
    total:    allServices.length,
    active:   allServices.filter((s) => s.status === 'active').length,
    inactive: allServices.filter((s) => s.status === 'inactive').length,
    clinic:   allServices.filter((s) => s.loai === 'clinic').length,
    home:     allServices.filter((s) => s.loai === 'home').length,
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sắp xếp danh sách theo cột đang chọn (client-side, không gọi API thêm)
  // ─────────────────────────────────────────────────────────────────────────────
  function getSortedServices() {
    // Tạo bản sao để không làm thay đổi mảng gốc
    return [...services].sort((a, b) => {
      // Lấy giá trị của 2 dòng tại cột đang sort
      const av = (a as unknown as Record<string, unknown>)[sortKey]
      const bv = (b as unknown as Record<string, unknown>)[sortKey]

      let cmp: number
      if (NUMERIC_COLS.includes(sortKey)) {
        // Cột số: so sánh bằng phép trừ
        cmp = (Number(av) || 0) - (Number(bv) || 0)
      } else {
        // Cột chữ: so sánh có hỗ trợ tiếng Việt
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'vi', { sensitivity: 'base' })
      }

      // Đảo chiều nếu đang sort giảm dần
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  // Click vào tên cột: nếu đang sort cột đó thì đảo chiều, nếu không thì chuyển sang cột mới
  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Trả về icon chỉ hướng sort cho từng cột
  function sortIcon(key: string) {
    if (sortKey !== key) {
      return <span className="text-[11px] text-slate-300">⇅</span> // cột chưa chọn
    }
    return (
      <span className="text-[11px] text-brand-500">
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lưu dịch vụ: xử lý cả trường hợp Thêm mới và Cập nhật
  // ─────────────────────────────────────────────────────────────────────────────
  async function handleSave(data: ServiceFormData, mo_ta?: string) {
    try {
      if (formTarget === 'new') {
        // --- Thêm mới ---
        const created = await serviceService.create(data)

        // Chỉ thêm dịch vụ mới vào bảng nếu khớp với tab đang lọc
        // VD: đang ở tab "Phòng khám" mà tạo dịch vụ "Tại nhà" → không hiện trong tab này
        if (!activeType || created.loai === activeType) {
          setServices((prev) => [...prev, created])
        }
        showToast('Tạo dịch vụ thành công')

      } else if (formTarget) {
        // --- Cập nhật ---
        const updated = await serviceService.update(formTarget.id, data, mo_ta)

        if (activeType && updated.loai !== activeType) {
          // Người dùng đổi loại hình dịch vụ → không còn khớp tab hiện tại → xóa khỏi bảng
          setServices((prev) => prev.filter((s) => s.id !== updated.id))
        } else {
          // Cập nhật thông tin dịch vụ trong bảng
          setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        }
        showToast('Cập nhật dịch vụ thành công')
      }

      setFormTarget(null) // đóng modal
      loadStats()         // cập nhật lại số liệu thống kê
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Có lỗi xảy ra', 'error')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Ẩn / Hiện dịch vụ: chạy sau khi người dùng xác nhận trong dialog
  // ─────────────────────────────────────────────────────────────────────────────
  async function handleToggleConfirm() {
    if (!toggleTarget) return
    const id = toggleTarget.id
    setToggleTarget(null) // đóng dialog xác nhận
    try {
      const updated = await serviceService.toggle(id)
      // Cập nhật trạng thái dòng đó ngay trong bảng
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      loadStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái', 'error')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Xem chi tiết: mở modal ngay với dữ liệu cơ bản, sau đó gọi API để lấy
  // đầy đủ thông tin bao gồm lịch sử thao tác (audit log)
  // ─────────────────────────────────────────────────────────────────────────────
  async function handleView(service: ServiceItem) {
    setViewTarget(service)  // mở modal ngay, tránh người dùng chờ
    setViewLoading(true)
    try {
      const full = await serviceService.getById(service.id)
      setViewTarget(full)   // cập nhật với dữ liệu đầy đủ (kèm lịch sử)
    } catch {
      showToast('Không thể tải lịch sử thao tác', 'error')
    } finally {
      setViewLoading(false)
    }
  }

  // Bấm "Sửa dịch vụ này" trong modal Xem → chuyển sang modal Sửa
  function handleEditFromView(service: ServiceItem) {
    setViewTarget(null)
    setFormTarget(service)
  }

  // Danh sách đã được sắp xếp, dùng để render bảng
  const sortedServices = getSortedServices()

  // ─────────────────────────────────────────────────────────────────────────────
  // GIAO DIỆN
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Thông báo toast — hiện góc trên phải, tự mất sau 3 giây */}
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
            { label: 'Phòng khám',   value: stats.clinic,   color: 'text-blue-600'   },
            { label: 'Tại nhà',      value: stats.home,     color: 'text-yellow-600' },
          ].map((item) => (
            <div key={item.label} className="card p-4 text-center">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="mt-1 text-xs text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>

        {/* ── Tab lọc + Ô tìm kiếm + Nút thêm mới ── */}
        <div className="mb-4 flex flex-wrap items-center gap-3">

          {/* Tab lọc loại hình */}
          <div className="card flex gap-1 p-1.5">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveType(tab.value)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeType === tab.value
                    ? 'bg-brand-500 text-white'
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

          {/* Nút thêm dịch vụ mới */}
          <button
            onClick={() => setFormTarget('new')}
            className="btn-primary flex items-center gap-1.5"
          >
            <Icon name="plus" className="h-4 w-4" />
            Thêm dịch vụ
          </button>
        </div>

        {/* ── Bảng danh sách dịch vụ ── */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">

              {/* Header bảng — click vào tiêu đề cột để sắp xếp */}
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

                {/* Trường hợp 1: Đang tải dữ liệu */}
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                      Đang tải...
                    </td>
                  </tr>
                )}

                {/* Trường hợp 2: Không có dữ liệu */}
                {!loading && sortedServices.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-5xl">📋</span>
                        <p className="text-base font-medium text-slate-600">
                          {search
                            ? `Không tìm thấy dịch vụ khớp với "${search}"`
                            : 'Chưa có dịch vụ nào'}
                        </p>
                        <p className="text-sm text-slate-400">
                          {search
                            ? 'Thử tìm với từ khoá khác hoặc xoá bộ lọc'
                            : 'Nhấn "+ Thêm dịch vụ" để tạo dịch vụ đầu tiên'}
                        </p>
                        {/* Nút xoá tìm kiếm — chỉ hiện khi đang tìm kiếm */}
                        {search && (
                          <button
                            onClick={() => setSearchInput('')}
                            className="mt-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            Xoá tìm kiếm
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {/* Trường hợp 3: Có dữ liệu — render từng dòng */}
                {!loading && sortedServices.map((s) => {
                  // Dịch vụ đang ẩn → làm mờ phần thông tin, cột actions giữ nguyên
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
        </div>

        {/* ── Các Modal ── */}

        {/* Modal thêm mới / sửa dịch vụ */}
        <ServiceFormModal
          open={formTarget !== null}
          service={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSave={handleSave}
        />

        {/* Modal xem chi tiết + lịch sử thao tác */}
        <ServiceViewModal
          open={viewTarget !== null}
          service={viewTarget}
          loadingLog={viewLoading}
          onClose={() => setViewTarget(null)}
          onEdit={handleEditFromView}
        />

        {/* Dialog xác nhận ẩn / hiện dịch vụ */}
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
