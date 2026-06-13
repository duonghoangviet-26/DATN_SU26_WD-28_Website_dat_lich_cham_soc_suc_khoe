import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/admin/Sidebar'
import AdminHeader from '@/components/admin/AdminHeader'

// Bố cục khung cho toàn bộ trang Admin: Sidebar trái + Header trên + nội dung (Outlet).
export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {/* Mỗi trang admin con sẽ hiển thị ở đây */}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
