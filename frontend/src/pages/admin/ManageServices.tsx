import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageHeader from '@/components/common/PageHeader'
import { serviceService } from '@/services/service.service'
import { specialtyService } from '@/services/specialty.service'
import type { SpecialtyBrowseItem } from '@/services/specialty.service'
import type { ServiceItem } from '@/types'

export default function ManageServices() {
  const navigate = useNavigate()

  const [specialties, setSpecialties] = useState<SpecialtyBrowseItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  function countRelatedServices(specialtyId: string) {
    return services.filter((service) => service.specialty_id === specialtyId).length
  }

  const stats = {
    specialties: specialties.length,
    services: services.length,
    activeServices: services.filter((item) => item.status === 'active').length,
    inactiveServices: services.filter((item) => item.status === 'inactive').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý dịch vụ"
        description="Admin hiện quản lý dịch vụ liên quan theo từng chuyên khoa. Luồng khám tại nhà đã được tạm ẩn khỏi giao diện quản trị."
      />

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Chuyên khoa đang hiển thị', value: stats.specialties, color: 'text-slate-700' },
          { label: 'Dịch vụ liên quan', value: stats.services, color: 'text-blue-600' },
          { label: 'Đang hoạt động', value: stats.activeServices, color: 'text-green-600' },
          { label: 'Đã ẩn', value: stats.inactiveServices, color: 'text-slate-400' },
        ].map((item) => (
          <div key={item.label} className="card p-4 text-center">
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Lưu ý: giao diện admin hiện chỉ cho phép xem và quản lý dịch vụ liên quan theo chuyên khoa.
        Tùy chọn tạo và hiển thị dịch vụ khám tại nhà đã được tạm ẩn để tránh làm lệch luồng đặt lịch hiện tại.
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-800">Dịch vụ theo chuyên khoa</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Dữ liệu được lấy từ admin API thật của chuyên khoa và dịch vụ liên quan.
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
            {specialties.map((specialty) => (
              <button
                key={specialty.id}
                onClick={() => navigate(`/admin/services/chuyen-khoa/${specialty.slug}`)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-lg text-brand-600">
                    {specialty.icon_url || 'CK'}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{specialty.ten}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {specialty.mo_ta || 'Chưa có mô tả chuyên khoa'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-700">
                    {countRelatedServices(specialty.id)} dịch vụ liên quan
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {specialty.so_bac_si} bác sĩ
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
