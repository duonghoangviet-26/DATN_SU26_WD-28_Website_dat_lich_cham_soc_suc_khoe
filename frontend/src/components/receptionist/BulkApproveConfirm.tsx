import { useState } from 'react'
import {
  receptionistRescheduleApprovalsService,
  type BulkApproveKetQua,
  type RescheduleApprovalItem,
} from '@/services/receptionist-reschedule-approvals.service'

interface Props {
  items: RescheduleApprovalItem[]
  onClose: () => void
  onDone: () => void
}

// Xác nhận 2 bước cho duyệt hàng loạt (D1, D2): liệt kê TỪNG dòng "khách → chỗ mới" trước
// khi ghi, và trả kết quả cũng theo TỪNG dòng — không dùng alert() gộp một câu, vì một lịch
// hỏng giữa lô là chuyện bình thường và lễ tân phải biết chính xác lịch nào.
export default function BulkApproveConfirm({ items, onClose, onDone }: Props) {
  const [ketQua, setKetQua] = useState<BulkApproveKetQua | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const xacNhan = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await receptionistRescheduleApprovalsService.bulkApprove(items.map((item) => item.id))
      setKetQua(res)
      onDone()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không duyệt được lô này.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-lg">
        {!ketQua ? (
          <>
            <h3 className="text-lg font-bold text-slate-800">Duyệt {items.length} phương án dời lịch</h3>
            <p className="mt-1 text-sm text-slate-500">
              Sau khi duyệt, khách được thông báo và vẫn còn quyền đổi sang phương án khác trong
              thời hạn phản hồi. Không ai mất tiền.
            </p>
            {items.length > 20 && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                ⚠ Lô này có {items.length} lịch — hãy soát lại danh sách bên dưới trước khi bấm.
              </p>
            )}

            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-semibold text-slate-800">
                    {item.ten_khach || 'Khách'} · {item.gio_kham}
                  </span>
                  <span className="shrink-0 text-slate-600">→ {item.de_xuat.phuong_an[0]?.mo_ta ?? '—'}</span>
                </li>
              ))}
            </ul>

            {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">Huỷ</button>
              <button type="button" onClick={() => void xacNhan()} disabled={submitting} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {submitting ? 'Đang duyệt...' : `Xác nhận duyệt ${items.length} lịch`}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-slate-800">Kết quả duyệt</h3>
            <p className="mt-1 text-sm text-slate-500">
              {ketQua.thanh_cong.length} thành công · {ketQua.that_bai.length} cần xử lý tay.
            </p>

            {ketQua.thanh_cong.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Đã duyệt</p>
                <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                  {ketQua.thanh_cong.map((dong) => (
                    <li key={dong.id} className="rounded-lg bg-emerald-50 px-3 py-1.5">
                      {dong.ten_khach || 'Khách'} → {dong.mo_ta}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ketQua.that_bai.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Chưa duyệt được</p>
                <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                  {ketQua.that_bai.map((dong) => (
                    <li key={dong.id} className="rounded-lg bg-rose-50 px-3 py-1.5">
                      {dong.ten_khach || 'Khách'} — {dong.ly_do}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700">Đóng</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
