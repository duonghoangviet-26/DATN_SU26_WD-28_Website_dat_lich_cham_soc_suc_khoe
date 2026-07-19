import { beforeAll, describe, expect, it, vi } from 'vitest'

const socketMocks = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload?: unknown) => void>>()
  const socket = {
    connected: true,
    auth: {},
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      const listeners = handlers.get(event) ?? new Set()
      listeners.add(handler)
      handlers.set(event, listeners)
    }),
    off: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      handlers.get(event)?.delete(handler)
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  return { handlers, socket, io: vi.fn(() => socket) }
})

vi.mock('socket.io-client', () => ({ io: socketMocks.io }))

import { subscribeAdminRealtime, subscribeRealtimeConnection } from '@/services/realtime.service'

describe('realtime singleton subscriptions', () => {
  beforeAll(() => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'admin-token') })
  })

  it('reuses one socket and removes dashboard plus connection listeners during cleanup', () => {
    const onRevenue = vi.fn()
    const onDisconnect = vi.fn()
    const unsubscribeEvents = subscribeAdminRealtime({
      'thongke:doanh_thu_thay_doi': onRevenue,
    })
    const unsubscribeConnection = subscribeRealtimeConnection({ onDisconnect })

    expect(socketMocks.io).toHaveBeenCalledTimes(1)
    expect(socketMocks.handlers.get('thongke:doanh_thu_thay_doi')?.has(onRevenue)).toBe(true)
    expect(socketMocks.handlers.get('disconnect')?.has(onDisconnect)).toBe(true)

    unsubscribeEvents()
    unsubscribeConnection()

    expect(socketMocks.handlers.get('thongke:doanh_thu_thay_doi')?.size).toBe(0)
    expect(socketMocks.handlers.get('disconnect')?.size).toBe(0)
    expect(socketMocks.socket.off).toHaveBeenCalledWith('thongke:doanh_thu_thay_doi', onRevenue)
    expect(socketMocks.socket.off).toHaveBeenCalledWith('disconnect', onDisconnect)
  })
})
