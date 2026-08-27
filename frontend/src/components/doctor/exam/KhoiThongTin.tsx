import type { ReactNode } from 'react'
import Icon from '@/components/admin/icons'

// Khối thẻ màu dùng chung cho MỌI màn "xem lại hồ sơ khám" của bác sĩ — StepXacNhan.tsx (tổng
// kết cuối luồng khám) và ExamHistoryDetailModal.tsx (xem lại hồ sơ đã khám xong). Tách ra đây
// để 2 màn không vẽ lại 2 lần rồi lệch nhau về sau — sửa màu/khung 1 chỗ, cả 2 nơi cùng đổi.

export interface MauSac {
  vien: string
  nenTieuDe: string
  iconBoc: string
}

// Thuần class Tailwind tĩnh (không nội suy chuỗi) để JIT nhận diện đủ.
export const MAU_SKY: MauSac = { vien: 'border-sky-200', nenTieuDe: 'bg-sky-50', iconBoc: 'bg-sky-100 text-sky-600' }
export const MAU_VIOLET: MauSac = { vien: 'border-violet-200', nenTieuDe: 'bg-violet-50', iconBoc: 'bg-violet-100 text-violet-600' }
export const MAU_AMBER: MauSac = { vien: 'border-amber-200', nenTieuDe: 'bg-amber-50', iconBoc: 'bg-amber-100 text-amber-600' }
export const MAU_EMERALD: MauSac = { vien: 'border-emerald-200', nenTieuDe: 'bg-emerald-50', iconBoc: 'bg-emerald-100 text-emerald-600' }
export const MAU_BRAND: MauSac = { vien: 'border-brand-200', nenTieuDe: 'bg-brand-50', iconBoc: 'bg-brand-100 text-brand-700' }
export const MAU_SLATE: MauSac = { vien: 'border-slate-200', nenTieuDe: 'bg-slate-50', iconBoc: 'bg-slate-100 text-slate-500' }

// Chỉ để HIỂN THỊ: khớp ngược giờ đại diện (BUOI_UONG trong StepKeDon.tsx) về tên buổi cho dễ
// đọc. Không khớp được (đơn cũ nhập giờ tự do) thì vẫn in nguyên giờ — không mất dữ liệu.
const GIO_THANH_BUOI: Record<string, string> = { '07:00': 'Sáng', '12:00': 'Trưa', '19:00': 'Tối' }
export function nhanBuoiUong(gio: string) {
  return GIO_THANH_BUOI[gio] ?? gio
}

interface Props {
  buoc?: number
  tieuDe: string
  icon: string
  mau: MauSac
  action?: { label: string; onClick: () => void }
  children: ReactNode
}

export default function KhoiThongTin({ buoc, tieuDe, icon, mau, action, children }: Props) {
  return (
    <section className={`overflow-hidden rounded-xl border bg-white shadow-card ${mau.vien}`}>
      <div className={`flex items-center gap-3 border-b px-4 py-3 ${mau.vien} ${mau.nenTieuDe}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${mau.iconBoc}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          {buoc != null && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bước {buoc}</p>
          )}
          <h3 className="truncate text-sm font-semibold text-slate-900">{tieuDe}</h3>
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="ml-auto shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  )
}
