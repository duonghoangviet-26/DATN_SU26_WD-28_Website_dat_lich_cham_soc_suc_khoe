import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { pageVariants, reducedPageVariants } from '@/animations/adminMotion'
import Sidebar from '@/components/admin/Sidebar'
import AdminHeader from '@/components/admin/AdminHeader'

// Bố cục khung cho toàn bộ trang Admin: Sidebar trái + Header trên + nội dung (Outlet).
export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-surface">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6">
          {/* Mỗi trang admin con sẽ hiển thị ở đây */}
          <motion.div
            key={location.pathname}
            data-testid="admin-route-motion"
            data-motion-mode={shouldReduceMotion ? 'reduced' : 'full'}
            className="min-h-full"
            variants={shouldReduceMotion ? reducedPageVariants : pageVariants}
            initial="hidden"
            animate="visible"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
