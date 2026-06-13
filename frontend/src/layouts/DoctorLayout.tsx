import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import DoctorSidebar from '@/components/doctor/DoctorSidebar'
import DoctorHeader from '@/components/doctor/DoctorHeader'

export default function DoctorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-surface">
      <DoctorSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DoctorHeader onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
