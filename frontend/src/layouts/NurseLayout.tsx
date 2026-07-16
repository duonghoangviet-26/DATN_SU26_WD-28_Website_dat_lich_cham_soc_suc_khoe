import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import NurseSidebar from '@/components/nurse/NurseSidebar'
import NurseHeader from '@/components/nurse/NurseHeader'

export default function NurseLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-surface">
      <NurseSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <NurseHeader onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
