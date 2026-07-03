import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Toast from '@/components/common/Toast'

interface Category {
  key: string
  ten: string
  icon: string
  active: boolean
  path?: string
}

// Chỉ 2 danh mục hoạt động thật (xem docs/superpowers/specs/2026-07-03-service-navigation-flow.md mục 2).
// 8 danh mục còn lại hiển thị cho đủ giao diện nhưng bấm vào chỉ báo "đang phát triển".
const CATEGORIES: Category[] = [
  { key: 'chuyen-khoa', ten: 'Khám Chuyên khoa',    icon: '🩺', active: true,  path: '/dich-vu/chuyen-khoa' },
  { key: 'xet-nghiem',  ten: 'Xét nghiệm y học',     icon: '🧪', active: true,  path: '/dich-vu/xet-nghiem' },
  { key: 'tu-xa',       ten: 'Khám từ xa',           icon: '💻', active: false },
  { key: 'tong-quat',   ten: 'Khám tổng quát',       icon: '📋', active: false },
  { key: 'tinh-than',   ten: 'Sức khỏe tinh thần',   icon: '🧘', active: false },
  { key: 'nha-khoa',    ten: 'Khám nha khoa',        icon: '🦷', active: false },
  { key: 'phau-thuat',  ten: 'Gói Phẫu thuật',       icon: '🏥', active: false },
  { key: 'tieu-duong',  ten: 'Sống khỏe Tiểu đường', icon: '💉', active: false },
  { key: 'test',        ten: 'Bài Test Sức khỏe',    icon: '📝', active: false },
  { key: 'gan-ban',     ten: 'Y tế gần bạn',         icon: '📍', active: false },
]

export default function ServicesHome() {
  const [toast, setToast] = useState<string | null>(null)

  return (
    <div>
      <PageHeader
        title="Dịch vụ toàn diện"
        description="Chọn danh mục dịch vụ bạn cần — khám chuyên khoa hoặc xét nghiệm tại nhà."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CATEGORIES.map((c) =>
          c.active ? (
            <Link
              key={c.key}
              to={c.path!}
              className="card-hover flex flex-col items-center gap-2 p-5 text-center"
            >
              <span className="text-3xl">{c.icon}</span>
              <span className="text-sm font-medium text-slate-800">{c.ten}</span>
            </Link>
          ) : (
            <button
              key={c.key}
              type="button"
              onClick={() => setToast('Tính năng đang được phát triển, vui lòng quay lại sau.')}
              className="card flex flex-col items-center gap-2 p-5 text-center opacity-60"
            >
              <span className="text-3xl">{c.icon}</span>
              <span className="text-sm font-medium text-slate-600">{c.ten}</span>
            </button>
          ),
        )}
      </div>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
