import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTempCode, buildTempCodeDayKey } from '../src/services/tempProfileCode.service.js'

test('D81 buildTempCodeDayKey tra ve YYYY-MM-DD theo UTC', () => {
  const key = buildTempCodeDayKey(new Date('2026-08-14T10:00:00.000Z'))
  assert.equal(key, '2026-08-14')
})

test('D81 buildTempCode dung dinh dang TEMP-YYYYMMDD-xxx, dem 3 chu so co dem 0', () => {
  assert.equal(buildTempCode('2026-08-14', 1), 'TEMP-20260814-001')
  assert.equal(buildTempCode('2026-08-14', 42), 'TEMP-20260814-042')
  assert.equal(buildTempCode('2026-08-14', 999), 'TEMP-20260814-999')
})

test('D81 buildTempCode khong tran dinh dang khi vuot 999', () => {
  assert.equal(buildTempCode('2026-08-14', 1000), 'TEMP-20260814-1000')
})
