import { useState, useEffect } from 'react'
import type { HospitalItem, SpecialtyItem } from '@/types'
import { hospitalService } from '@/services/hospital.service'
import Icon from '@/components/admin/icons'

interface Props {
  specialty: SpecialtyItem
  currentClinicId: string
  onClose: () => void
  onSuccess: () => void
}

export default function CopySpecialtyModal({ specialty, currentClinicId, onClose, onSuccess }: Props) {
  const [clinics, setClinics] = useState<HospitalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    hospitalService.getAllClinics()
      .then((data) => {
        // Lọc bỏ clinic hiện tại
        setClinics(data.filter((c) => c._id !== currentClinicId))
      })
      .catch((err) => console.error('Lỗi lấy chi nhánh:', err))
      .finally(() => setLoading(false))
  }, [currentClinicId])

  function toggleClinic(id: string) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  function toggleAll() {
    if (selectedIds.size === clinics.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(clinics.map(c => c._id)))
    }
  }

  async function handleCopy() {
    if (selectedIds.size === 0) return
    try {
      setSubmitting(true)
      const targetIds = Array.from(selectedIds)
      const res = await hospitalService.copySpecialty(specialty._id, targetIds)
      alert(res.message || 'Sao chép thành công')
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || 'Lỗi khi sao chép chuyên khoa'
      alert(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            Sao chép <span className="text-brand-600">{specialty.ten}</span>
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          Chọn các chi nhánh mà bạn muốn sao chép chuyên khoa này sang:
        </p>

        <div className="mb-4 max-h-60 overflow-y-auto rounded-lg border border-slate-200">
          {loading ? (
            <div className="p-4 text-center text-sm text-slate-400">Đang tải danh sách...</div>
          ) : clinics.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">Không có chi nhánh khác để sao chép.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50 font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={selectedIds.size === clinics.length && clinics.length > 0}
                  onChange={toggleAll}
                />
                Chọn tất cả
              </label>
              {clinics.map((c) => (
                <label key={c._id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={selectedIds.has(c._id)}
                    onChange={() => toggleClinic(c._id)}
                  />
                  <div className="flex items-center gap-2">
                    {c.logo_url && <img src={c.logo_url} className="w-6 h-6 rounded border object-cover" />}
                    <span className="text-sm text-slate-700">{c.ten}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>
            Hủy
          </button>
          <button
            onClick={handleCopy}
            className="btn-primary"
            disabled={submitting || selectedIds.size === 0}
          >
            {submitting ? 'Đang xử lý...' : 'Xác nhận sao chép'}
          </button>
        </div>
      </div>
    </div>
  )
}
