import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/admin/Sidebar'
import AdminHeader from '@/components/admin/AdminHeader'

// Bố cục khung cho toàn bộ trang Admin: Sidebar trái + Header trên + nội dung (Outlet).
export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-surface">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6">
          {/* Mỗi trang admin con sẽ hiển thị ở đây */}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
