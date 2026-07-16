import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'
import { nurseService } from '@/services/nurse.service'
import type { NurseRevisionItem } from '@/types'
import { formatDate } from '@/utils/format'

export default function NurseRevisions() {
  const navigate = useNavigate()
  const [items, setItems] = useState<NurseRevisionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    nurseService.getRevisions()
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader
        title="Hồ sơ cần chỉnh sửa"
        description="Hồ sơ khám bạn đã nhập và bị bác sĩ yêu cầu chỉnh sửa lại."
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được danh sách. Vui lòng thử lại sau.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <Icon name="check" className="h-10 w-10 text-slate-200" />
          <p className="text-base font-medium text-slate-500">Không có hồ sơ nào cần chỉnh sửa.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800">{r.benh_nhan}</p>
                  <span className="text-xs text-slate-400">{formatDate(r.ngay_kham)}</span>
                </div>
                <p className="text-xs text-slate-400">Bác sĩ yêu cầu: {r.bac_si_yeu_cau ?? '—'} · {new Date(r.thoi_diem_yeu_cau).toLocaleString('vi-VN')}</p>
                {r.ly_do_kham && <p className="mt-1 text-sm text-slate-600">Lý do khám: {r.ly_do_kham}</p>}
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <Icon name="alert-circle" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{r.doctor_revision_note ?? 'Không có ghi chú'}</span>
                </div>
              </div>
              <button
                onClick={() => navigate(`/nurse/appointments/${r.appointment_id}`)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <Icon name="edit" className="h-3.5 w-3.5" /> Chỉnh sửa hồ sơ
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
