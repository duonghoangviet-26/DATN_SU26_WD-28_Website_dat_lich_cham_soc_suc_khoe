import { useState } from 'react'
import { receptionistQueueService } from '@/services/receptionist-queue.service'

interface QueueCancelModalProps {
  hangDoiId: string
  tenBenhNhan: string
  maSoThuTu?: string | null
  onClose: () => void
  onCancelled: () => void
}

export default function QueueCancelModal({ hangDoiId, tenBenhNhan, maSoThuTu, onClose, onCancelled }: QueueCancelModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await receptionistQueueService.cancel(hangDoiId, { ly_do: reason.trim() })
      onCancelled()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể đóng lượt chờ này.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-xl font-bold text-slate-800">Đóng lượt chờ</h3>
        <p className="mt-1 text-sm text-slate-500">
          {maSoThuTu ? `${maSoThuTu} · ` : ''}{tenBenhNhan}
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Chỉ dùng khi khách đã tự bỏ về. Lượt vẫn được ghi nhận là khách đã tới quầy, không
          tính là không đến — khách không mất tiền đã thanh toán (rule mục 8).
        </p>

        {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Lý do đóng lượt *
          <textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Vd: khách chờ lâu, tự rời quầy không báo"
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            Đóng
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!reason.trim() || submitting}
            className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Đang đóng lượt...' : 'Xác nhận đóng lượt'}
          </button>
        </div>
      </div>
    </div>
  )
}
