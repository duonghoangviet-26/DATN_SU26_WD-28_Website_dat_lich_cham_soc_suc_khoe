import type { HospitalItem } from '@/types'
import Icon from '@/components/admin/icons'

interface Props {
  clinic: HospitalItem
  onEdit: () => void
}

// Hiển thị toàn bộ thông tin chi tiết của phòng khám (singleton).
// Không có nút Thêm / Xóa vì đây là 1 cơ sở duy nhất.
export default function ClinicDetail({ clinic, onEdit }: Props) {
  return (
    <div className="card p-6">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          {clinic.logo_url ? (
            <img
              src={clinic.logo_url}
              alt="Logo phòng khám"
              className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-100">
              <Icon name="hospital" className="h-8 w-8 text-brand-600" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-800">{clinic.ten}</h2>
            <p className="mt-0.5 text-sm text-slate-500">Phòng khám chính</p>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-100"
        >
                    <Icon name="file-text" className="h-4 w-4" />
          Chỉnh sửa
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
              <Field icon="hospital" label="Địa chỉ" value={clinic.dia_chi} />
        <Field icon="bell" label="Số điện thoại" value={clinic.so_dien_thoai} />
        <Field icon="send" label="Email" value={clinic.email} />
        <Field icon="clock" label="Giờ làm việc" value={clinic.gio_lam_viec} />
        <div className="sm:col-span-2">
          <Field icon="file-text" label="Mô tả" value={clinic.mo_ta} />
        </div>
        <div className="sm:col-span-2">
          <Field icon="calendar" label="URL Bản đồ (Google Maps embed)" value={clinic.ban_do_url} truncate />
        </div>
      </div>
    </div>
  )
}

function Field({
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
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <Icon name={icon} className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className={`mt-0.5 text-sm text-slate-700 ${truncate ? 'truncate' : ''}`}>
          {value || <span className="italic text-slate-400">Chưa cập nhật</span>}
        </p>
      </div>
    </div>
  )
}
