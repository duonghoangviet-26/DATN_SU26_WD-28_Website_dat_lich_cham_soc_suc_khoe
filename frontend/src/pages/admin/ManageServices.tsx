import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageHeader from '@/components/common/PageHeader'
import { AdminAutoStagger } from '@/components/admin/motion/AdminMotion'
import { serviceService } from '@/services/service.service'
import { specialtyService } from '@/services/specialty.service'
import type { SpecialtyBrowseItem } from '@/services/specialty.service'
import type { ServiceItem, ServicePackageType } from '@/types'

type ServiceTab = 'all' | 'packages' | 'regular'

const PACKAGE_TYPE_LABEL: Record<ServicePackageType, string> = {
  goi_don: 'Gói đơn',
  goi_gia_dinh: 'Gói gia đình',
}

function getSpecialtyFallbackLabel(name: string) {
  const label = name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return label || 'CK'
}

export default function ManageServices() {
  const navigate = useNavigate()

  const [specialties, setSpecialties] = useState<SpecialtyBrowseItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ServiceTab>('all')
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let ignore = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const [specialtyItems, serviceResult] = await Promise.all([
          specialtyService.getAdminBrowse('active'),
          serviceService.getAll('related', '', '', 1, 9999),
        ])

        if (ignore) return

        setSpecialties(specialtyItems)
        setServices(serviceResult.items.filter((item) => item.loai === 'related'))
        setBrokenIcons({})
      } catch {
        if (!ignore) {
          setError('Không thể tải dữ liệu dịch vụ và chuyên khoa.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      ignore = true
    }
  }, [])

  function getServicesBySpecialty(specialtyId: string) {
    return services.filter((service) => {
      if (service.specialty_id !== specialtyId) return false
      if (activeTab === 'packages') return service.la_goi === true
      if (activeTab === 'regular') return service.la_goi !== true
      return true
    })
  }

  function getPackageStatsBySpecialty(specialtyId: string) {
    const specialtyServices = services.filter((service) => service.specialty_id === specialtyId)
    return {
      total: specialtyServices.length,
      packages: specialtyServices.filter((service) => service.la_goi === true).length,
      single: specialtyServices.filter((service) => service.la_goi === true && service.loai_goi === 'goi_don').length,
      family: specialtyServices.filter((service) => service.la_goi === true && service.loai_goi === 'goi_gia_dinh').length,
      regular: specialtyServices.filter((service) => service.la_goi !== true).length,
    }
  }

  const stats = {
    specialties: specialties.length,
    services: services.length,
    packageServices: services.filter((item) => item.la_goi === true).length,
    singlePackages: services.filter((item) => item.la_goi === true && item.loai_goi === 'goi_don').length,
    familyPackages: services.filter((item) => item.la_goi === true && item.loai_goi === 'goi_gia_dinh').length,
    regularServices: services.filter((item) => item.la_goi !== true).length,
    activeServices: services.filter((item) => item.status === 'active').length,
    inactiveServices: services.filter((item) => item.status === 'inactive').length,
  }

  const tabDescription =
    activeTab === 'packages'
      ? 'Đang lọc riêng các gói dịch vụ theo từng chuyên khoa.'
      : activeTab === 'regular'
        ? 'Đang lọc riêng các dịch vụ lẻ, không phải gói.'
        : 'Đang hiển thị toàn bộ dịch vụ liên quan và gói dịch vụ theo từng chuyên khoa.'

  return (
    <AdminAutoStagger className="space-y-6">
      <PageHeader
        title="Quản lý dịch vụ"
        description="Quản trị viên quản lý dịch vụ liên quan theo từng chuyên khoa, đồng thời có tab riêng để rà soát gói dịch vụ."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: 'Chuyên khoa đang hiển thị', value: stats.specialties, color: 'text-slate-700' },
          { label: 'Tổng dịch vụ', value: stats.services, color: 'text-blue-600' },
          { label: 'Gói dịch vụ', value: stats.packageServices, color: 'text-cyan-600' },
          { label: PACKAGE_TYPE_LABEL.goi_don, value: stats.singlePackages, color: 'text-emerald-600' },
          { label: PACKAGE_TYPE_LABEL.goi_gia_dinh, value: stats.familyPackages, color: 'text-rose-600' },
          { label: 'Dịch vụ lẻ', value: stats.regularServices, color: 'text-amber-600' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-white p-4 text-center shadow-sm ring-1 ring-slate-200">
            <div className={`font-mono text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Lưu ý: admin hiện chỉ quản lý dịch vụ liên quan theo chuyên khoa. Dịch vụ đặt lịch tại nhà đã ngừng hỗ trợ tạo mới;
        dữ liệu lịch sử nếu có chỉ dùng để đối soát lịch hẹn cũ.
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['all', `Tất cả (${stats.services})`],
          ['packages', `Gói (${stats.packageServices})`],
          ['regular', `Dịch vụ lẻ (${stats.regularServices})`],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value as ServiceTab)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === value
                ? 'bg-brand-500 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-800">Dịch vụ theo chuyên khoa</h3>
          <p className="mt-0.5 text-xs text-slate-400">{tabDescription}</p>
          <p className="mt-1 text-xs text-slate-400">
            Đang hoạt động: {stats.activeServices} | Đã ẩn: {stats.inactiveServices}
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">Đang tải dữ liệu...</div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-sm text-red-500">{error}</div>
        ) : specialties.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">
            Chưa có chuyên khoa hoạt động để quản lý dịch vụ.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {specialties.map((specialty) => {
              const specialtyStats = getPackageStatsBySpecialty(specialty.id)
              const visibleCount = getServicesBySpecialty(specialty.id).length

              return (
                <button
                  key={specialty.id}
                  onClick={() => navigate(`/admin/services/chuyen-khoa/${specialty.slug}?tab=${activeTab}`)}
                  className="grid w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
                    {specialty.icon_url && !brokenIcons[specialty.id] ? (
                      <img
                        src={specialty.icon_url}
                        alt={specialty.ten}
                        className="h-full w-full object-cover"
                        onError={() =>
                          setBrokenIcons((prev) => ({
                            ...prev,
                            [specialty.id]: true,
                          }))
                        }
                      />
                    ) : (
                      getSpecialtyFallbackLabel(specialty.ten)
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{specialty.ten}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {specialty.mo_ta || 'Chưa có mô tả chuyên khoa'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                        Gói đơn: {specialtyStats.single}
                      </span>
                      <span className="rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700">
                        Gói gia đình: {specialtyStats.family}
                      </span>
                      <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700">
                        Dịch vụ lẻ: {specialtyStats.regular}
                      </span>
                    </div>
                  </div>
                </div>

                  <div className="text-left md:text-right">
                    <div className="font-mono text-lg font-semibold text-slate-800 tabular-nums">
                      {visibleCount}
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                    {activeTab === 'packages'
                      ? 'gói dịch vụ'
                      : activeTab === 'regular'
                        ? 'dịch vụ lẻ'
                        : 'dịch vụ'}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {specialtyStats.total} tổng | {specialty.so_bac_si} bác sĩ
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </AdminAutoStagger>
  )
}
