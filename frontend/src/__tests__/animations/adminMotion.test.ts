import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readProjectFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

describe('admin animation scope', () => {
  it('does not animate admin page and list wrappers', () => {
    const layout = readProjectFile('layouts/AdminLayout.tsx')
    const wrapper = readProjectFile('components/admin/motion/AdminMotion.tsx')
    const css = readProjectFile('index.css')

    expect(layout).not.toContain('framer-motion')
    expect(layout).not.toContain('AnimatePresence')
    expect(layout).not.toContain('admin-route-enter')
    expect(wrapper).not.toContain('framer-motion')
    expect(wrapper).not.toContain('animationDelay')
    expect(wrapper).not.toContain('admin-motion-item-enter')
    expect(css).not.toContain('admin-route-enter')
    expect(css).not.toContain('admin-motion-item-enter')
    expect(css).not.toContain('dashboard-update-pulse')
  })

  it('does not animate dashboard number or card refresh states', () => {
    const dashboard = readProjectFile('pages/admin/Dashboard.tsx')
    const chartCard = readProjectFile('components/admin/dashboard/ChartCard.tsx')
    const topServices = readProjectFile('components/admin/dashboard/TopServicesTable.tsx')

    expect(dashboard).not.toContain('AnimatedNumber')
    expect(dashboard).not.toContain('useUpdatePulse')
    expect(dashboard).not.toContain('dashboard-update-pulse')
    expect(chartCard).not.toContain('useUpdatePulse')
    expect(chartCard).not.toContain('pulseKey')
    expect(topServices).not.toContain('transition-[width]')
  })

  it('keeps dashboard chart animations enabled', () => {
    const chartFiles = [
      'components/admin/dashboard/AppointmentStatusChart.tsx',
      'components/admin/dashboard/DoctorRevenueChart.tsx',
      'components/admin/dashboard/NewPatientsChart.tsx',
      'components/admin/dashboard/RevenueTrendChart.tsx',
    ]

    for (const file of chartFiles) {
      const chart = readProjectFile(file)
      expect(chart).toContain('isAnimationActive')
      expect(chart).toContain('animationDuration={500}')
      expect(chart).toContain('animationEasing="ease-out"')
    }
  })
})
