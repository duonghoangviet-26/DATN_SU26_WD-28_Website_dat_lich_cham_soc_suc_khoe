import { useState } from 'react'
import type { SuddenLeaveProposalSummary } from '@/services/receptionist-booking.service'
import { receptionistRescheduleApprovalsService } from '@/services/receptionist-reschedule-approvals.service'
import ChonKhacPanel from '@/components/receptionist/ChonKhacPanel'

interface Props {
  items: SuddenLeaveProposalSummary[]
  defaultDate: string
  onChanged: () => void
}

// Danh sách lịch hẹn ĐÃ THANH TOÁN đang chờ duyệt phương án dời (mục 15, chốt 2026-08-22).
// Trước đây chỉ Admin duyệt được nhưng không có UI nào gọi — nay lễ tân bấm được ngay tại
// đây, ngay sau khi báo nghỉ / duyệt đơn nghỉ.
export default function RescheduleNeedsApprovalList({ items, defaultDate, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(null)
  const [chonKhacId, setChonKhacId] = useState<string | null>(null)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())

  const canDuyet = items.filter((item) => item.cho_admin_duyet && !doneIds.has(item.appointment_id))
  if (canDuyet.length === 0) return null

  const duyet = async (appointmentId: string) => {
    setBusyId(appointmentId)
    setErrorId(null)
    try {
      await receptionistRescheduleApprovalsService.approve(appointmentId)
      setDoneIds((prev) => new Set(prev).add(appointmentId))
      onChanged()
    } catch (requestError: any) {
      setErrorId({ id: appointmentId, message: requestError?.response?.data?.message || 'Không thể duyệt phương án.' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <p className="text-sm font-bold text-slate-800">Chờ duyệt phương án dời — khách đã thanh toán ({canDuyet.length})</p>
      <p className="text-xs text-slate-500">Đã giữ sẵn chỗ theo phương án tốt nhất. Duyệt để báo khách ngay, hoặc chọn khác nếu khách có yêu cầu riêng.</p>
      <div className="mt-2 space-y-2">
        {canDuyet.map((item) => (
          <div key={item.appointment_id} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-slate-700">{item.so_phuong_an} phương án đã sinh — mã lịch hẹn <span className="font-mono text-xs">{item.appointment_id.slice(-6)}</span></p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setChonKhacId(item.appointment_id)}
                  disabled={busyId === item.appointment_id}
                  className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Chọn khác
                </button>
                <button
                  type="button"
                  onClick={() => void duyet(item.appointment_id)}
                  disabled={busyId === item.appointment_id}
                  className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === item.appointment_id ? 'Đang duyệt...' : 'Duyệt'}
                </button>
              </div>
            </div>
            {errorId?.id === item.appointment_id && (
              <p className="mt-1.5 rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-800">{errorId.message}</p>
            )}
          </div>
        ))}
      </div>

      {chonKhacId && (
        <ChonKhacPanel
          appointmentId={chonKhacId}
          defaultDate={defaultDate}
          onClose={() => setChonKhacId(null)}
          onDone={() => {
            setDoneIds((prev) => new Set(prev).add(chonKhacId))
            onChanged()
          }}
        />
      )}
    </div>
  )
}
