import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { serviceService } from '@/services/service.service'
import type { ServiceItem } from '@/types'
import PageHeader from '@/components/common/PageHeader'

export default function HomeServiceList() {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    serviceService
      .getAll('home', '', 'active', 1, 50)
      .then((res) => {
        if (!ignore) setServices(res.items)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <div>
      <PageHeader
        title="Xét nghiệm y học tại nhà"
        description="Nhân viên đến tận nhà lấy mẫu — kết quả trả qua ứng dụng."
      />

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-slate-500">Hiện chưa có dịch vụ nào.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Link key={s.id} to={`/dich-vu/xet-nghiem/${s.id}`} className="card-hover p-5">
              <h3 className="font-semibold text-slate-800">{s.ten}</h3>
              <p className="mt-1 text-sm text-slate-500">{s.mo_ta_ngan}</p>
              <p className="mt-3 font-semibold text-brand-600">{s.gia.toLocaleString('vi-VN')}đ</p>
              {s.khu_vuc && s.khu_vuc.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">Khu vực: {s.khu_vuc.join(', ')}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
