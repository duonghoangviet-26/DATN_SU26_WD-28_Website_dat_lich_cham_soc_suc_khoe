import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { serviceService } from '@/services/service.service'
import type { ServiceItem } from '@/types'
import Breadcrumb from '@/components/common/Breadcrumb'
import Loading from '@/components/common/Loading'

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [service, setService] = useState<ServiceItem | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    serviceService.getById(id)
      .then((res) => {
        setService(res.status === 'active' ? res : null)
      })
      .catch(() => {
        setService(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <Loading message="Đang tải chi tiết dịch vụ..." />
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-xl text-center py-16 px-4">
        <h2 className="text-xl font-bold text-slate-800">Không tìm thấy dịch vụ</h2>
        <p className="text-sm text-slate-400 mt-2">Dịch vụ này có thể đã dừng hoạt động hoặc đường dẫn không đúng.</p>
        <Link to="/dich-vu" className="btn-primary mt-6 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 space-y-6">
      <Breadcrumb items={[{ label: 'Dịch vụ', to: '/dich-vu' }, { label: service.ten }]} />

      <div className="grid gap-6 md:grid-cols-3 items-start">
        {/* LEFT/MAIN COLUMN: SERVICE INFO */}
        <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-left space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">
              Mã dịch vụ: {service.ma_dich_vu}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-800 leading-tight">{service.ten}</h1>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800">Mô tả chi tiết</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{service.mo_ta || service.mo_ta_ngan}</p>
          </div>

          {service.chuan_bi_truoc && (
            <div className="rounded-xl bg-amber-50/50 border border-amber-100/50 p-4 space-y-2">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                ⚠️ Hướng dẫn chuẩn bị trước khi khám
              </h3>
              <p className="text-xs text-amber-700 leading-relaxed">{service.chuan_bi_truoc}</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: BOOKING BOX */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-left space-y-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Phí dịch vụ trọn gói</p>
            <p className="text-2xl font-extrabold text-brand-600">{service.gia.toLocaleString('vi-VN')} đ</p>
            <p className="text-[10px] text-slate-400 leading-normal">
              * Giá đã bao gồm phí thăm khám lâm sàng và các dụng cụ nội soi chuyên sâu dùng một lần.
            </p>
          </div>

          <div className="space-y-3 border-t border-slate-50 pt-4 text-xs text-slate-500">
            <p className="flex items-center justify-between">
              <span className="font-semibold">Nơi thực hiện:</span>
              <span className="text-slate-800">Phòng khám chuyên khoa</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="font-semibold">Hình thức:</span>
              <span className="text-slate-800">Khám lâm sàng / Chỉ định trực tiếp</span>
            </p>
          </div>

          <Link
            to={`/booking?service_id=${service.id}`}
            className="btn-primary w-full text-center block py-3 font-bold shadow-md shadow-brand-100"
          >
            Đặt lịch dịch vụ ngay
          </Link>
        </div>
      </div>
    </div>
  )
}

