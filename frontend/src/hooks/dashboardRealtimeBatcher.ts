import type { DashboardRealtimeSection } from './useDashboardRealtime'

export function createDashboardRefreshBatcher(
  onFlush: (sections: Set<DashboardRealtimeSection>) => void,
  delay = 120,
) {
  const pending = new Set<DashboardRealtimeSection>()
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    timer = null
    if (!pending.size) return
    const changed = new Set(pending)
    pending.clear()
    onFlush(changed)
  }

  return {
    schedule(sections: DashboardRealtimeSection[]) {
      sections.forEach((section) => pending.add(section))
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    dispose() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      pending.clear()
    },
  }
}
