import type { ClinicItem } from '@/types'
import Icon from '@/components/admin/icons'

interface Props {
  clinic: ClinicItem
  onEdit: () => void
  onViewLogs: () => void
  onRefresh: () => void
}

export default function ClinicDetail({ clinic, onEdit, onViewLogs, onRefresh }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            {clinic.logo_url ? (
              <img
                src={clinic.logo_url}
                alt="Logo phòng khám"
                className="h-16 w-16 rounded-2xl border border-slate-200 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100">
                <Icon name="hospital" className="h-8 w-8 text-brand-600" />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800">{clinic.ten}</h2>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  Cơ sở chính
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-500">
                {clinic.mo_ta || 'Chưa cập nhật mô tả tổng quan cho phòng khám này.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onViewLogs}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Icon name="clock" className="h-4 w-4" />
              Lịch sử
            </button>
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Icon name="refresh-cw" className="h-4 w-4" />
              Tải lại
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Icon name="file-text" className="h-4 w-4" />
              Chỉnh sửa
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
        <InfoTile icon="hospital" label="Địa chỉ" value={clinic.dia_chi} />
        <InfoTile icon="clock" label="Giờ làm việc" value={clinic.gio_lam_viec} />
        <InfoTile icon="bell" label="Số điện thoại" value={clinic.so_dien_thoai} />
        <InfoTile icon="send" label="Email" value={clinic.email} />
        <div className="sm:col-span-2">
          <InfoTile icon="calendar" label="Liên kết bản đồ" value={clinic.ban_do_url} truncate />
        </div>
      </div>
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
  truncate = false,
}: {
  icon: string
  label: string
  value: string | null | undefined
  truncate?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
          <Icon name={icon} className="h-4 w-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className={`mt-1 text-sm font-medium text-slate-700 ${truncate ? 'truncate' : 'break-words'}`}>
            {value || <span className="italic text-slate-400">Chưa cập nhật</span>}
          </p>
        </div>
      </div>
    </div>
  )
}
