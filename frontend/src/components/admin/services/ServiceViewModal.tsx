import type { ServiceItem, ServiceChangeLog } from '@/types'
import { SERVICE_TYPE_LABEL } from '@/utils/constants'
import { formatPrice, formatDateTime } from '@/utils/format'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'

// Badge config theo loại hành động audit log
const LOG_CONFIG: Record<
  ServiceChangeLog['hanh_dong'],
  { color: 'green' | 'blue' | 'red'; label: string }
> = {
  tao_moi:  { color: 'green', label: 'Tạo mới' },
  cap_nhat: { color: 'blue',  label: 'Cập nhật' },
  an:       { color: 'red',   label: 'Đã ẩn' },
  hien:     { color: 'green', label: 'Đã hiện' },
}

interface Props {
  open: boolean
  service: ServiceItem | null
  loadingLog?: boolean
  onClose: () => void
  onEdit: (service: ServiceItem) => void
}

export default function ServiceViewModal({ open, service, loadingLog, onClose, onEdit }: Props) {
  if (!open || !service) return null

  // Đã sort desc từ BE, giữ nguyên thứ tự
  const logs = service.lich_su_thay_doi ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">Chi tiết dịch vụ</h2>
            <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-slate-500">
              {service.ma_dich_vu}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">

          {/* ── Thông tin dịch vụ ── */}
          <section>
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <h3 className="text-base font-semibold text-slate-800">{service.ten}</h3>
              <Badge color={service.loai === 'clinic' ? 'blue' : 'yellow'}>
                {SERVICE_TYPE_LABEL[service.loai]}
              </Badge>
              <Badge color={service.status === 'active' ? 'green' : 'gray'}>
                {service.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
              </Badge>
            </div>

            {/* Grid thông số chính */}
            <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
              <InfoCell label="Giá dịch vụ"  value={formatPrice(service.gia)} />
              <InfoCell label="Thời lượng"   value={`${service.thoi_gian_phut} phút`} />
              <InfoCell label="Đặt trước"    value={`${service.gio_dat_truoc_toi_thieu} giờ`} />
              <InfoCell label="Chuyên khoa"  value={service.specialty_ten ?? '—'} />
              <InfoCell label="Số bác sĩ"   value={`${service.so_bac_si ?? 0} bác sĩ`} />
              <InfoCell label="Lượt đặt"    value={`${service.so_luot_dat ?? 0} lần`} />
            </dl>

            {/* Lịch áp dụng */}
            {(service.ngay_ap_dung || service.gio_bat_dau) && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium">Lịch áp dụng:</span>{' '}
                {service.ngay_ap_dung}
                {service.gio_bat_dau && `, ${service.gio_bat_dau}–${service.gio_ket_thuc}`}
              </div>
            )}

            {/* Khu vực (home only) */}
            {service.loai === 'home' && (service.khu_vuc?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Khu vực phục vụ
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {service.khu_vuc!.map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs text-yellow-700"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mô tả ngắn */}
            {service.mo_ta_ngan && (
              <p className="mt-3 text-sm italic text-slate-500">"{service.mo_ta_ngan}"</p>
            )}

            {/* Mô tả chi tiết */}
            {service.mo_ta && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Mô tả chi tiết
                </p>
                <p className="text-sm leading-relaxed text-slate-700">{service.mo_ta}</p>
              </div>
            )}

            {/* Người tạo + Ngày tạo / cập nhật */}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
              {service.nguoi_tao && (
                <span>
                  Người tạo:{' '}
                  <span className="font-medium text-slate-600">{service.nguoi_tao}</span>
                </span>
              )}
              {service.ngay_tao      && <span>Tạo: {formatDateTime(service.ngay_tao)}</span>}
              {service.ngay_cap_nhat && <span>Cập nhật: {formatDateTime(service.ngay_cap_nhat)}</span>}
            </div>
          </section>

          {/* ── Lịch sử thay đổi ── */}
          <section>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Lịch sử thay đổi
            </h4>
            {loadingLog ? (
              <p className="text-sm text-slate-400">Đang tải lịch sử...</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có lịch sử.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto pr-1 space-y-3">
                {logs.map((log) => {
                  const cfg = LOG_CONFIG[log.hanh_dong]
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        <Badge color={cfg.color}>{cfg.label}</Badge>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">{log.nguoi_thay_doi}</span>
                          <span>·</span>
                          <span>{formatDateTime(log.thoi_gian)}</span>
                        </div>
                        {log.mo_ta && (
                          <p className="mt-0.5 text-sm text-slate-600">{log.mo_ta}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="btn-secondary">Đóng</button>
          <button
            onClick={() => onEdit(service)}
            className="btn-primary flex items-center gap-1.5"
          >
            <Icon name="file-text" className="h-4 w-4" />
            Sửa dịch vụ này
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  )
}
