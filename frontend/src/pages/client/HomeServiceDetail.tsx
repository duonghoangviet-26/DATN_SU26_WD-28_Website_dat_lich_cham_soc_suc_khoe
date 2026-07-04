import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { serviceService } from '@/services/service.service'
import type { ServiceItem } from '@/types'
import PageHeader from '@/components/common/PageHeader'
import Toast from '@/components/common/Toast'

export default function HomeServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const [service, setService] = useState<ServiceItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let ignore = false
    setLoading(true)
    serviceService
      .getById(id)
      .then((s) => {
        if (ignore) return
        // Chỉ hiển thị dịch vụ home + active — khớp điều kiện lọc của HomeServiceList
        setService(s.loai === 'home' && s.status === 'active' ? s : null)
      })
      .catch(() => {
        if (!ignore) setService(null)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id])

  if (loading) return <p className="text-sm text-slate-500">Đang tải...</p>

  if (!service) {
    return (
      <div className="text-center">
        <p className="text-slate-600">Không tìm thấy dịch vụ.</p>
        <Link to="/dich-vu/xet-nghiem" className="btn-secondary mt-4 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={service.ten} description={service.mo_ta_ngan ?? undefined} />

      <div className="card space-y-4 p-6">
        <p className="text-2xl font-bold text-brand-600">{service.gia.toLocaleString('vi-VN')}đ</p>

        {service.mo_ta && <p className="text-sm text-slate-600">{service.mo_ta}</p>}

        {service.khu_vuc && service.khu_vuc.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-700">Khu vực phục vụ</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {service.khu_vuc.map((kv) => (
                <span key={kv} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                  {kv}
                </span>
              ))}
            </div>
          </div>
        )}

        {service.ngay_ap_dung && (
          <div>
            <p className="text-sm font-medium text-slate-700">Lịch hoạt động</p>
            <p className="mt-1 text-sm text-slate-500">
              {service.ngay_ap_dung}, {service.gio_bat_dau}–{service.gio_ket_thuc}
            </p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-slate-700">Quy trình</p>
          <p className="mt-1 text-sm text-slate-500">
            Nhân viên đến tận nơi → lấy mẫu → mẫu chuyển về lab xử lý → kết quả PDF gửi qua ứng dụng.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setToast('Chức năng đặt lịch đang được hoàn thiện, vui lòng quay lại sau.')}
          className="btn-primary w-full"
        >
          Đặt lịch ngay
        </button>
      </div>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
