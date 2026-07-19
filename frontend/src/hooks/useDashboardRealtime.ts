import { useEffect, useRef, useState } from 'react'

import {
  isRealtimeConnected,
  subscribeAdminRealtime,
  subscribeRealtimeConnection,
  type DashboardRevenuePayload,
} from '@/services/realtime.service'
import { createDashboardRefreshBatcher } from './dashboardRealtimeBatcher'

export type DashboardRealtimeSection = 'summary' | 'revenue' | 'appointments' | 'doctors' | 'patients' | 'services'

const INITIAL_VERSIONS: Record<DashboardRealtimeSection, number> = {
  summary: 0,
  revenue: 0,
  appointments: 0,
  doctors: 0,
  patients: 0,
  services: 0,
}

export function useDashboardRealtime() {
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>(
    isRealtimeConnected() ? 'connected' : 'connecting',
  )
  const [versions, setVersions] = useState(INITIAL_VERSIONS)
  const connectedOnce = useRef(isRealtimeConnected())

  useEffect(() => {
    const batcher = createDashboardRefreshBatcher((changed) => {
      setVersions((current) => {
        const next = { ...current }
        changed.forEach((section) => { next[section] += 1 })
        return next
      })
    })

    const unsubscribeEvents = subscribeAdminRealtime({
      'admin:appointment_created': () => batcher.schedule(['summary', 'appointments']),
      'admin:appointment_updated': () => batcher.schedule(['summary', 'appointments']),
      'thongke:doanh_thu_thay_doi': (payload: DashboardRevenuePayload) => {
        batcher.schedule(payload.loai === 'hoa_don'
          ? ['summary', 'revenue', 'services']
          : ['summary', 'revenue', 'doctors'])
      },
      'thongke:lich_hen_thay_doi': () => batcher.schedule(['summary', 'appointments']),
      'thongke:benh_nhan_moi': () => batcher.schedule(['patients']),
    })

    const unsubscribeConnection = subscribeRealtimeConnection({
      onConnect: () => {
        setConnection('connected')
        if (connectedOnce.current) {
          batcher.schedule(['summary', 'revenue', 'appointments', 'doctors', 'patients', 'services'])
        }
        connectedOnce.current = true
      },
      onDisconnect: () => setConnection('disconnected'),
    })

    return () => {
      unsubscribeEvents()
      unsubscribeConnection()
      batcher.dispose()
    }
  }, [])

  return { connection, versions }
}
