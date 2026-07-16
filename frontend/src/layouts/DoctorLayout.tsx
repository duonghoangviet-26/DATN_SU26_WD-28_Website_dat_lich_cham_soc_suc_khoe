import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import DoctorSidebar from '@/components/doctor/DoctorSidebar'
import DoctorHeader from '@/components/doctor/DoctorHeader'

// Trang có bảng lớn (nhiều cột) cần container rộng hơn trang dạng form/thống kê —
// tránh nhét bảng 6+ cột vào cùng 1 max-width hẹp dùng cho Dashboard/Profile.
const WIDE_ROUTES = ['/doctor/appointments', '/doctor/pending-records']

export default function DoctorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const isWide = WIDE_ROUTES.some((path) => location.pathname.startsWith(path))

  return (
    <div className="flex h-screen bg-surface">
      <DoctorSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DoctorHeader onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className={`mx-auto w-full ${isWide ? 'max-w-[1400px]' : 'max-w-[1100px]'}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
