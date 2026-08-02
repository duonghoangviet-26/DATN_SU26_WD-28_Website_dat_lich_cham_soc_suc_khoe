import { useEffect, useState } from 'react'
import { ProfileAuditLog, receptionistPatientIntakeService } from '@/services/receptionist-patient-intake.service'

const FIELD_LABELS: Record<string, string> = {
  ho_ten: 'Họ tên',
  so_dien_thoai: 'Số điện thoại',
  ngay_sinh: 'Ngày sinh',
  gioi_tinh: 'Giới tính',
  nhom_mau: 'Nhóm máu',
  di_ung: 'Dị ứng',
  benh_nen: 'Bệnh nền',
  dia_chi: 'Địa chỉ',
  ghi_chu: 'Ghi chú',
}

const ROLE_LABELS: Record<string, string> = {
  receptionist: 'Lễ tân',
  admin: 'Admin',
  doctor: 'Bác sĩ',
  user: 'Bệnh nhân',
  system: 'Hệ thống',
}

function formatValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Chưa cập nhật'
  if (field === 'ngay_sinh') {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('vi-VN')
  }
  if (field === 'gioi_tinh') {
    return ({ nam: 'Nam', nu: 'Nữ', khac: 'Khác' } as Record<string, string>)[String(value)] ?? String(value)
  }
  return String(value)
}

interface ProfileAuditPanelProps {
  profileId: string
  onClose: () => void
}

export default function ProfileAuditPanel({ profileId, onClose }: ProfileAuditPanelProps) {
  const [logs, setLogs] = useState<ProfileAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    receptionistPatientIntakeService
      .getProfileAuditLogs(profileId)
      .then((result) => {
        if (!cancelled) setLogs(result)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError?.response?.data?.message || 'Không thể tải lịch sử cập nhật')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Lịch sử cập nhật hồ sơ</h3>
            <p className="mt-1 text-sm text-slate-500">Chỉ hiển thị các lần sửa thông tin hành chính.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>

        {loading && <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải lịch sử...</div>}
        {!loading && error && <p className="mt-6 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {!loading && !error && logs.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Hồ sơ này chưa từng được chỉnh sửa.</div>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="mt-5 space-y-3">
            {logs.map((log) => {
              const changedFields = Object.keys(log.du_lieu_moi || {}).filter((key) => key !== 'changed_fields')
              return (
                <div key={log.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {log.actor?.ho_ten || 'Không rõ người thực hiện'}
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{ROLE_LABELS[log.vai_tro] || log.vai_tro}</span>
                    </p>
                    <span className="text-xs text-slate-500">{new Date(log.ngay_tao).toLocaleString('vi-VN')}</span>
                  </div>
                  {log.ly_do && <p className="mt-2 text-sm text-slate-600">Lý do: {log.ly_do}</p>}
                  <div className="mt-3 space-y-1.5">
                    {changedFields.map((field) => (
                      <div key={field} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                        <span className="font-semibold">{FIELD_LABELS[field] || field}:</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 line-through">{formatValue(field, (log.du_lieu_cu || {})[field])}</span>
                        <span>→</span>
                        <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">{formatValue(field, (log.du_lieu_moi || {})[field])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
