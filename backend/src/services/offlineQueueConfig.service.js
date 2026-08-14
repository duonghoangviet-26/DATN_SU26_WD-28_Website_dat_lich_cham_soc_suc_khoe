function readNumber(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function readBoolean(name, fallback) {
  const value = String(process.env[name] ?? '').trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(value)) return true
  if (['0', 'false', 'no', 'off'].includes(value)) return false
  return fallback
}

export function layCauHinhHangDoiOffline() {
  return {
    maxOfflineWaitMinutes: readNumber('MAX_OFFLINE_WAIT_MINUTES', 90),
    offlineWarningWaitMinutes: readNumber('OFFLINE_WARNING_WAIT_MINUTES', 60),
    maxCentralOfflineQueueSize: readNumber('MAX_CENTRAL_OFFLINE_QUEUE_SIZE', 10),
    maxOfflinePerShiftPerSpecialty: readNumber('MAX_OFFLINE_PER_SHIFT_PER_SPECIALTY', 20),
    minOnlineProtectionMinutes: readNumber('MIN_ONLINE_PROTECTION_MINUTES', 15),
    dispatchBufferMinutes: readNumber('DISPATCH_BUFFER_MINUTES', 5),
    shiftClosingBufferMinutes: readNumber('SHIFT_CLOSING_BUFFER_MINUTES', 30),
    offlineAgingMinutes: readNumber('OFFLINE_AGING_MINUTES', 60),
    autoDispatchEnabled: readBoolean('AUTO_DISPATCH_ENABLED', false),
  }
}

export default { layCauHinhHangDoiOffline }
