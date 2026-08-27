import { useState } from 'react'
import type { RescheduleApprovalItem } from '@/services/receptionist-reschedule-approvals.service'

interface Props {
  item: RescheduleApprovalItem
  checked: boolean
  onToggle: (id: string, next: boolean) => void
  /** Người dùng bấm "Chọn khác" — trang cha mở ChonKhacPanel. */
  onChonKhac: (item: RescheduleApprovalItem) => void
  /** Duyệt riêng một dòng, kèm index phương án đang chọn (null = phương án 1). */
  onDuyetMot: (item: RescheduleApprovalItem, phuongAnIndex: number) => void
  dangXuLy: boolean
}

const NHAN_TRANG_THAI: Record<string, { nhan: string; mau: string }> = {
  cho_admin_duyet: { nhan: 'Chờ duyệt', mau: 'bg-amber-100 text-amber-900' },
  cho_khach_chon: { nhan: 'Chờ khách chọn', mau: 'bg-sky-100 text-sky-900' },
  da_ap_dung: { nhan: 'Đã dời', mau: 'bg-emerald-100 text-emerald-900' },
  da_huy: { nhan: 'Đã huỷ đề xuất', mau: 'bg-slate-200 text-slate-700' },
}

// Một dòng của bảng điều phối. Bung ra (▾) để xem đủ 4 phương án và chọn phương án khác
// phương án 1 — vẫn duyệt bằng cùng một nút, chỉ khác slot đích.
export default function DieuPhoiRow({ item, checked, onToggle, onChonKhac, onDuyetMot, dangXuLy }: Props) {
  const [mo, setMo] = useState(false)
  const [phuongAnIndex, setPhuongAnIndex] = useState(0)

  const trangThai = item.de_xuat.trang_thai ?? 'da_huy'
  const nhan = NHAN_TRANG_THAI[trangThai] ?? { nhan: trangThai, mau: 'bg-slate-200 text-slate-700' }
  const coPhuongAn = item.de_xuat.phuong_an.length > 0
  const chonDuocCheckbox = trangThai === 'cho_admin_duyet' && coPhuongAn
  const daXong = trangThai === 'da_ap_dung' || trangThai === 'da_huy'

  return (
    <>
      <tr className="border-t border-slate-100 align-top">
        <td className="px-3 py-2.5">
          <input
            type="checkbox"
            checked={checked}
            disabled={!chonDuocCheckbox || dangXuLy}
            onChange={(event) => onToggle(item.id, event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 disabled:opacity-40"
            aria-label={`Chọn lịch ${item.ma_lich_hen ?? item.id}`}
          />
        </td>
        <td className="px-3 py-2.5 text-sm font-semibold text-slate-800">{item.gio_kham}</td>
        <td className="px-3 py-2.5">
          <p className="text-sm font-semibold text-slate-800">{item.ten_khach || 'Khách'}</p>
          <p className="text-xs text-slate-500">{item.so_dien_thoai_khach || 'Chưa có SĐT'}</p>
        </td>
        <td className="px-3 py-2.5">
          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${nhan.mau}`}>{nhan.nhan}</span>
          {item.payment_status === 'paid' && (
            <span className="ml-1 inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">đã trả</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-sm text-slate-700">
          {trangThai === 'da_huy' ? (
            <span className="italic text-slate-500">Đã bỏ phương án — liên hệ tay. {item.de_xuat.ghi_chu && `"${item.de_xuat.ghi_chu}"`}</span>
          ) : coPhuongAn ? (
            <button type="button" onClick={() => setMo((truoc) => !truoc)} className="text-left hover:underline">
              {item.de_xuat.phuong_an[phuongAnIndex]?.mo_ta ?? item.de_xuat.phuong_an[0].mo_ta}
              <span className="ml-1 text-slate-400">{mo ? '▴' : '▾'}</span>
            </button>
          ) : (
            <span className="text-rose-700">⚠ Không có chỗ — {item.de_xuat.ghi_chu ?? 'phải liên hệ khách'}</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="flex justify-end gap-2">
            {!daXong && (
              <button
                type="button"
                onClick={() => onChonKhac(item)}
                disabled={dangXuLy}
                className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Chọn khác…
              </button>
            )}
            {trangThai === 'cho_admin_duyet' && coPhuongAn && (
              <button
                type="button"
                onClick={() => onDuyetMot(item, phuongAnIndex)}
                disabled={dangXuLy}
                className="min-h-9 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {/* Phương án 1 đã được giữ chỗ sẵn -> chỉ "duyệt" rồi để khách xác nhận.
                    Phương án khác chưa giữ chỗ -> phải dời NGAY kẻo mất slot. */}
                {phuongAnIndex === 0 ? 'Duyệt' : 'Dời ngay theo PA này'}
              </button>
            )}
          </div>
        </td>
      </tr>

      {mo && coPhuongAn && (
        <tr className="bg-slate-50">
          <td />
          <td colSpan={5} className="px-3 pb-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Phương án đề xuất</p>
            <div className="grid gap-1.5">
              {item.de_xuat.phuong_an.map((pa) => (
                <label key={pa.index} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={`pa-${item.id}`}
                    checked={phuongAnIndex === pa.index}
                    onChange={() => setPhuongAnIndex(pa.index)}
                    className="h-4 w-4"
                  />
                  <span>{pa.mo_ta}</span>
                  {pa.da_giu_cho && <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800">đã giữ chỗ</span>}
                  {pa.lan_walk_in && <span className="rounded bg-orange-100 px-1.5 text-[10px] font-bold text-orange-800">lấn walk-in</span>}
                </label>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
