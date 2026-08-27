import { useEffect, useState } from 'react'
import {
  receptionistDoctorLeavesService,
  type HuyBaoNghiKetQua,
} from '@/services/receptionist-doctor-leaves.service'

interface Props {
  leaveId: string
  doctorName: string
  onClose: () => void
  onDone: () => void
}

// Xác nhận khôi phục báo nghỉ (A2). Gọi endpoint xem trước để hiện ĐÚNG con số — lễ tân
// phải biết bao nhiêu lịch đã dời xong sẽ GIỮ NGUYÊN ở chỗ mới (B4) trước khi bấm.
export default function ConfirmRestoreModal({ leaveId, doctorName, onClose, onDone }: Props) {
  const [preview, setPreview] = useState<HuyBaoNghiKetQua | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    receptionistDoctorLeavesService.previewHuyBaoNghi(leaveId)
      .then((res) => { if (!cancelled) setPreview(res) })
      .catch((requestError: any) => {
        if (!cancelled) setError(requestError?.response?.data?.message || 'Không thể xem trước.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [leaveId])

  const xacNhan = async () => {
    setSubmitting(true)
    setError('')
    try {
      await receptionistDoctorLeavesService.huyBaoNghi(leaveId)
      onDone()
      onClose()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể khôi phục.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
        <h3 className="text-lg font-bold text-slate-800">Khôi phục lịch làm việc</h3>
        <p className="mt-1 text-sm text-slate-500">{doctorName}</p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Đang kiểm tra...</p>
        ) : preview ? (
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="rounded-xl bg-emerald-50 px-3 py-2">
              Mở lại <strong>{preview.so_slot_mo_lai}</strong> slot cho khách đặt.
            </li>
            <li className="rounded-xl bg-amber-50 px-3 py-2">
              Huỷ <strong>{preview.so_de_xuat_huy}</strong> đề xuất dời chưa xử lý — khách được
              báo đính chính là lịch cũ giữ nguyên.
            </li>
            <li className="rounded-xl bg-slate-100 px-3 py-2">
              <strong>{preview.so_lich_da_doi_giu_nguyen}</strong> lịch đã dời xong sẽ{' '}
              <strong>giữ nguyên</strong> ở chỗ mới — không đảo về giờ cũ.
            </li>
          </ul>
        ) : null}

        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">Đóng</button>
          <button type="button" onClick={() => void xacNhan()} disabled={submitting || loading || !preview} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Đang khôi phục...' : 'Xác nhận khôi phục'}
          </button>
        </div>
      </div>
    </div>
  )
}
