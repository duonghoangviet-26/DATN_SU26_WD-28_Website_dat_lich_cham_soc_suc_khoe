import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDashboardRefreshBatcher } from '@/hooks/dashboardRealtimeBatcher'

describe('dashboard realtime burst batching', () => {
  afterEach(() => vi.useRealTimers())

  it('coalesces five rapid payment events into one relevant refresh batch', () => {
    vi.useFakeTimers()
    const onFlush = vi.fn()
    const batcher = createDashboardRefreshBatcher(onFlush)

    for (let index = 0; index < 5; index += 1) {
      batcher.schedule(['summary', 'revenue', 'doctors'])
    }

    vi.advanceTimersByTime(119)
    expect(onFlush).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onFlush).toHaveBeenCalledTimes(1)
    expect([...onFlush.mock.calls[0][0]].sort()).toEqual(['doctors', 'revenue', 'summary'])

    batcher.dispose()
  })
})
