import { useEffect, useState } from 'react'
import { serviceService } from '@/services/service.service'
import type { ServiceItem, ServiceType } from '@/types'
import { SERVICE_TYPE_LABEL } from '@/utils/constants'
import { formatPrice } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'

const TYPE_TABS: { value: ServiceType | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'clinic', label: 'Phòng khám' },
  { value: 'video', label: 'Video' },
  { value: 'home', label: 'Tại nhà' },
]

const TYPE_COLOR: Record<ServiceType, 'blue' | 'green' | 'yellow'> = {
  clinic: 'blue', video: 'green', home: 'yellow',
}

export default function ManageServices() {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<ServiceType | ''>('')
  const [confirm, setConfirm] = useState<ServiceItem | null>(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    serviceService.getAll(activeType).then((data) => {
      if (!ignore) setServices(data)
    }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [activeType])

  async function handleToggle() {
    if (!confirm) return
    const id = confirm.id
    setConfirm(null)
    const updated = await serviceService.toggle(id)
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  return (
    <div>
      <PageHeader
        title="Quản lý dịch vụ"
        description="Cấu hình các loại dịch vụ khám bệnh và giá cơ bản trong hệ thống."
      />

      {/* Tab lọc theo loại */}
      <div className="card mb-4 flex gap-1 overflow-x-auto p-1.5">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveType(t.value)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeType === t.value ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tên dịch vụ</th>
                <th className="px-4 py-3 font-medium">Loại</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
                <th className="px-4 py-3 font-medium">Giá cơ bản</th>
                <th className="px-4 py-3 font-medium">Mô tả</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
              ) : services.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Không có dịch vụ nào.</td></tr>
              ) : services.map((s) => (
                <tr key={s.id} className={`hover:bg-slate-50 ${s.status === 'hidden' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.ten}</td>
                  <td className="px-4 py-3">
                    <Badge color={TYPE_COLOR[s.loai]}>{SERVICE_TYPE_LABEL[s.loai]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.thoi_gian_phut} phút</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{formatPrice(s.gia_co_ban)}</td>
                  <td className="px-4 py-3 max-w-[240px] truncate text-slate-500">{s.mo_ta}</td>
                  <td className="px-4 py-3">
                    <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                      {s.status === 'active' ? 'Đang hoạt động' : 'Đã ẩn'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirm(s)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        s.status === 'active'
                          ? 'border-slate-200 bg-slate-50 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                          : 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
                      }`}
                    >
                      {s.status === 'active'
                        ? <><Icon name="eye-off" className="h-3 w-3" /> Ẩn</>
                        : <><Icon name="eye" className="h-3 w-3" /> Hiện</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && (
        <p className="mt-3 text-sm text-slate-500">Tổng cộng {services.length} dịch vụ</p>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.status === 'active' ? 'Ẩn dịch vụ' : 'Hiện dịch vụ'}
        message={`Bạn có chắc muốn ${confirm?.status === 'active' ? 'ẩn' : 'hiện'} dịch vụ "${confirm?.ten}"?`}
        confirmText={confirm?.status === 'active' ? 'Ẩn' : 'Hiện'}
        danger={confirm?.status === 'active'}
        onConfirm={handleToggle}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
