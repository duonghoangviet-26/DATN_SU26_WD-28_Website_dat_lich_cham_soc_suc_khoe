import { useState } from 'react'
import { receptionistQueueService } from '@/services/receptionist-queue.service'

export interface QueueTransferCandidate {
  doctor_id: string
  ten_bac_si: string
  so_dang_cho: number
  phong_kham?: string | null
}

interface QueueTransferModalProps {
  hangDoiId: string
  tenBenhNhan: string
  maSoThuTu?: string | null
  candidates: QueueTransferCandidate[]
  onClose: () => void
  onTransferred: () => void
}

export default function QueueTransferModal({ hangDoiId, tenBenhNhan, maSoThuTu, candidates, onClose, onTransferred }: QueueTransferModalProps) {
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!selectedDoctorId || !reason.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await receptionistQueueService.transfer(hangDoiId, { doctor_id_moi: selectedDoctorId, ly_do: reason.trim() })
      onTransferred()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể chuyển lượt sang bác sĩ khác.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-xl font-bold text-slate-800">Chuyển bác sĩ</h3>
        <p className="mt-1 text-sm text-slate-500">
          {maSoThuTu ? `${maSoThuTu} · ` : ''}{tenBenhNhan}
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Số thứ tự và thời điểm check-in được giữ nguyên — bệnh nhân không mất chỗ trong hàng đợi.</p>

        {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

        {candidates.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Không có bác sĩ khác cùng chuyên khoa đang trong ca để chuyển.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {candidates.map((doctor) => (
              <button
                key={doctor.doctor_id}
                type="button"
                onClick={() => setSelectedDoctorId(doctor.doctor_id)}
                className={`w-full rounded-xl border p-3 text-left ${selectedDoctorId === doctor.doctor_id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-300'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-800">{doctor.ten_bac_si}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{doctor.so_dang_cho} đang chờ</span>
                </div>
                {doctor.phong_kham && <p className="mt-1 text-xs text-slate-500">{doctor.phong_kham}</p>}
              </button>
            ))}
          </div>
        )}

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Lý do chuyển *
          <textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Vd: bác sĩ hiện tại khám kéo dài, chuyển sang bác sĩ còn trống để bệnh nhân đỡ chờ" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            Đóng
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!selectedDoctorId || !reason.trim() || submitting}
            className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Đang chuyển...' : 'Xác nhận chuyển'}
          </button>
        </div>
      </div>
    </div>
  )
}
