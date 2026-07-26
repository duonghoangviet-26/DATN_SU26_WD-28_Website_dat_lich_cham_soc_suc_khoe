import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import type { ServiceChangeLog, ServiceItem } from '@/types'
import { formatDateTime } from '@/utils/format'

const TEXT = {
  title: 'L\u1ecbch s\u1eed ch\u1ec9nh s\u1eeda',
  closeHistory: '\u0110\u00f3ng l\u1ecbch s\u1eed ch\u1ec9nh s\u1eeda',
  loading: '\u0110ang t\u1ea3i l\u1ecbch s\u1eed ch\u1ec9nh s\u1eeda...',
  empty: 'D\u1ecbch v\u1ee5 n\u00e0y ch\u01b0a c\u00f3 l\u1ecbch s\u1eed ch\u1ec9nh s\u1eeda.',
  editor: 'Ng\u01b0\u1eddi ch\u1ec9nh s\u1eeda:',
  close: '\u0110\u00f3ng',
}

const LOG_CONFIG: Record<
  ServiceChangeLog['hanh_dong'],
  { color: 'green' | 'blue' | 'red'; label: string }
> = {
  tao_moi: { color: 'green', label: 'T\u1ea1o m\u1edbi' },
  cap_nhat: { color: 'blue', label: 'C\u1eadp nh\u1eadt' },
  an: { color: 'red', label: '\u0110\u00e3 \u1ea9n' },
  hien: { color: 'green', label: '\u0110\u00e3 hi\u1ec7n' },
}

interface Props {
  open: boolean
  service: ServiceItem | null
  loading?: boolean
  onClose: () => void
}

export default function ServiceHistoryModal({ open, service, loading, onClose }: Props) {
  if (!open || !service) return null

  const logs = service.lich_su_thay_doi ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">{TEXT.title}</h2>
              <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-slate-500">
                {service.ma_dich_vu}
              </span>
            </div>
            <p className="mt-1 truncate text-sm font-medium text-slate-600">{service.ten}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={TEXT.closeHistory}
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              {TEXT.loading}
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              {TEXT.empty}
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const cfg = LOG_CONFIG[log.hanh_dong] ?? LOG_CONFIG.cap_nhat

                return (
                  <div key={log.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge color={cfg.color}>{cfg.label}</Badge>
                      <span className="text-xs text-slate-400">{formatDateTime(log.thoi_gian)}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                      {TEXT.editor}{' '}
                      <span className="font-semibold text-slate-900">{log.nguoi_thay_doi}</span>
                    </div>
                    {log.mo_ta && <p className="mt-1 text-sm leading-relaxed text-slate-600">{log.mo_ta}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t px-6 py-4">
          <button onClick={onClose} className="btn-secondary">
            {TEXT.close}
          </button>
        </div>
      </div>
    </div>
  )
}
