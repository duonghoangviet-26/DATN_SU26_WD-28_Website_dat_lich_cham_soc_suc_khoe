import { useEffect, useState } from 'react'
import type { DoctorProfile, ServiceItem } from '@/types'
import { formatPrice } from '@/utils/format'
import Icon from '@/components/admin/icons'

export interface DoctorServiceFieldsData {
  gia_kham: number
  bao_hiem: { nha_nuoc: boolean; bao_lanh: boolean }
  related_services: { id: string; ten: string; gia: number }[]
}

interface Props {
  open: boolean
  doctor: DoctorProfile | null
  // Menu dịch vụ liên quan (loai='related') của chuyên khoa — nguồn để tích chọn
  availableServices: ServiceItem[]
  onClose: () => void
  onSave: (data: DoctorServiceFieldsData) => Promise<void>
}

// Sửa nhanh field liên quan dịch vụ của 1 bác sĩ: giá khám, bảo hiểm áp dụng,
// dịch vụ liên quan đã tích. KHÔNG sửa hồ sơ bác sĩ (bằng cấp, kinh nghiệm...)
// — việc đó thuộc trang Quản lý bác sĩ (C2).
export default function DoctorServiceFieldsModal({ open, doctor, availableServices, onClose, onSave }: Props) {
  const [giaKham, setGiaKham] = useState(0)
  const [baoHiem, setBaoHiem] = useState({ nha_nuoc: false, bao_lanh: false })
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !doctor) return
    setGiaKham(doctor.gia_kham)
    setBaoHiem({
      nha_nuoc: doctor.bao_hiem?.nha_nuoc ?? false,
      bao_lanh: doctor.bao_hiem?.bao_lanh ?? false,
    })
    setCheckedIds((doctor.related_services ?? []).map((rs) => rs.id))
    setError('')
  }, [open, doctor])

  function toggleService(id: string, checked: boolean) {
    setCheckedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  async function handleSubmit() {
    if (!giaKham || giaKham <= 0) { setError('Giá khám phải lớn hơn 0'); return }
    setSubmitting(true)
    try {
      const related_services = availableServices
        .filter((s) => checkedIds.includes(s.id))
        .map((s) => ({ id: s.id, ten: s.ten, gia: s.gia }))
      await onSave({ gia_kham: giaKham, bao_hiem: baoHiem, related_services })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open || !doctor) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Sửa thông tin dịch vụ — {doctor.ho_ten}</h2>
            <p className="mt-0.5 text-xs text-slate-400">Chỉ sửa giá khám, bảo hiểm và dịch vụ liên quan. Sửa hồ sơ bác sĩ ở trang Quản lý bác sĩ.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Giá khám (VNĐ)</label>
            <input
              type="number"
              value={giaKham || ''}
              onChange={(e) => { setGiaKham(Math.floor(Number(e.target.value))); setError('') }}
              min={1}
              step={1000}
              className={`input w-full ${error ? 'border-red-300 focus:ring-red-200' : ''}`}
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Loại bảo hiểm áp dụng</label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={baoHiem.nha_nuoc}
                  onChange={(e) => setBaoHiem((b) => ({ ...b, nha_nuoc: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-500"
                />
                Bảo hiểm y tế nhà nước
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={baoHiem.bao_lanh}
                  onChange={(e) => setBaoHiem((b) => ({ ...b, bao_lanh: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-500"
                />
                Bảo hiểm bảo lãnh
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Dịch vụ liên quan đã áp dụng</label>
            {availableServices.length === 0 ? (
              <p className="text-xs text-slate-400">Chuyên khoa chưa có dịch vụ liên quan nào để chọn.</p>
            ) : (
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                {availableServices.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center justify-between gap-2 text-sm text-slate-700">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checkedIds.includes(s.id)}
                        onChange={(e) => toggleService(s.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 accent-brand-500"
                      />
                      {s.ten}
                    </span>
                    <span className="font-medium text-slate-500">{formatPrice(s.gia)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>Hủy</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  )
}
